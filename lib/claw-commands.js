const jobId = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const url = 'https:\\/\\/github\\.com\\/[A-Za-z0-9_.-]+\\/[A-Za-z0-9_.-]+\\/pull\\/[1-9][0-9]*';
export function parseClawCommand(input) {
  const value = typeof input === 'string' ? input.trim() : '';
  if (value.length > 2048) return { type:'invalid', reason:'Command too long' };
  if (value === 'help') return { type:'help' };
  if (value === 'jobs' || value === 'status') return { type:value };
  if (value === 'clear') return { type:'clear' };
  const job = value.match(new RegExp('^job ('+jobId+')$', 'i'));
  if (job) return { type:'job', id:job[1].toLowerCase() };
  const cancel = value.match(new RegExp('^cancel ('+jobId+')$', 'i'));
  if (cancel) return { type:'cancel', id:cancel[1].toLowerCase() };
  const verify = value.match(new RegExp('^verify (syntax|tests) ('+url+')$', 'i'));
  if (verify) return { type:'verify', profile: verify[1].toLowerCase()==='tests'?'node-tests':'syntax', url:verify[2] };
  return { type:'invalid', reason:'Not an allowlisted command. Use help. Arbitrary shell execution is disabled.' };
}
export const HELP = [
  'help — list supported operations',
  'status — check verification database and job counts',
  'jobs — refresh latest verification jobs',
  'job <uuid> — show persisted job output and result',
  'verify syntax <GitHub PR URL> — queue real syntax verification',
  'verify tests <GitHub PR URL> — queue real Node test verification',
  'cancel <uuid> — request cancellation of queued/running job',
  'clear — clear visible terminal output',
  'No shell, filesystem, Docker, SSH, npm or MCP commands are exposed here.',
];
