ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Add email column to otp_codes for email-based OTP
ALTER TABLE public.otp_codes ADD COLUMN IF NOT EXISTS email TEXT;

-- Update seed data with emails
UPDATE public.profiles SET email = 'rahul.sharma@gnits.ac.in' WHERE roll_number = 'CS2024001';
UPDATE public.profiles SET email = 'priya.patel@gnits.ac.in' WHERE roll_number = 'CS2024002';
UPDATE public.profiles SET email = 'admin@gnits.ac.in' WHERE roll_number = 'ADMIN001';
UPDATE public.profiles SET email = 'sunita.verma@gnits.ac.in' WHERE roll_number = 'TCH001';