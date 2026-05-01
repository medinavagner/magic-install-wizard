
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
