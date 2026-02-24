import { createBrowserClient } from "@supabase/ssr"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables")
}

// createBrowserClient from @supabase/ssr handles SSR/hydration correctly on Vercel
// and avoids AbortError from _acquireLock during auth initialization
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)

