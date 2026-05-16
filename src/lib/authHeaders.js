import { supabase } from '../supabaseClient';

export async function authHeaders(extra = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
