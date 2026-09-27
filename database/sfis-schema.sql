CREATE SCHEMA IF NOT EXISTS sfis;
CREATE TABLE IF NOT EXISTS sfis.parent_interests (
 id UUID PRIMARY KEY,
 child_name TEXT NOT NULL,
 upcoming_grade TEXT NOT NULL,
 current_grade TEXT NOT NULL,
 current_school TEXT NOT NULL,
 parent_name TEXT NOT NULL,
 mobile VARCHAR(10) NOT NULL CHECK (mobile ~ '^[6-9][0-9]{9}$'),
 locality TEXT NOT NULL,
 kidsverse_student BOOLEAN NOT NULL,
 contact_consent BOOLEAN NOT NULL CHECK (contact_consent),
 consent_version TEXT NOT NULL DEFAULT 'admissions-contact-v1',
 status TEXT NOT NULL DEFAULT 'new',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS parent_interests_mobile_created ON sfis.parent_interests(mobile, created_at);
REVOKE ALL ON sfis.parent_interests FROM PUBLIC;
