
-- Drop and recreate the function with updated return type
DROP FUNCTION IF EXISTS public.get_election_results(uuid);

CREATE OR REPLACE FUNCTION public.get_election_results(p_election_id UUID)
RETURNS TABLE(candidate_id UUID, candidate_name TEXT, role_title TEXT, vote_count BIGINT, candidate_class TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.role_title, COUNT(v.id) as vote_count, c.class
  FROM public.candidates c
  LEFT JOIN public.votes v ON v.candidate_id = c.id
  WHERE c.election_id = p_election_id
  GROUP BY c.id, c.name, c.role_title, c.class
  ORDER BY c.role_title, vote_count DESC;
$$;
