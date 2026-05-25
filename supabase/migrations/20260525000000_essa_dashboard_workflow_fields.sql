-- Adds lifecycle, payment, and ESSA verification fields used by the dashboard workflow.

ALTER TABLE draws
  ADD COLUMN IF NOT EXISTS starts_at date,
  ADD COLUMN IF NOT EXISTS ends_at date;

ALTER TABLE draw_matches
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published'
    CHECK (status IN ('draft', 'published', 'completed', 'cancelled'));

ALTER TABLE announcements
  ADD COLUMN IF NOT EXISTS starts_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS bank_receipt_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS school_receipt_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS essa_verification_status text NOT NULL DEFAULT 'pending'
    CHECK (essa_verification_status IN ('pending', 'verified', 'rejected')),
  ADD COLUMN IF NOT EXISTS essa_rejection_reason text DEFAULT '',
  ADD COLUMN IF NOT EXISTS essa_verified_by uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS essa_verified_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'draws' AND policyname = 'ESSA admins can delete draws') THEN
    CREATE POLICY "ESSA admins can delete draws"
      ON draws FOR DELETE
      TO authenticated
    USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'essa_admin')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'draw_matches' AND policyname = 'ESSA admins can delete draw matches') THEN
    CREATE POLICY "ESSA admins can delete draw matches"
      ON draw_matches FOR DELETE
      TO authenticated
    USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'essa_admin')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'announcements' AND policyname = 'ESSA admins can delete announcements') THEN
    CREATE POLICY "ESSA admins can delete announcements"
      ON announcements FOR DELETE
      TO authenticated
    USING (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'essa_admin')
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_draws_ends_at ON draws(ends_at);
CREATE INDEX IF NOT EXISTS idx_announcements_expires_at ON announcements(expires_at);
CREATE INDEX IF NOT EXISTS idx_players_essa_verification_status ON players(essa_verification_status);
