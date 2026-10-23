import { createHash } from 'node:crypto';
import { sources } from './skill-source-catalog.mjs';

const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const COMMIT = /^[0-9a-f]{40}$/i;
const ALLOWED = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC']);
const MAX_BYTES = 256 * 1024;

// An evidence-only catalog: no network fetch, package install, code execution, or dynamic import.
export function listSkillSources() {
  return sources.map(({ repository, area, license, decision, reason }) =>
    ({ repository, area, license, decision, reason, executable: false }));
}

export function validateSkillSubmission(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Submission object required');
  if (typeof value.repository !== 'string' || !REPO.test(value.repository) || value.repository.includes('..')) throw new Error('Invalid GitHub repository');
  if (typeof value.commit !== 'string' || !COMMIT.test(value.commit)) throw new Error('A full pinned commit SHA is required');
  if (typeof value.path !== 'string' || value.path.length > 200 || value.path.startsWith('/') || value.path.split('/').some(v => !v || v === '.' || v === '..' || v.startsWith('.'))) throw new Error('Unsafe skill path');
  if (!/^[A-Za-z0-9_./-]+\.md$/i.test(value.path)) throw new Error('Only Markdown skill definitions are accepted');
  if (typeof value.license !== 'string' || !ALLOWED.has(value.license)) throw new Error('License is not approved for this pipeline');
  if (typeof value.content !== 'string' || !value.content.trim() || Buffer.byteLength(value.content, 'utf8') > MAX_BYTES) throw new Error('Skill content is missing or too large');
  return { repository: value.repository, commit: value.commit.toLowerCase(), path: value.path, license: value.license, content: value.content };
}

const INDICATORS = [
  ['untrusted_download_execute', /(?:curl|wget)\b[^\n]{0,180}(?:\||sh\b|bash\b)/i],
  ['secret_file_access', /(?:\.env(?:\.|\b)|id_rsa\b|private[_-]?key\b|\.aws\/credentials|\.ssh\/)/i],
  ['destructive_command', /\b(?:rm\s+-[a-z]*r[a-z]*f|mkfs\.|dd\s+if=|git\s+reset\s+--hard)\b/i],
  ['privilege_escalation', /\b(?:sudo\b|chmod\s+777|setcap\b)/i],
  ['prompt_override', /(?:ignore (?:all )?(?:prior|previous) instructions|reveal (?:your|the) (?:system|developer) prompt)/i],
  ['shell_execution', /\b(?:exec\s*\(|subprocess\.|child_process|os\.system\s*\()/i],
];

export function inspectSkillSubmission(submission) {
  const skill = validateSkillSubmission(submission);
  const findings = INDICATORS.flatMap(([id, regex]) => regex.test(skill.content) ? [{ id, severity: 'review_required' }] : []);
  const sha256 = createHash('sha256').update(skill.content, 'utf8').digest('hex');
  return {
    source: { repository: skill.repository, commit: skill.commit, path: skill.path, license: skill.license },
    sha256, byteLength: Buffer.byteLength(skill.content, 'utf8'), findings,
    decision: 'requires_human_review', executable: false, installed: false,
    note: 'Heuristic scan only; no claim of safety. Verify GitHub source contents and pin SHA against this digest independently, then run isolated security scanners before approval.'
  };
}

export async function fetchPinnedSkill(metadata, deps = {}) {
  const { repository, commit, path, license } = metadata || {};
  // Reuse the same strict validation without accepting arbitrary network URLs.
  validateSkillSubmission({ repository, commit, path, license, content: 'metadata only' });
  const catalog = listSkillSources().find(item => item.repository === repository);
  if (!catalog || catalog.decision !== 'candidate' || catalog.license !== license) {
    throw new Error('Upstream source is not approved for candidate review');
  }
  const url = `https://raw.githubusercontent.com/${repository}/${commit}/${path}`;
  const fetchImpl = deps.fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetchImpl(url, { signal: controller.signal, redirect: 'error', cache: 'no-store' });
    if (!response.ok) throw new Error('Pinned upstream source fetch failed');
    if (Number(response.headers?.get('content-length') || 0) > MAX_BYTES) throw new Error('Remote skill is too large');
    if (!response.body || typeof response.body.getReader !== 'function') throw new Error('Remote skill response lacks bounded stream');
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) throw new Error('Remote skill exceeded byte limit');
        chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel().catch(() => {}); }
    const content = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    return { ...inspectSkillSubmission({ repository, commit, path, license, content }), fetchedUrl: url, sourceFetch: 'pinned_public_github_raw', attestUpstreamSignature: false };
  } finally { clearTimeout(timer); }
}
