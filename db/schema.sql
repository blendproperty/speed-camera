CREATE TABLE IF NOT EXISTS cameras (
  code text PRIMARY KEY,
  name text NOT NULL,
  limit_kmh numeric(5,1) NOT NULL CHECK (limit_kmh > 0 AND limit_kmh <= 160),
  enabled boolean NOT NULL DEFAULT true,
  cursor_at timestamptz,
  last_poll_at timestamptz,
  last_capture_at timestamptz,
  poll_error text
);

CREATE TABLE IF NOT EXISTS captures (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  camera_code text NOT NULL REFERENCES cameras(code),
  provider_id text NOT NULL,
  captured_at timestamptz NOT NULL,
  plate text,
  speed_kmh numeric(5,1) CHECK (speed_kmh BETWEEN 0 AND 350),
  limit_kmh numeric(5,1) NOT NULL,
  image_reference text,
  image_bytes bytea,
  image_type text,
  image_sha256 text,
  status text NOT NULL CHECK (status IN ('unmeasured','within_limit','held','pending','approved','dismissed')),
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  UNIQUE(camera_code, provider_id)
);
CREATE INDEX IF NOT EXISTS captures_review ON captures(status, captured_at DESC);
CREATE INDEX IF NOT EXISTS captures_time ON captures(captured_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  actor text NOT NULL,
  action text NOT NULL,
  target text,
  detail jsonb NOT NULL DEFAULT '{}'
);
