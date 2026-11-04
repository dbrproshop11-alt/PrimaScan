import { createBrowserClient } from "@supabase/ssr";

// These are public Supabase client credentials. Row Level Security protects the database.
// Environment variables can override them when deploying another environment.
const defaultUrl = "https://dbmocmvhzdnsekkqmmqx.supabase.co";
const defaultPublishableKey = "sb_publishable_07QCwEoJLsputSmuWI9Now_XgwyeBmq";

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || defaultUrl;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || defaultPublishableKey;

  if (!client) client = createBrowserClient(url, key);
  return client;
}
