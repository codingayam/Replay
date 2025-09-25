-- Ensure a public.users table tracks auth.users records
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY,
  email text,
  raw_user_meta_data jsonb,
  created_at timestamptz,
  updated_at timestamptz
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_auth_user_insert_or_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, raw_user_meta_data, created_at, updated_at)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data, NEW.created_at, NEW.updated_at)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        raw_user_meta_data = EXCLUDED.raw_user_meta_data,
        updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_auth_user_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.users WHERE id = OLD.id;
  RETURN OLD;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_insert_or_update'
  ) THEN
    CREATE TRIGGER on_auth_user_insert_or_update
      AFTER INSERT OR UPDATE ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_insert_or_update();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_delete'
  ) THEN
    CREATE TRIGGER on_auth_user_delete
      AFTER DELETE ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_delete();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Users can view their own row'
  ) THEN
    CREATE POLICY "Users can view their own row" ON public.users
      FOR SELECT
      USING ( auth.uid() = id );
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Service role can manage users'
  ) THEN
    CREATE POLICY "Service role can manage users" ON public.users
      FOR ALL
      USING ( auth.role() = 'service_role' )
      WITH CHECK ( auth.role() = 'service_role' );
  END IF;
END;
$$;

GRANT SELECT ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
