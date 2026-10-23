-- Durable verification jobs. Only the worker may update execution fields.
CREATE TABLE IF NOT EXISTS verification_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pull_request_url text NOT NULL,
  repo_owner text NOT NULL,
  repo_name text NOT NULL,
  commit_sha char(40) NOT NULL,
  profile varchar(16) NOT NULL CHECK (profile IN ('syntax','node-tests')),
  status varchar(24) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','passed','failed','infra_failure','cancelled')),
  cancel_requested boolean NOT NULL DEFAULT false,
  exit_code integer,
  stdout text NOT NULL DEFAULT '',
  stderr text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS verification_jobs_status_created_idx ON verification_jobs(status, created_at);
