-- Run only after deploying tenant-scoped desk routes. This migration intentionally
-- does NOT enable public multi-user hosting or claim all routes are scoped.
CREATE TABLE IF NOT EXISTS jules_tenants (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO jules_tenants (id) VALUES ('00000000-0000-4000-8000-000000000001') ON CONFLICT DO NOTHING;

ALTER TABLE desk_entries ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE desk_entries SET tenant_id = '00000000-0000-4000-8000-000000000001' WHERE tenant_id IS NULL;
ALTER TABLE desk_entries ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE desk_entries ADD CONSTRAINT desk_entries_tenant_fk FOREIGN KEY (tenant_id) REFERENCES jules_tenants(id);
CREATE INDEX IF NOT EXISTS desk_entries_tenant_recent_idx ON desk_entries (tenant_id, created_at DESC);

ALTER TABLE desk_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE desk_entries FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS desk_entries_tenant_policy ON desk_entries;
CREATE POLICY desk_entries_tenant_policy ON desk_entries
  USING (tenant_id = nullif(current_setting('jules.tenant_id', true),'')::uuid)
  WITH CHECK (tenant_id = nullif(current_setting('jules.tenant_id', true),'')::uuid);
