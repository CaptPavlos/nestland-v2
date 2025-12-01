import { db } from './neonClient'

// Simple user type (matches profiles table structure)
export type User = {
  id: string
  email: string
  full_name?: string | null
  role?: string | null
}

// Auth state stored in localStorage
const AUTH_STORAGE_KEY = 'nestland_auth_user'

// Get current user from localStorage
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(AUTH_STORAGE_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored) as User
  } catch {
    return null
  }
}

// Set current user in localStorage
export function setCurrentUser(user: User | null): void {
  if (typeof window === 'undefined') return
  if (user) {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(AUTH_STORAGE_KEY)
  }
}

// Simple password hashing (for demo - in production use bcrypt on server)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Sign in with email and password
export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> {
  if (!db.isConfigured()) {
    return { user: null, error: 'Database not configured' }
  }

  const passwordHash = await hashPassword(password)
  
  // Check if user exists with matching password
  const result = await db.queryOne<{
    id: string
    email: string
    full_name: string | null
    role: string | null
    password_hash: string | null
  }>(
    `SELECT id, email, full_name, role, password_hash 
     FROM profiles 
     WHERE email = $1`,
    [email]
  )

  if (result.error) {
    return { user: null, error: 'Login failed. Please try again.' }
  }

  if (!result.data) {
    return { user: null, error: 'Invalid email or password.' }
  }

  // For existing users without password_hash, allow login with any password (migration period)
  // In production, you'd want to force password reset
  if (result.data.password_hash && result.data.password_hash !== passwordHash) {
    return { user: null, error: 'Invalid email or password.' }
  }

  const user: User = {
    id: result.data.id,
    email: result.data.email,
    full_name: result.data.full_name,
    role: result.data.role,
  }

  setCurrentUser(user)
  return { user, error: null }
}

// Sign out
export function signOut(): void {
  setCurrentUser(null)
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return getCurrentUser() !== null
}

// Auth context helpers
export const auth = {
  getCurrentUser,
  setCurrentUser,
  signInWithPassword,
  signOut,
  isAuthenticated,
}

export default auth
