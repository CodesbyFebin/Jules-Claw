-- Apply before enabling the new quota-gated verification queue.
CREATE TABLE IF NOT EXISTS execution_audit (
  id bigserial PRIMARY KEY,
  job_id uuid NOT NULL,
  event text NOT NULL CHECK (event IN ('created','transition')),
  old_status text,
  new_status text NOT NULL,
  profile text NOT NULL,
  commit_sha char(40) NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS execution_audit_job_idx ON execution_audit(job_id, id);

CREATE OR REPLACE FUNCTION record_verification_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO execution_audit(job_id,event,new_status,profile,commit_sha)
    VALUES (NEW.id,'created',NEW.status,NEW.profile,NEW.commit_sha);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO execution_audit(job_id,event,old_status,new_status,profile,commit_sha)
    VALUES (NEW.id,'transition',OLD.status,NEW.status,NEW.profile,NEW.commit_sha);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS verification_audit_trigger ON verification_jobs;
CREATE TRIGGER verification_audit_trigger AFTER INSERT OR UPDATE OF status ON verification_jobs
  FOR EACH ROW EXECUTE FUNCTION record_verification_transition();

-- Shared across instances using one PostgreSQL cluster. Keyed by operation,
-- not person, until identity-backed multiuser authentication is implemented.
CREATE TABLE IF NOT EXISTS request_quotas (
  operation text NOT NULL,
  window_start timestamptz NOT NULL,
  used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
  PRIMARY KEY(operation, window_start)
);
