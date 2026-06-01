-- Booking System — Slots, Appointments, Feedback (Phase 7)

CREATE TABLE IF NOT EXISTS booking_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  title TEXT NOT NULL DEFAULT 'Créneau disponible',
  type TEXT NOT NULL DEFAULT 'consultation',
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_slots_tenant ON booking_slots(tenant_id);
CREATE INDEX IF NOT EXISTS idx_booking_slots_range ON booking_slots(tenant_id, start_at, end_at);
CREATE INDEX IF NOT EXISTS idx_booking_slots_status ON booking_slots(tenant_id, status);

CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  slot_id UUID REFERENCES booking_slots(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'cancelled', 'completed', 'no_show')),
  notes TEXT DEFAULT '',
  source TEXT DEFAULT 'app',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON appointments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_appointments_student ON appointments(student_id);
CREATE INDEX IF NOT EXISTS idx_appointments_slot ON appointments(slot_id);

CREATE TABLE IF NOT EXISTS appointment_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(appointment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feedback_appointment ON appointment_feedback(appointment_id);
CREATE INDEX IF NOT EXISTS idx_feedback_tenant ON appointment_feedback(tenant_id);

-- RLS

ALTER TABLE booking_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_feedback ENABLE ROW LEVEL SECURITY;

-- Slots: visible by all members, managed by staff
DROP POLICY IF EXISTS "Slots visibles par membres" ON booking_slots;
CREATE POLICY "Slots visibles par membres" ON booking_slots FOR SELECT USING (
  EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = booking_slots.tenant_id AND user_id = auth.uid() AND status = 'active')
);

-- Appointments: students see their own, staff see all
DROP POLICY IF EXISTS "Appointments visibles par concernés" ON appointments;
CREATE POLICY "Appointments visibles par concernés" ON appointments FOR SELECT USING (
  student_id = auth.uid() OR
  EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = appointments.tenant_id AND user_id = auth.uid() AND role IN ('owner','admin','teacher','secretariat') AND status = 'active')
);

-- Feedback: visible by tenant members
DROP POLICY IF EXISTS "Feedback visible par membres" ON appointment_feedback;
CREATE POLICY "Feedback visible par membres" ON appointment_feedback FOR SELECT USING (
  EXISTS(SELECT 1 FROM tenant_memberships WHERE tenant_id = appointment_feedback.tenant_id AND user_id = auth.uid() AND status = 'active')
);
