import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

let client: SupabaseClient | null = null

if (supabaseUrl && supabaseAnonKey) {
  client = createClient(supabaseUrl, supabaseAnonKey)
} else {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      '[Nest Land Processes] Supabase env vars are not set. Anonymous comments are disabled until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured.',
    )
  }
}

export const supabase = client
