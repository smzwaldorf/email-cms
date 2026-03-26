-- Family is now an association entity (guardian <> family <> student),
-- so guardian_email should no longer be mandatory at the family row level.
alter table public.families
  alter column guardian_email drop not null;
