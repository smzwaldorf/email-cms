-- Historical database snapshot retired: it contained delivery history and personal fixtures.
-- Use npm run seed:demo for the synthetic, insert-only fixture.
-- This file intentionally cannot be used as a production import source.
DO $$ BEGIN RAISE EXCEPTION 'Historical seed dump retired; use npm run seed:demo'; END $$;
