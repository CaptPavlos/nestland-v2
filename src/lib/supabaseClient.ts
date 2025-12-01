// Re-export the Neon database client with Supabase-compatible API
// This allows minimal changes to App.tsx while using Neon as the backend

export { supabase, auth, storage, getCurrentUser } from './database'
export type { User } from './database'
