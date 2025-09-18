import { createClient } from '@supabase/supabase-js';

const importMetaEnv =
  (typeof import.meta !== 'undefined' && (import.meta as any).env) ||
  (globalThis as any).__REPLAY_IMPORT_META_ENV__ ||
  {};

const resolveEnvValue = (key: string, fallback?: string) => {
  return (
    importMetaEnv[key] ??
    process.env[key] ??
    fallback
  );
};

const isTest = process.env.NODE_ENV === 'test';

const supabaseUrl = resolveEnvValue(
  'VITE_SUPABASE_URL',
  isTest ? 'http://localhost:54321' : undefined
);
const supabaseAnonKey = resolveEnvValue(
  'VITE_SUPABASE_ANON_KEY',
  isTest ? 'test-anon-key' : undefined
);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export default supabase;
