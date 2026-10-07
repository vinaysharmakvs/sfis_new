-- Additive migration: existing enquiries and their stored values are unchanged.
CREATE SCHEMA IF NOT EXISTS sfis;
CREATE TABLE IF NOT EXISTS sfis.classroom_bookings (
 id UUID PRIMARY KEY,
 booking_code TEXT,
 grade TEXT NOT NULL CHECK (grade IN ('Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Playway','Nursery','L.K.G','U.K.G')),
 section TEXT NOT NULL CHECK (section IN ('Alpha','Beta','Gamma')),
 slot TEXT NOT NULL CHECK (slot ~ '^[ABC]([1-9]|10)$'),
 child_name TEXT NOT NULL,
 child_dob DATE NOT NULL,
 father_name TEXT NOT NULL,
 mother_name TEXT NOT NULL,
 locality TEXT NOT NULL,
 mobile VARCHAR(10) NOT NULL CHECK (mobile ~ '^[6-9][0-9]{9}$'),
 contact_consent BOOLEAN NOT NULL CHECK (contact_consent),
 consent_version TEXT NOT NULL DEFAULT 'booking-contact-v1',
 payload_hash TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 UNIQUE (grade, section, slot)
);
CREATE INDEX IF NOT EXISTS classroom_bookings_mobile_created ON sfis.classroom_bookings(mobile,created_at);
CREATE TABLE IF NOT EXISTS sfis.booking_rate_limits (
 key TEXT PRIMARY KEY,
 attempts INTEGER NOT NULL,
 started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
REVOKE ALL ON sfis.classroom_bookings, sfis.booking_rate_limits FROM PUBLIC;
