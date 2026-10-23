-- Stop old workers and deploy tenant-scoped routes before this migration.
-- The web database role must not own these tables or have BYPASSRLS.
-- A separately credentialed verifier service may use a narrowly scoped
-- worker role with BYPASSRLS, never exposed to the HTTP process.
ALTER TABLE verification_jobs ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE verification_jobs SET tenant_id = '00000000-0000-4000-8000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE verification_jobs ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE verification_jobs ADD CONSTRAINT verification_jobs_tenant_fk FOREIGN KEY (tenant_id) REFERENCES jules_tenants(id);
CREATE INDEX IF NOT EXISTS verification_jobs_tenant_recent_idx ON verification_jobs (tenant_id, created_at DESC);
ALTER TABLE verification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_jobs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS verification_jobs_tenant_policy ON verification_jobs;
CREATE POLICY verification_jobs_tenant_policy ON verification_jobs
  USING (tenant_id = nullif(current_setting('jules.tenant_id', true),'')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('jules.tenant_id', true),'')::uuid);
