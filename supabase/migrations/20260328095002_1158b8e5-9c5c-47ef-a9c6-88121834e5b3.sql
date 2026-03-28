-- Add role_title column to votes
ALTER TABLE public.votes ADD COLUMN role_title text;

-- Backfill role_title from candidates for existing votes
UPDATE public.votes v
SET role_title = c.role_title
FROM public.candidates c
WHERE v.candidate_id = c.id AND v.role_title IS NULL;

-- Set default for any remaining nulls
UPDATE public.votes SET role_title = 'Unknown' WHERE role_title IS NULL;

-- Make role_title NOT NULL
ALTER TABLE public.votes ALTER COLUMN role_title SET NOT NULL;

-- Add unique constraint to prevent duplicate votes per role per election
ALTER TABLE public.votes ADD CONSTRAINT unique_user_election_role UNIQUE (user_id, election_id, role_title);