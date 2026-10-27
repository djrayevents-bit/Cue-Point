import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 20 } },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Mobile Safari / multi-request auth can hit Navigator LockManager races:
    // "Lock … auth-token was released because another request stole it"
    lock: async (_name, _acquireTimeout, fn) => fn(),
  },
})
