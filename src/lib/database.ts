import { neon } from '@neondatabase/serverless'

// Note: fetchConnectionCache is deprecated and now always true by default

const databaseUrl = import.meta.env.VITE_DATABASE_URL as string | undefined

if (!databaseUrl && import.meta.env.DEV) {
  console.warn('[Nestland v2] VITE_DATABASE_URL is not set.')
}

const sql = databaseUrl ? neon(databaseUrl) : null

// ============================================
// Types
// ============================================

export type User = {
  id: string
  email: string
  full_name?: string | null
  role?: string | null
}

export type QueryResult<T> = { data: T[] | null; error: Error | null }
export type SingleResult<T> = { data: T | null; error: Error | null }

// ============================================
// Auth (localStorage-based)
// ============================================

const AUTH_KEY = 'nestland_auth_user'

export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null
  const stored = localStorage.getItem(AUTH_KEY)
  if (!stored) return null
  try {
    return JSON.parse(stored) as User
  } catch {
    return null
  }
}

function setCurrentUser(user: User | null): void {
  if (typeof window === 'undefined') return
  if (user) {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user))
  } else {
    localStorage.removeItem(AUTH_KEY)
  }
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export const auth = {
  getUser: async (): Promise<{ data: { user: User | null } }> => {
    return { data: { user: getCurrentUser() } }
  },

  signInWithPassword: async ({ email, password }: { email: string; password: string }): Promise<{
    data: { user: User | null }
    error: Error | null
  }> => {
    if (!sql) {
      return { data: { user: null }, error: new Error('Database not configured') }
    }

    try {
      const passwordHash = await hashPassword(password)
      const result = await sql`
        SELECT id, email, full_name, role, password_hash 
        FROM profiles 
        WHERE email = ${email}
      `

      if (!result || result.length === 0) {
        return { data: { user: null }, error: new Error('Invalid email or password.') }
      }

      const row = result[0] as { id: string; email: string; full_name: string | null; role: string | null; password_hash: string | null }
      
      // Allow login if no password_hash set (migration period) or if it matches
      if (row.password_hash && row.password_hash !== passwordHash) {
        return { data: { user: null }, error: new Error('Invalid email or password.') }
      }

      const user: User = {
        id: row.id,
        email: row.email,
        full_name: row.full_name,
        role: row.role,
      }

      setCurrentUser(user)
      return { data: { user }, error: null }
    } catch (err) {
      return { data: { user: null }, error: err as Error }
    }
  },

  signOut: async (): Promise<void> => {
    setCurrentUser(null)
  },
}

// ============================================
// Database Query Builder (Supabase-like API)
// ============================================

type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in'

interface QueryBuilder<T> {
  select: (columns?: string) => QueryBuilder<T>
  insert: (data: Partial<T> | Partial<T>[]) => QueryBuilder<T>
  update: (data: Partial<T>) => QueryBuilder<T>
  delete: () => QueryBuilder<T>
  upsert: (data: Partial<T>) => QueryBuilder<T>
  eq: (column: string, value: unknown) => QueryBuilder<T>
  neq: (column: string, value: unknown) => QueryBuilder<T>
  gt: (column: string, value: unknown) => QueryBuilder<T>
  gte: (column: string, value: unknown) => QueryBuilder<T>
  lt: (column: string, value: unknown) => QueryBuilder<T>
  lte: (column: string, value: unknown) => QueryBuilder<T>
  in: (column: string, values: unknown[]) => QueryBuilder<T>
  or: (conditions: string) => QueryBuilder<T>
  order: (column: string, options?: { ascending?: boolean }) => QueryBuilder<T>
  limit: (count: number) => QueryBuilder<T>
  single: () => Promise<SingleResult<T>>
  maybeSingle: () => Promise<SingleResult<T>>
  then: <TResult>(onfulfilled?: (value: QueryResult<T>) => TResult) => Promise<TResult>
}

function createQueryBuilder<T>(tableName: string): QueryBuilder<T> {
  let operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select'
  let columns = '*'
  let insertData: Partial<T> | Partial<T>[] | null = null
  let updateData: Partial<T> | null = null
  const filters: { column: string; operator: FilterOperator; value: unknown }[] = []
  let orderBy: { column: string; ascending: boolean } | null = null
  let limitCount: number | null = null

  const builder: QueryBuilder<T> = {
    select(cols = '*') {
      // Only set operation to 'select' if no other operation (insert/update/delete/upsert) has been set
      // This allows chaining like .insert().select() to specify RETURNING columns
      if (operation === 'select') {
        operation = 'select'
      }
      columns = cols
      return builder
    },

    insert(data) {
      operation = 'insert'
      insertData = data
      return builder
    },

    update(data) {
      operation = 'update'
      updateData = data
      return builder
    },

    delete() {
      operation = 'delete'
      return builder
    },

    upsert(data) {
      operation = 'upsert'
      insertData = data
      return builder
    },

    eq(column, value) {
      filters.push({ column, operator: 'eq', value })
      return builder
    },

    neq(column, value) {
      filters.push({ column, operator: 'neq', value })
      return builder
    },

    gt(column, value) {
      filters.push({ column, operator: 'gt', value })
      return builder
    },

    gte(column, value) {
      filters.push({ column, operator: 'gte', value })
      return builder
    },

    lt(column, value) {
      filters.push({ column, operator: 'lt', value })
      return builder
    },

    lte(column, value) {
      filters.push({ column, operator: 'lte', value })
      return builder
    },

    in(column, values) {
      filters.push({ column, operator: 'in', value: values })
      return builder
    },

    or(conditions) {
      // Parse Supabase-style OR conditions like "from_step_id.eq.uuid,to_step_id.eq.uuid"
      // Store as a special filter that will be handled in buildWhereClause
      filters.push({ column: '__or__', operator: 'eq', value: conditions })
      return builder
    },

    order(column, options = {}) {
      orderBy = { column, ascending: options.ascending ?? true }
      return builder
    },

    limit(count) {
      limitCount = count
      return builder
    },

    single() {
      return builder.then(result => ({
        data: result.data?.[0] ?? null,
        error: result.error,
      })) as Promise<SingleResult<T>>
    },

    maybeSingle() {
      return builder.then(result => ({
        data: result.data?.[0] ?? null,
        error: result.error,
      })) as Promise<SingleResult<T>>
    },

    async then<TResult>(onfulfilled?: (value: QueryResult<T>) => TResult): Promise<TResult> {
      if (!sql) {
        const result = { data: null, error: new Error('Database not configured') }
        return onfulfilled ? onfulfilled(result) : result as TResult
      }

      try {
        let queryText = ''
        const params: unknown[] = []
        let paramIndex = 1

        const buildWhereClause = () => {
          if (filters.length === 0) return ''
          const conditions = filters.map(f => {
            // Handle special OR conditions (Supabase-style)
            if (f.column === '__or__') {
              // Parse "from_step_id.eq.uuid,to_step_id.eq.uuid" format
              const orConditions = (f.value as string).split(',').map(cond => {
                const parts = cond.trim().split('.')
                if (parts.length >= 3) {
                  const col = parts[0]
                  const op = parts[1]
                  const val = parts.slice(2).join('.')
                  if (op === 'eq') {
                    params.push(val)
                    return `"${col}" = $${paramIndex++}`
                  }
                }
                return null
              }).filter(Boolean)
              return `(${orConditions.join(' OR ')})`
            }
            if (f.operator === 'in') {
              const values = f.value as unknown[]
              const placeholders = values.map(() => `$${paramIndex++}`).join(', ')
              params.push(...values)
              return `"${f.column}" IN (${placeholders})`
            }
            const op = f.operator === 'eq' ? '=' :
                       f.operator === 'neq' ? '!=' :
                       f.operator === 'gt' ? '>' :
                       f.operator === 'gte' ? '>=' :
                       f.operator === 'lt' ? '<' :
                       f.operator === 'lte' ? '<=' :
                       f.operator === 'like' ? 'LIKE' :
                       f.operator === 'ilike' ? 'ILIKE' : '='
            params.push(f.value)
            return `"${f.column}" ${op} $${paramIndex++}`
          })
          return ' WHERE ' + conditions.join(' AND ')
        }

        if (operation === 'select') {
          queryText = `SELECT ${columns} FROM "${tableName}"${buildWhereClause()}`
          if (orderBy) {
            queryText += ` ORDER BY "${orderBy.column}" ${orderBy.ascending ? 'ASC' : 'DESC'}`
          }
          if (limitCount !== null) {
            queryText += ` LIMIT ${limitCount}`
          }
        } else if (operation === 'insert') {
          const data = Array.isArray(insertData) ? insertData[0] : insertData
          if (!data) throw new Error('No data to insert')
          const keys = Object.keys(data)
          const values = Object.values(data)
          const placeholders = values.map(() => `$${paramIndex++}`).join(', ')
          params.push(...values)
          queryText = `INSERT INTO "${tableName}" ("${keys.join('", "')}") VALUES (${placeholders}) RETURNING ${columns}`
        } else if (operation === 'update') {
          if (!updateData) throw new Error('No data to update')
          const sets = Object.entries(updateData).map(([key, value]) => {
            params.push(value)
            return `"${key}" = $${paramIndex++}`
          })
          queryText = `UPDATE "${tableName}" SET ${sets.join(', ')}${buildWhereClause()} RETURNING ${columns}`
        } else if (operation === 'delete') {
          queryText = `DELETE FROM "${tableName}"${buildWhereClause()} RETURNING ${columns}`
        } else if (operation === 'upsert') {
          const data = insertData as Partial<T>
          if (!data) throw new Error('No data to upsert')
          const keys = Object.keys(data)
          const values = Object.values(data)
          const placeholders = values.map(() => `$${paramIndex++}`).join(', ')
          params.push(...values)
          const updateSets = keys.filter(k => k !== 'id' && k !== 'slug').map(k => `"${k}" = EXCLUDED."${k}"`).join(', ')
          // Use slug as conflict target for company_wiki, id for others
          const conflictColumn = tableName === 'company_wiki' ? 'slug' : 'id'
          queryText = `INSERT INTO "${tableName}" ("${keys.join('", "')}") VALUES (${placeholders}) 
                       ON CONFLICT ("${conflictColumn}") DO UPDATE SET ${updateSets} RETURNING ${columns}`
        }

        const result = await sql(queryText, params)
        // Cast result to expected type - the caller knows the shape
        const queryResult = { data: result as unknown as T[], error: null }
        return onfulfilled ? onfulfilled(queryResult) : queryResult as TResult
      } catch (err) {
        console.error('Query error:', err)
        const queryResult = { data: null, error: err as Error }
        return onfulfilled ? onfulfilled(queryResult) : queryResult as TResult
      }
    },
  }

  return builder
}

// ============================================
// RPC Functions
// ============================================

async function rpc<T = unknown>(
  functionName: string,
  params: Record<string, unknown> = {}
): Promise<{ data: T | null; error: Error | null }> {
  if (!sql) {
    return { data: null, error: new Error('Database not configured') }
  }

  try {
    if (functionName === 'get_project_overview') {
      const result = await sql`SELECT get_project_overview() as data`
      const data = result[0]?.data
      return { data: data as T, error: null }
    }

    if (functionName === 'insert_process_step_with_shift') {
      const result = await sql`
        SELECT * FROM insert_process_step_with_shift(
          ${params.process_id}::uuid,
          ${params.title}::text,
          ${params.role}::text,
          ${params.order_index}::integer,
          ${params.description}::text,
          ${params.duration_days}::numeric,
          ${params.expected_step_count}::integer
        )
      `
      return { data: result[0] as T, error: null }
    }

    return { data: null, error: new Error(`Unknown RPC function: ${functionName}`) }
  } catch (err) {
    return { data: null, error: err as Error }
  }
}

// ============================================
// Storage (stub - file storage not supported in Neon)
// ============================================

type StorageFile = {
  name: string
  id?: string
  updated_at?: string
  created_at?: string
  last_accessed_at?: string
  metadata?: { size?: number }
}

export const storage = {
  from: (bucket: string) => ({
    list: async (_prefix?: string, _options?: unknown): Promise<{ data: StorageFile[] | null; error: Error | null }> => {
      void _prefix; void _options;
      console.warn(`Storage not available in Neon. Bucket: ${bucket}. Consider using Cloudflare R2 or AWS S3.`)
      return { data: [], error: null }
    },
    upload: async (_path?: string, _file?: File, _options?: unknown): Promise<{ data: null; error: Error | null }> => {
      void _path; void _file; void _options;
      console.warn(`Storage not available in Neon. Bucket: ${bucket}`)
      return { data: null, error: new Error('File storage not available. Consider using Cloudflare R2 or AWS S3.') }
    },
    remove: async (_paths?: string[]): Promise<{ data: null; error: Error | null }> => {
      void _paths;
      console.warn(`Storage not available in Neon. Bucket: ${bucket}`)
      return { data: null, error: new Error('File storage not available.') }
    },
    createSignedUrl: async (_path?: string, _expiresIn?: number): Promise<{ data: { signedUrl: string } | null; error: Error | null }> => {
      void _path; void _expiresIn;
      return { data: null, error: new Error('File storage not available.') }
    },
  }),
}

// ============================================
// Main Database Client (Supabase-compatible API)
// ============================================

export const database = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: <T = any>(table: string) => createQueryBuilder<T>(table),
  rpc,
  auth,
  storage,
  isConfigured: () => !!sql,
}

// Export as 'supabase' for easier migration
export const supabase = database

export default database
