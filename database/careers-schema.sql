-- Additive careers application storage. Existing admissions and booking rows are untouched.
BEGIN;
CREATE SCHEMA IF NOT EXISTS sfis;

CREATE TABLE IF NOT EXISTS sfis.career_applications (
  id UUID PRIMARY KEY,
  request_id UUID NOT NULL UNIQUE,
  application_ref VARCHAR(20) NOT NULL UNIQUE,
  applicant_name TEXT NOT NULL,
  email TEXT NOT NULL,
  mobile VARCHAR(10) NOT NULL CHECK (mobile ~ '^[6-9][0-9]{9}$'),
  role_slug TEXT NOT NULL,
  role_title TEXT NOT NULL,
  why_join TEXT NOT NULL DEFAULT '',
  resume_name TEXT NOT NULL,
  resume_type TEXT NOT NULL CHECK (resume_type IN ('application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  resume_size INTEGER NOT NULL CHECK (resume_size > 0 AND resume_size <= 2621440),
  resume_data BYTEA NOT NULL,
  consent BOOLEAN NOT NULL CHECK (consent),
  consent_version TEXT NOT NULL DEFAULT 'sfis-careers-application-v1',
  payload_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','under_review','shortlisted','interview','not_selected','hired')),
  founder_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS career_applications_mobile_created ON sfis.career_applications(mobile, created_at DESC);
CREATE INDEX IF NOT EXISTS career_applications_status_created ON sfis.career_applications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS career_applications_role_created ON sfis.career_applications(role_slug, created_at DESC);

CREATE TABLE IF NOT EXISTS sfis.career_application_events (
  id BIGSERIAL PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES sfis.career_applications(id),
  event_type TEXT NOT NULL CHECK (event_type IN ('submitted','status_changed','founder_note')),
  previous_status TEXT,
  new_status TEXT,
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS career_application_events_application_created ON sfis.career_application_events(application_id, created_at DESC);

-- Reuse the existing CAPTCHA store while extending its allowed contexts.
ALTER TABLE sfis.booking_captchas DROP CONSTRAINT IF EXISTS booking_captchas_purpose_check;
ALTER TABLE sfis.booking_captchas ADD CONSTRAINT booking_captchas_purpose_check
  CHECK (purpose IN ('booking','tracking','career-application','career-status'));

REVOKE ALL ON sfis.career_applications, sfis.career_application_events FROM PUBLIC;
COMMIT;
