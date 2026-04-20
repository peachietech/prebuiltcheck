import 'server-only'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Server-side client (uses service role key — never expose to browser)
export function createServerClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

// Browser-safe client (uses anon key)
export function createBrowserClient() {
  return createClient(supabaseUrl, supabaseAnonKey)
}
