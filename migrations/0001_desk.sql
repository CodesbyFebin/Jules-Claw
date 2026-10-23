-- Single-operator evidence journal. Entries are user-authored notes, not automatically verified test results.
CREATE TABLE IF NOT EXISTS desk_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(160) NOT NULL,
  detail text NOT NULL,
  status varchar(12) NOT NULL CHECK (status IN ('note','blocked','review')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS desk_entries_created_at_idx ON desk_entries (created_at DESC);
