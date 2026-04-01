
-- Create nomination_elections table
CREATE TABLE public.nomination_elections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create nomination_roles table
CREATE TABLE public.nomination_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  election_id UUID NOT NULL REFERENCES public.nomination_elections(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create nomination_applications table
CREATE TABLE public.nomination_applications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  election_id UUID NOT NULL REFERENCES public.nomination_elections(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.nomination_roles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  student_name TEXT NOT NULL,
  roll_number TEXT NOT NULL,
  class TEXT NOT NULL,
  year TEXT NOT NULL,
  photo_url TEXT,
  achievements TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(election_id, role_id, user_id)
);

-- Enable RLS
ALTER TABLE public.nomination_elections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomination_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nomination_applications ENABLE ROW LEVEL SECURITY;

-- nomination_elections policies
CREATE POLICY "Anyone authenticated can view nomination elections"
  ON public.nomination_elections FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage nomination elections"
  ON public.nomination_elections FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- nomination_roles policies
CREATE POLICY "Anyone authenticated can view nomination roles"
  ON public.nomination_roles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage nomination roles"
  ON public.nomination_roles FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- nomination_applications policies
CREATE POLICY "Students can view all applications"
  ON public.nomination_applications FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Students can insert own application"
  ON public.nomination_applications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all applications"
  ON public.nomination_applications FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Storage bucket for nomination photos
INSERT INTO storage.buckets (id, name, public) VALUES ('nomination-photos', 'nomination-photos', true);

-- Storage policies
CREATE POLICY "Anyone can view nomination photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'nomination-photos');

CREATE POLICY "Authenticated users can upload nomination photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'nomination-photos');
