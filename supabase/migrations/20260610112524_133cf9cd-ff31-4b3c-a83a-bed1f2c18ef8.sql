
-- 1) Extend app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'faculty';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordinator';
