
-- Tabela do catálogo
CREATE TABLE public.programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT,
  publisher TEXT,
  icon_url TEXT,
  installer_path TEXT NOT NULL,
  installer_type TEXT NOT NULL CHECK (installer_type IN ('exe','msi')),
  silent_install_args TEXT NOT NULL DEFAULT '/S',
  silent_uninstall_args TEXT NOT NULL DEFAULT '/S',
  uninstall_registry_key TEXT,
  file_size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read programs" ON public.programs FOR SELECT USING (true);
CREATE POLICY "public insert programs" ON public.programs FOR INSERT WITH CHECK (true);
CREATE POLICY "public update programs" ON public.programs FOR UPDATE USING (true);
CREATE POLICY "public delete programs" ON public.programs FOR DELETE USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER programs_set_updated_at
BEFORE UPDATE ON public.programs
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Bucket público para instaladores
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('installers', 'installers', true, 5368709120)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read installers" ON storage.objects
FOR SELECT USING (bucket_id = 'installers');

CREATE POLICY "public upload installers" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'installers');

CREATE POLICY "public update installers" ON storage.objects
FOR UPDATE USING (bucket_id = 'installers');

CREATE POLICY "public delete installers" ON storage.objects
FOR DELETE USING (bucket_id = 'installers');
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

DROP POLICY IF EXISTS "users read own profile" ON public.profiles;
DROP POLICY IF EXISTS "admins read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "admins update profiles" ON public.profiles;
DROP POLICY IF EXISTS "admins delete profiles" ON public.profiles;
CREATE POLICY "users read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "admins read all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update profiles" ON public.profiles FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete profiles" ON public.profiles FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins delete roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admins read all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins insert roles" ON public.user_roles FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete roles" ON public.user_roles FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE user_count INT;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'pending');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP POLICY IF EXISTS "public insert programs" ON public.programs;
DROP POLICY IF EXISTS "public update programs" ON public.programs;
DROP POLICY IF EXISTS "public delete programs" ON public.programs;
DROP POLICY IF EXISTS "admins insert programs" ON public.programs;
DROP POLICY IF EXISTS "admins update programs" ON public.programs;
DROP POLICY IF EXISTS "admins delete programs" ON public.programs;
CREATE POLICY "admins insert programs" ON public.programs FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update programs" ON public.programs FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete programs" ON public.programs FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "public read installers" ON storage.objects;
DROP POLICY IF EXISTS "admins upload installers" ON storage.objects;
DROP POLICY IF EXISTS "admins update installers" ON storage.objects;
DROP POLICY IF EXISTS "admins delete installers" ON storage.objects;
CREATE POLICY "public read installers" ON storage.objects FOR SELECT USING (bucket_id = 'installers');
CREATE POLICY "admins upload installers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'installers' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins update installers" ON storage.objects FOR UPDATE USING (bucket_id = 'installers' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins delete installers" ON storage.objects FOR DELETE USING (bucket_id = 'installers' AND public.has_role(auth.uid(), 'admin'));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
UPDATE public.programs
SET silent_install_args = '/S',
    silent_uninstall_args = '/S'
WHERE installer_path = '92c4efac-dd9e-4d4d-b618-61fb2e958054-7z2601-x64.exe';