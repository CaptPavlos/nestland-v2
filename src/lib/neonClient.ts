import { neon } from '@neondatabase/serverless'

// Note: fetchConnectionCache is deprecated and now always true by default

const databaseUrl = import.meta.env.VITE_DATABASE_URL as string | undefined

if (!databaseUrl && import.meta.env.DEV) {
  console.warn(
    '[Nestland v2] VITE_DATABASE_URL is not set. Database features are disabled.',
  )
}

// Create the SQL query function
const sql = databaseUrl ? neon(databaseUrl) : null

// Types for query results
export type QueryResult<T> = {
  data: T[] | null
  error: Error | null
}

export type SingleResult<T> = {
  data: T | null
  error: Error | null
}

// Helper to execute queries with error handling
export async function query<T = Record<string, unknown>>(
  queryText: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  if (!sql) {
    return { data: null, error: new Error('Database not configured') }
  }
  try {
    const result = await sql(queryText, params)
    return { data: result as T[], error: null }
  } catch (err) {
    console.error('Database query error:', err)
    return { data: null, error: err as Error }
  }
}

// Helper for single row queries
export async function queryOne<T = Record<string, unknown>>(
  queryText: string,
  params: unknown[] = []
): Promise<SingleResult<T>> {
  const result = await query<T>(queryText, params)
  if (result.error) {
    return { data: null, error: result.error }
  }
  return { data: result.data?.[0] ?? null, error: null }
}

// Helper for insert/update/delete that returns affected rows
export async function execute(
  queryText: string,
  params: unknown[] = []
): Promise<{ success: boolean; error: Error | null; rowCount: number }> {
  if (!sql) {
    return { success: false, error: new Error('Database not configured'), rowCount: 0 }
  }
  try {
    const result = await sql(queryText, params)
    return { success: true, error: null, rowCount: Array.isArray(result) ? result.length : 0 }
  } catch (err) {
    console.error('Database execute error:', err)
    return { success: false, error: err as Error, rowCount: 0 }
  }
}

// Database client object with table-specific methods
export const db = {
  sql,
  query,
  queryOne,
  execute,
  isConfigured: () => !!sql,
}

export default db
