// Non-invasive live-qualification inventory. No credentials or secrets printed.
// Never reports a live pass solely from presence of an executable or secret.
import { spawnSync } from 'node:child_process';
import { platform, release, arch } from 'node:os';

const exe = name => {
  const result = spawnSync('which', [name], { encoding: 'utf8', timeout: 3000 });
  return result.status === 0;
};
const configured = name => Boolean(process.env[name]);
const gates = [
  { id: 'postgres_migrations_rls_concurrency_backup_restore', prerequisites: { postgresClient: exe('psql'), dump: exe('pg_dump'), restore: exe('pg_restore'), databaseUrl: configured('DATABASE_URL') } },
  { id: 'multi_user_session_expiry', prerequisites: { databaseUrl: configured('DATABASE_URL'), authSecret: configured('BETTER_AUTH_SECRET'), authUrl: configured('BETTER_AUTH_URL') } },
  { id: 'docker_worker_crash_recovery', prerequisites: { docker: exe('docker'), workerDatabaseUrl: configured('WORKER_DATABASE_URL') } },
  { id: 'openshell_hostile_execution', prerequisites: { openshell: exe('openshell') } },
  { id: 'live_llm_failover', prerequisites: { localModelUrl: configured('JULES_LOCAL_LLM_URL'), remoteGatewayCredential: configured('GATEWAY_API_KEY') } },
  { id: 'live_coding_provider', prerequisites: { providerCredential: configured('JULES_API_KEY') } },
];
const report = {
  schema: 'open-web-llm-qualification-inventory.v1',
  capturedAt: new Date().toISOString(),
  machine: { platform: platform(), release: release(), arch: arch(), node: process.version },
  cost: 'No paid resources provisioned; no provider requests made.',
  gates: gates.map(g => ({ id: g.id, status: 'BLOCKED_NOT_EXECUTED', missing: Object.keys(g.prerequisites).filter(k => !g.prerequisites[k]), readiness: g.prerequisites })),
  note: 'Presence of prerequisites is not evidence of a successful live test. No gate is promoted to PASS without separate real execution evidence.',
};
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
