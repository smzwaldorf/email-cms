-- ============================================
-- Email CMS - Event Registration System Migration
-- Facebook/Luma-style event registration with attendance tracking
-- ============================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. EVENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Basic Information
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  event_type VARCHAR(50) DEFAULT 'GENERAL' CHECK (
    event_type IN ('GENERAL', 'WORKSHOP', 'MEETING', 'CELEBRATION', 'FIELD_TRIP', 'PERFORMANCE', 'OTHER')
  ),

  -- Date & Time
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  event_end_date TIMESTAMP WITH TIME ZONE,
  registration_deadline TIMESTAMP WITH TIME ZONE,

  -- Location
  location VARCHAR(500),
  location_details TEXT,
  is_online BOOLEAN DEFAULT false,
  meeting_url TEXT,

  -- Capacity
  max_participants INTEGER,
  current_participants INTEGER DEFAULT 0,
  allow_waitlist BOOLEAN DEFAULT false,

  -- Pricing
  has_fee BOOLEAN DEFAULT false,
  price_per_person DECIMAL(10, 2) DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'TWD',

  -- Food Options
  provides_food BOOLEAN DEFAULT false,
  food_options TEXT[], -- Array of available food options

  -- Registration Settings
  requires_approval BOOLEAN DEFAULT false,
  allow_plus_ones BOOLEAN DEFAULT true,
  max_attendees_per_registration INTEGER DEFAULT 10,

  -- Visibility
  target_audience VARCHAR(50)[] DEFAULT ARRAY['PARENT']::VARCHAR[], -- Can be PARENT, TEACHER, STUDENT, or specific classes
  is_published BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,

  -- Media
  cover_image_url TEXT,
  attachments TEXT[], -- Array of attachment URLs

  -- Metadata
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE,

  -- Additional Info
  tags VARCHAR(100)[],
  custom_fields JSONB -- For flexible additional data
);

-- Create indexes for events
CREATE INDEX idx_events_event_date ON public.events(event_date);
CREATE INDEX idx_events_is_published ON public.events(is_published);
CREATE INDEX idx_events_created_by ON public.events(created_by);
CREATE INDEX idx_events_event_type ON public.events(event_type);
CREATE INDEX idx_events_target_audience ON public.events USING GIN(target_audience);

-- ============================================
-- 2. EVENT REGISTRATIONS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS public.event_registrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  family_id UUID REFERENCES public.families(id) ON DELETE SET NULL,

  -- Registration Details
  num_attendees INTEGER NOT NULL DEFAULT 1,
  attendee_names TEXT[], -- Names of all attendees
  attendee_ages INTEGER[], -- Ages (optional, for planning)

  -- Food Preferences
  food_preferences JSONB, -- {attendee_index: food_option}
  dietary_restrictions TEXT,
  special_requirements TEXT,

  -- Payment
  total_amount DECIMAL(10, 2) DEFAULT 0,
  payment_status VARCHAR(50) DEFAULT 'PENDING' CHECK (
    payment_status IN ('PENDING', 'PAID', 'REFUNDED', 'CANCELLED', 'WAIVED')
  ),
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  paid_at TIMESTAMP WITH TIME ZONE,

  -- Status
  registration_status VARCHAR(50) DEFAULT 'CONFIRMED' CHECK (
    registration_status IN ('PENDING', 'CONFIRMED', 'WAITLIST', 'CANCELLED', 'REJECTED')
  ),

  -- Attendance Tracking
  checked_in BOOLEAN DEFAULT false,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  checked_in_by UUID REFERENCES public.profiles(id),
  actual_attendees INTEGER, -- Actual number who showed up

  -- Metadata
  registered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancellation_reason TEXT,

  -- Contact Info (cached from user profile)
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),

  -- Additional Notes
  notes TEXT,
  admin_notes TEXT, -- Private notes for organizers

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_user_per_event UNIQUE (event_id, user_id),
  CONSTRAINT positive_attendees CHECK (num_attendees > 0)
);

-- Create indexes for registrations
CREATE INDEX idx_registrations_event_id ON public.event_registrations(event_id);
CREATE INDEX idx_registrations_user_id ON public.event_registrations(user_id);
CREATE INDEX idx_registrations_family_id ON public.event_registrations(family_id);
CREATE INDEX idx_registrations_status ON public.event_registrations(registration_status);
CREATE INDEX idx_registrations_payment_status ON public.event_registrations(payment_status);
CREATE INDEX idx_registrations_checked_in ON public.event_registrations(checked_in);

-- ============================================
-- 3. EVENT ATTENDANCE LOG (Optional detailed tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS public.event_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  registration_id UUID NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,

  -- Attendance Details
  attendee_name VARCHAR(200),
  attendee_index INTEGER, -- Index in the registration's attendee list

  -- Check-in
  checked_in BOOLEAN DEFAULT false,
  checked_in_at TIMESTAMP WITH TIME ZONE,
  checked_in_by UUID REFERENCES public.profiles(id),

  -- Feedback
  attended BOOLEAN DEFAULT true,
  no_show BOOLEAN DEFAULT false,
  feedback TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_attendance_registration_id ON public.event_attendance(registration_id);
CREATE INDEX idx_attendance_event_id ON public.event_attendance(event_id);

-- ============================================
-- 4. EVENT COMMENTS/MESSAGES (Optional - for Q&A)
-- ============================================

CREATE TABLE IF NOT EXISTS public.event_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- References
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES public.event_comments(id) ON DELETE CASCADE,

  -- Content
  content TEXT NOT NULL,

  -- Metadata
  is_organizer BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_event_comments_event_id ON public.event_comments(event_id);
CREATE INDEX idx_event_comments_user_id ON public.event_comments(user_id);
CREATE INDEX idx_event_comments_parent ON public.event_comments(parent_comment_id);

-- ============================================
-- 5. TRIGGERS
-- ============================================

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_registrations_updated_at BEFORE UPDATE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON public.event_attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.event_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update current_participants count
CREATE OR REPLACE FUNCTION update_event_participants_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE public.events
    SET current_participants = (
      SELECT COALESCE(SUM(num_attendees), 0)
      FROM public.event_registrations
      WHERE event_id = NEW.event_id
        AND registration_status = 'CONFIRMED'
    )
    WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events
    SET current_participants = (
      SELECT COALESCE(SUM(num_attendees), 0)
      FROM public.event_registrations
      WHERE event_id = OLD.event_id
        AND registration_status = 'CONFIRMED'
    )
    WHERE id = OLD.event_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_event_participants_after_registration
  AFTER INSERT OR UPDATE OR DELETE ON public.event_registrations
  FOR EACH ROW EXECUTE FUNCTION update_event_participants_count();

-- ============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_comments ENABLE ROW LEVEL SECURITY;

-- Events Policies
CREATE POLICY "Published events are viewable by all authenticated users"
  ON public.events FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (
      is_published = true
      OR created_by = auth.uid()
      OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('ADMIN', 'CLASS_TEACHER'))
    )
  );

CREATE POLICY "Admins and teachers can create events"
  ON public.events FOR INSERT
  WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('ADMIN', 'CLASS_TEACHER'))
  );

CREATE POLICY "Event creators and admins can update events"
  ON public.events FOR UPDATE
  USING (
    created_by = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'ADMIN')
  );

CREATE POLICY "Only admins can delete events"
  ON public.events FOR DELETE
  USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'ADMIN')
  );

-- Event Registrations Policies
CREATE POLICY "Users can view their own registrations"
  ON public.event_registrations FOR SELECT
  USING (
    user_id = auth.uid()
    OR auth.uid() IN (
      SELECT created_by FROM public.events WHERE id = event_id
    )
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'ADMIN')
  );

CREATE POLICY "Authenticated users can register for events"
  ON public.event_registrations FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "Users can update their own registrations"
  ON public.event_registrations FOR UPDATE
  USING (
    user_id = auth.uid()
    OR auth.uid() IN (
      SELECT created_by FROM public.events WHERE id = event_id
    )
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'ADMIN')
  );

CREATE POLICY "Users can cancel their own registrations"
  ON public.event_registrations FOR DELETE
  USING (
    user_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'ADMIN')
  );

-- Event Comments Policies
CREATE POLICY "Event comments are viewable by event viewers"
  ON public.event_comments FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND event_id IN (
      SELECT id FROM public.events WHERE is_published = true
    )
  );

CREATE POLICY "Authenticated users can comment on events"
  ON public.event_comments FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "Users can update their own comments"
  ON public.event_comments FOR UPDATE
  USING (
    user_id = auth.uid()
    OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'ADMIN')
  );

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

-- Function to check if event is full
CREATE OR REPLACE FUNCTION is_event_full(event_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  event_record RECORD;
BEGIN
  SELECT max_participants, current_participants
  INTO event_record
  FROM public.events
  WHERE id = event_id_param;

  IF event_record.max_participants IS NULL THEN
    RETURN FALSE; -- No capacity limit
  END IF;

  RETURN event_record.current_participants >= event_record.max_participants;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate total registration fee
CREATE OR REPLACE FUNCTION calculate_registration_fee(
  event_id_param UUID,
  num_attendees_param INTEGER
)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  price_per_person DECIMAL(10, 2);
BEGIN
  SELECT events.price_per_person
  INTO price_per_person
  FROM public.events
  WHERE id = event_id_param;

  RETURN price_per_person * num_attendees_param;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 8. SAMPLE DATA (Optional - for testing)
-- ============================================

-- Sample event
INSERT INTO public.events (
  title,
  description,
  event_type,
  event_date,
  event_end_date,
  registration_deadline,
  location,
  max_participants,
  has_fee,
  price_per_person,
  provides_food,
  food_options,
  allow_plus_ones,
  target_audience,
  is_published,
  created_by
)
SELECT
  '親子工作坊：手作課程',
  '歡迎家長與孩子一同參加手作課程，學習傳統工藝技術。課程包含材料費用，並提供茶點。',
  'WORKSHOP',
  NOW() + INTERVAL '14 days',
  NOW() + INTERVAL '14 days' + INTERVAL '3 hours',
  NOW() + INTERVAL '7 days',
  '學校多功能教室',
  30,
  true,
  500.00,
  true,
  ARRAY['素食', '葷食', '無特殊需求'],
  true,
  ARRAY['PARENT'],
  true,
  id
FROM public.profiles
WHERE role = 'ADMIN'
LIMIT 1
ON CONFLICT DO NOTHING;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

-- Grant permissions
GRANT ALL ON public.events TO authenticated;
GRANT ALL ON public.event_registrations TO authenticated;
GRANT ALL ON public.event_attendance TO authenticated;
GRANT ALL ON public.event_comments TO authenticated;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
