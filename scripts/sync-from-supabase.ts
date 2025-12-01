import { neon } from '@neondatabase/serverless'
import { config } from 'dotenv'

// Load .env.local
config({ path: '.env.local' })

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eljnlmwarnydjbiewwuj.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const NEON_URL = process.env.VITE_DATABASE_URL || ''

if (!SUPABASE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY not set in .env.local')
  process.exit(1)
}
if (!NEON_URL) {
  console.error('❌ VITE_DATABASE_URL not set in .env.local')
  process.exit(1)
}

const sql = neon(NEON_URL)

async function fetchFromSupabase(table: string) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
    },
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch ${table}: ${response.statusText}`)
  }
  return response.json()
}

async function upsertProcesses(processes: any[]) {
  console.log(`Syncing ${processes.length} processes...`)
  for (const p of processes) {
    await sql`
      INSERT INTO processes (id, created_at, slug, name, description, owner_role, category)
      VALUES (${p.id}, ${p.created_at}, ${p.slug}, ${p.name}, ${p.description}, ${p.owner_role}, ${p.category})
      ON CONFLICT (id) DO UPDATE SET
        slug = EXCLUDED.slug,
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        owner_role = EXCLUDED.owner_role,
        category = EXCLUDED.category
    `
  }
  console.log('✓ Processes synced')
}

async function upsertProcessSteps(steps: any[]) {
  console.log(`Syncing ${steps.length} process steps...`)
  for (const s of steps) {
    await sql`
      INSERT INTO process_steps (id, created_at, process_id, title, description, role, order_index, lane, duration_days)
      VALUES (${s.id}, ${s.created_at}, ${s.process_id}, ${s.title}, ${s.description}, ${s.role}, ${s.order_index}, ${s.lane}, ${s.duration_days})
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        role = EXCLUDED.role,
        order_index = EXCLUDED.order_index,
        lane = EXCLUDED.lane,
        duration_days = EXCLUDED.duration_days
    `
  }
  console.log('✓ Process steps synced')
}

async function upsertProcessTransitions(transitions: any[]) {
  console.log(`Syncing ${transitions.length} process transitions...`)
  for (const t of transitions) {
    await sql`
      INSERT INTO process_transitions (id, created_at, process_id, from_step_id, to_step_id, label)
      VALUES (${t.id}, ${t.created_at}, ${t.process_id}, ${t.from_step_id}, ${t.to_step_id}, ${t.label})
      ON CONFLICT (id) DO UPDATE SET
        from_step_id = EXCLUDED.from_step_id,
        to_step_id = EXCLUDED.to_step_id,
        label = EXCLUDED.label
    `
  }
  console.log('✓ Process transitions synced')
}

async function main() {
  console.log('🔄 Starting sync from Supabase to Neon...\n')

  try {
    // Fetch all data from Supabase
    const [processes, steps, transitions] = await Promise.all([
      fetchFromSupabase('processes'),
      fetchFromSupabase('process_steps'),
      fetchFromSupabase('process_transitions'),
    ])

    console.log(`Found: ${processes.length} processes, ${steps.length} steps, ${transitions.length} transitions\n`)

    // Sync in order (processes first, then steps, then transitions due to FK constraints)
    await upsertProcesses(processes)
    await upsertProcessSteps(steps)
    await upsertProcessTransitions(transitions)

    console.log('\n✅ Sync complete!')
  } catch (error) {
    console.error('❌ Sync failed:', error)
    process.exit(1)
  }
}

main()
