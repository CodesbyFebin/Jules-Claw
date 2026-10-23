-- Better Auth user IDs are validated by the auth service, never accepted from
-- request headers. Provision memberships out-of-band until onboarding exists.
CREATE TABLE IF NOT EXISTS jules_tenant_memberships (
  tenant_id uuid NOT NULL REFERENCES jules_tenants(id),
  user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','admin','operator','viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  PRIMARY KEY (tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS jules_tenant_memberships_user_idx
  ON jules_tenant_memberships(user_id) WHERE revoked_at IS NULL;
