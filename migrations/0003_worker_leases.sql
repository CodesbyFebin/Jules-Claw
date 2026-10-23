-- Apply after 0002; stop pre-v0.6 workers before migrating.
-- Leases detect crashed workers. Failed jobs are not automatically re-executed.
ALTER TABLE verification_jobs ADD COLUMN IF NOT EXISTS worker_id uuid;
ALTER TABLE verification_jobs ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz;
ALTER TABLE verification_jobs ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS verification_jobs_running_heartbeat_idx
  ON verification_jobs (heartbeat_at) WHERE status='running';
