
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('student', 'admin', 'class_teacher');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  roll_number TEXT,
  phone TEXT,
  class TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Elections table
CREATE TYPE public.election_type AS ENUM ('council', 'cr');
CREATE TYPE public.election_status AS ENUM ('upcoming', 'active', 'completed');

CREATE TABLE public.elections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  election_type election_type NOT NULL,
  status election_status NOT NULL DEFAULT 'upcoming',
  class TEXT,
  created_by UUID REFERENCES auth.users(id),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.elections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Elections viewable by authenticated" ON public.elections FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage council elections" ON public.elections FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can manage CR elections" ON public.elections FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'class_teacher') AND election_type = 'cr'
);
CREATE POLICY "Teachers can update CR elections" ON public.elections FOR UPDATE USING (
  public.has_role(auth.uid(), 'class_teacher') AND election_type = 'cr' AND created_by = auth.uid()
);

-- Candidates table
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  role_title TEXT NOT NULL,
  class TEXT,
  manifesto TEXT,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Candidates viewable by authenticated" ON public.candidates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage candidates" ON public.candidates FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can manage CR candidates" ON public.candidates FOR INSERT WITH CHECK (
  public.has_role(auth.uid(), 'class_teacher')
);
CREATE POLICY "Teachers can delete CR candidates" ON public.candidates FOR DELETE USING (
  public.has_role(auth.uid(), 'class_teacher')
);

-- Votes table
CREATE TABLE public.votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE NOT NULL,
  election_id UUID REFERENCES public.elections(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, election_id)
);
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert own vote" ON public.votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own votes" ON public.votes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all votes" ON public.votes FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Teachers can view class votes" ON public.votes FOR SELECT USING (public.has_role(auth.uid(), 'class_teacher'));

-- Trigger for profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to get vote counts (for results)
CREATE OR REPLACE FUNCTION public.get_election_results(p_election_id UUID)
RETURNS TABLE(candidate_id UUID, candidate_name TEXT, role_title TEXT, vote_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.role_title, COUNT(v.id) as vote_count
  FROM public.candidates c
  LEFT JOIN public.votes v ON v.candidate_id = c.id
  WHERE c.election_id = p_election_id
  GROUP BY c.id, c.name, c.role_title
  ORDER BY vote_count DESC;
$$;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
