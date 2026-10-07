-- Approval workflow migration. Preserve every existing booking and original preference.
BEGIN;
ALTER TABLE sfis.classroom_bookings ADD COLUMN IF NOT EXISTS booking_code TEXT;
-- Backfill legacy rows with compact codes where a four-digit grade namespace remains.
WITH numbered AS (
 SELECT id, (CASE grade
          WHEN 'Playway' THEN 'K1' WHEN 'Nursery' THEN 'K2' WHEN 'L.K.G' THEN 'K3' WHEN 'U.K.G' THEN 'K4'
          ELSE 'S'||right(grade,1) END)||'-'||lpad((row_number() OVER(PARTITION BY grade ORDER BY created_at,id))::text,4,'0') AS code,
        row_number() OVER(PARTITION BY grade ORDER BY created_at,id) AS n
 FROM sfis.classroom_bookings WHERE booking_code IS NULL
)
UPDATE sfis.classroom_bookings b SET booking_code=n.code FROM numbered n WHERE b.id=n.id AND n.n<=10000;
CREATE UNIQUE INDEX IF NOT EXISTS classroom_bookings_booking_code_key ON sfis.classroom_bookings(booking_code) WHERE booking_code IS NOT NULL;
ALTER TABLE sfis.classroom_bookings DROP CONSTRAINT IF EXISTS classroom_bookings_grade_check;
ALTER TABLE sfis.classroom_bookings ADD CONSTRAINT classroom_bookings_grade_check CHECK (grade IN ('Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Playway','Nursery','L.K.G','U.K.G'));
ALTER TABLE sfis.classroom_bookings ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE sfis.classroom_bookings ADD COLUMN IF NOT EXISTS assigned_section TEXT;
ALTER TABLE sfis.classroom_bookings ADD COLUMN IF NOT EXISTS assigned_slot TEXT;
ALTER TABLE sfis.classroom_bookings ADD COLUMN IF NOT EXISTS rejection_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE sfis.classroom_bookings ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE sfis.classroom_bookings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE sfis.classroom_bookings DROP CONSTRAINT IF EXISTS classroom_bookings_grade_section_slot_key;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='sfis.classroom_bookings'::regclass AND conname='booking_approval_state') THEN
 ALTER TABLE sfis.classroom_bookings ADD CONSTRAINT booking_approval_state CHECK (
 status IN ('pending','approved','rejected') AND
 ((status='approved' AND assigned_section IS NOT NULL AND assigned_slot IS NOT NULL AND assigned_section IN ('Alpha','Beta','Gamma') AND assigned_slot ~ '^[ABC]([1-9]|10)$') OR
 (status<>'approved' AND assigned_section IS NULL AND assigned_slot IS NULL)));
 END IF;
END $$;
-- This intentionally fails and rolls back if legacy duplicate mobile records need manual review.
CREATE UNIQUE INDEX IF NOT EXISTS booking_one_active_mobile ON sfis.classroom_bookings(mobile) WHERE status IN ('pending','approved');
CREATE UNIQUE INDEX IF NOT EXISTS booking_unique_assignment ON sfis.classroom_bookings(grade,assigned_section,assigned_slot) WHERE status='approved';
CREATE INDEX IF NOT EXISTS booking_pending_preferences ON sfis.classroom_bookings(grade,section,slot) WHERE status='pending';
CREATE TABLE IF NOT EXISTS sfis.booking_reviews (
 id BIGSERIAL PRIMARY KEY,
 booking_id UUID NOT NULL REFERENCES sfis.classroom_bookings(id),
 action TEXT NOT NULL CHECK(action IN ('approved','rejected')),
 previous_status TEXT NOT NULL,
 assigned_section TEXT,
 assigned_slot TEXT,
 reason TEXT NOT NULL DEFAULT '',
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sfis.booking_captchas (
 id UUID PRIMARY KEY,
 answer_hash TEXT NOT NULL,
 purpose TEXT NOT NULL CHECK(purpose IN ('booking','tracking')),
 expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS sfis.booking_reservations (
 grade TEXT NOT NULL CHECK (grade IN ('Grade 1','Grade 2','Grade 3','Grade 4','Grade 5','Playway','Nursery','L.K.G','U.K.G')),
 section TEXT NOT NULL CHECK (section IN ('Alpha','Beta','Gamma')),
 slot TEXT NOT NULL CHECK (slot ~ '^[ABC]([1-9]|10)$'),
 label TEXT NOT NULL DEFAULT 'KVS student' CHECK (label = 'KVS student'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 PRIMARY KEY (grade,section,slot)
);
REVOKE ALL ON sfis.booking_reviews,sfis.booking_captchas,sfis.booking_reservations FROM PUBLIC;
COMMIT;
