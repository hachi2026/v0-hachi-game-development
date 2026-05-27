import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  
  // During build time, return a dummy client that won't be used
  if (!supabaseUrl || !supabaseAnonKey) {
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder-key'
    )
  }
  
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
