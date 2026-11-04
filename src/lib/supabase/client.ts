import { createClient as createSupabaseBrowserClient } from "@supabase/supabase-js";

let client: ReturnType<typeof createSupabaseBrowserClient> | null = null;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase belum dikonfigurasi. Tambahkan NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }

  if (!client) client = createSupabaseBrowserClient(url, key);
  return client;
}
