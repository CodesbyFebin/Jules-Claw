import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const sources = JSON.parse(readFileSync(new URL('../data/skill-sources.json', import.meta.url), 'utf8'));

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
