import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import './App.css'
import { Background, Controls, ReactFlow, ReactFlowProvider, type Edge, type Node } from 'reactflow'
import 'reactflow/dist/style.css'
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabaseClient'

type Comment = {
  id: string
  created_at: string
  process_id: string
  step_id: string | null
  body: string
  status: 'open' | 'resolved'
}

type Process = {
  id: string
  slug: string
  name: string
  description: string | null
  owner_role: string | null
  category: string | null
}

type ProcessStep = {
  id: string
  process_id: string
  title: string
  description: string | null
  role: string | null
  order_index: number
  lane: string | null
}

type ProcessTransition = {
  id: string
  process_id: string
  from_step_id: string
  to_step_id: string
  label: string | null
}

const ADMIN_EMAIL = 'captain-pavlos@outlook.com'
const DEFAULT_PROCESS_SLUG = 'renovation'

const ROLE_COLORS: Record<string, { border: string; background: string; badge: string }> = {
  Client: {
    border: '#38bdf8',
    background: 'rgba(15,23,42,0.9)',
    badge: 'border-sky-500/50 bg-sky-500/10 text-sky-200',
  },
  MD: {
    border: '#facc15',
    background: 'rgba(51, 37, 0, 0.9)',
    badge: 'border-yellow-400/50 bg-yellow-400/10 text-yellow-200',
  },
  OPS: {
    border: '#22c55e',
    background: 'rgba(6, 78, 59, 0.9)',
    badge: 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200',
  },
  PM: {
    border: '#a855f7',
    background: 'rgba(46,16,101,0.9)',
    badge: 'border-purple-400/50 bg-purple-400/10 text-purple-200',
  },
  'PM & OPS': {
    border: '#f97316',
    background: 'rgba(30,64,175,0.9)',
    badge: 'border-orange-400/50 bg-orange-400/10 text-orange-200',
  },
}

const ROLE_OPTIONS: string[] = ['Client', 'MD', 'OPS', 'PM', 'PM & OPS']
const LANE_OPTIONS: string[] = ['Client', 'MD', 'OPS', 'PM', 'PM & OPS']

function getRoleColors(role: string | null): { border: string; background: string } {
  const key = role?.trim() || 'Unassigned'
  const config = ROLE_COLORS[key]
  if (config) return { border: config.border, background: config.background }
  return {
    border: '#64748b',
    background: 'rgba(15,23,42,0.95)',
  }
}

function getRoleBadgeClasses(role: string | null): string {
  const key = role?.trim() || 'Unassigned'
  const config = ROLE_COLORS[key]
  if (config) return config.badge
  return 'border-slate-500/40 bg-slate-500/10 text-slate-200'
}

function App() {
  const [user, setUser] = useState<User | null>(null)
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const [processes, setProcesses] = useState<Process[]>([])
  const [selectedProcessSlug, setSelectedProcessSlug] = useState<string | null>(
    DEFAULT_PROCESS_SLUG,
  )
  const [selectedProcessId, setSelectedProcessId] = useState<string | null>(null)
  const [steps, setSteps] = useState<ProcessStep[]>([])
  const [transitions, setTransitions] = useState<ProcessTransition[]>([])
  const [isLoadingProcesses, setIsLoadingProcesses] = useState(false)
  const [isLoadingFlow, setIsLoadingFlow] = useState(false)
  const [processError, setProcessError] = useState<string | null>(null)
  const [flowError, setFlowError] = useState<string | null>(null)
  const [refreshCounter, setRefreshCounter] = useState(0)

  const [newProcessSlug, setNewProcessSlug] = useState('')
  const [newProcessName, setNewProcessName] = useState('')
  const [isCreatingProcess, setIsCreatingProcess] = useState(false)
  const [processFormError, setProcessFormError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all')

  const [editProcessCategory, setEditProcessCategory] = useState('')
  const [editProcessName, setEditProcessName] = useState('')
  const [editProcessDescription, setEditProcessDescription] = useState('')
  const [isUpdatingProcess, setIsUpdatingProcess] = useState(false)
  const [processUpdateError, setProcessUpdateError] = useState<string | null>(null)

  const [newStepTitle, setNewStepTitle] = useState('')
  const [newStepRole, setNewStepRole] = useState('')
  const [newStepLane, setNewStepLane] = useState('')
  const [newStepOrder, setNewStepOrder] = useState('0')
  const [isCreatingStep, setIsCreatingStep] = useState(false)
  const [stepFormError, setStepFormError] = useState<string | null>(null)
  const [newStepDescription, setNewStepDescription] = useState('')

  const [transitionFormError, setTransitionFormError] = useState<string | null>(null)

  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [resolvingCommentId, setResolvingCommentId] = useState<string | null>(null)

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [viewMode, setViewMode] = useState<'workflow' | 'responsibilities'>('workflow')
  const [exportedAt, setExportedAt] = useState<string | null>(null)

  const isAdmin = user?.email === ADMIN_EMAIL

  useEffect(() => {
    const client = supabase
    if (!client) return

    void (async () => {
      const {
        data: { user: currentUser },
      } = await client.auth.getUser()
      setUser(currentUser)
    })()
  }, [])

  useEffect(() => {
    const client = supabase
    if (!client) return

    let isCancelled = false

    const loadProcesses = async () => {
      setIsLoadingProcesses(true)
      const { data, error } = await client
        .from('processes')
        .select('id, slug, name, description, owner_role, category')
        .order('name', { ascending: true })

      if (!isCancelled) {
        if (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to load processes', error)
          setProcessError('Failed to load processes')
        } else {
          const rows = data ?? []
          setProcesses(rows)
          setProcessError(null)

          if (rows.length > 0) {
            const existingBySlug = selectedProcessSlug
              ? rows.find((p) => p.slug === selectedProcessSlug)
              : undefined
            const first = existingBySlug ?? rows[0]
            setSelectedProcessSlug(first.slug)
            setSelectedProcessId(first.id)
          } else {
            setSelectedProcessId(null)
          }
        }
        setIsLoadingProcesses(false)
      }
    }

    void loadProcesses()

    return () => {
      isCancelled = true
    }
  }, [selectedProcessSlug])

  useEffect(() => {
    const client = supabase
    if (!client) return

    let isCancelled = false

    const loadFlow = async () => {
      if (!selectedProcessId) {
        setSteps([])
        setTransitions([])
        return
      }

      setIsLoadingFlow(true)
      const [stepsResult, transitionsResult] = await Promise.all([
        client
          .from('process_steps')
          .select('id, process_id, title, description, role, order_index, lane')
          .eq('process_id', selectedProcessId)
          .order('order_index', { ascending: true }),
        client
          .from('process_transitions')
          .select('id, process_id, from_step_id, to_step_id, label')
          .eq('process_id', selectedProcessId),
      ])

      if (!isCancelled) {
        if (stepsResult.error || transitionsResult.error) {
          if (stepsResult.error) {
            // eslint-disable-next-line no-console
            console.error('Failed to load steps', stepsResult.error)
          }
          if (transitionsResult.error) {
            // eslint-disable-next-line no-console
            console.error('Failed to load transitions', transitionsResult.error)
          }
          setFlowError('Failed to load process flow')
        } else {
          setSteps(stepsResult.data ?? [])
          setTransitions(transitionsResult.data ?? [])
          setFlowError(null)
        }
        setIsLoadingFlow(false)
      }
    }

    void loadFlow()

    return () => {
      isCancelled = true
    }
  }, [selectedProcessId, refreshCounter])

  useEffect(() => {
    const client = supabase
    if (!client) return

    let isCancelled = false

    const loadComments = async () => {
      setIsLoadingComments(true)
      const { data, error } = await client
        .from('comments')
        .select('id, created_at, process_id, step_id, body, status')
        .eq('process_id', selectedProcessSlug ?? DEFAULT_PROCESS_SLUG)
        .order('created_at', { ascending: false })

      if (!isCancelled) {
        if (error) {
          // eslint-disable-next-line no-console
          console.error('Failed to load comments', error)
          setCommentError('Failed to load comments')
        } else {
          setComments(data ?? [])
          setCommentError(null)
        }
        setIsLoadingComments(false)
      }
    }

    void loadComments()

    return () => {
      isCancelled = true
    }
  }, [selectedProcessSlug])

  const handleSubmitComment = async (event: FormEvent) => {
    event.preventDefault()

    if (!supabase) {
      setCommentError('Supabase is not configured.')
      return
    }

    const body = newComment.trim()
    if (!body) return

    setIsSubmittingComment(true)

    const { data, error } = await supabase
      .from('comments')
      .insert({
        process_id: selectedProcessSlug ?? DEFAULT_PROCESS_SLUG,
        step_id: selectedStepId,
        body,
        status: 'open',
        context: {
          path: window.location.pathname,
          userAgent: window.navigator.userAgent,
        },
      })
      .select('id, created_at, process_id, step_id, body, status')
      .single()

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to post comment', error)
      setCommentError('Failed to post comment')
    } else if (data) {
      setComments((prev) => [data, ...prev])
      setNewComment('')
      setCommentError(null)
    }

    setIsSubmittingComment(false)
  }

  const handleResolveComment = async (id: string) => {
    if (!supabase) return
    if (!isAdmin) return
    setResolvingCommentId(id)
    const { data, error } = await supabase
      .from('comments')
      .update({ status: 'resolved' })
      .eq('id', id)
      .select('id, created_at, process_id, step_id, body, status')
      .single()

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to resolve comment', error)
      setCommentError('Failed to resolve comment')
    } else if (data) {
      setComments((prev) => prev.map((comment) => (comment.id === id ? data : comment)))
      setCommentError(null)
    }
    setResolvingCommentId(null)
  }

  const handlePasswordLogin = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return

    const email = loginEmail.trim()
    const password = loginPassword
    if (!email || !password) {
      setAuthMessage('Email and password are required.')
      return
    }

    setIsLoggingIn(true)
    setAuthMessage(null)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to log in', error)
      setAuthMessage('Login failed. Check email and password.')
    } else if (data.user) {
      setUser(data.user)
      setAuthMessage(null)
    }
    setIsLoggingIn(false)
  }

  const handleSignOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null)
  }

  const handleSelectProcess = (slug: string, id: string) => {
    setSelectedProcessSlug(slug)
    setSelectedProcessId(id)
    setRefreshCounter((value) => value + 1)

    if (isAdmin) {
      const process = processes.find((p) => p.id === id)
      if (process) {
        setEditProcessCategory(process.category ?? '')
        setEditProcessName(process.name)
        setEditProcessDescription(process.description ?? '')
      }
    }
  }

  const handleSelectStep = (stepId: string) => {
    setSelectedStepId(stepId)

    if (isAdmin) {
      const step = steps.find((s) => s.id === stepId)
      if (step) {
        setNewStepTitle(step.title)
        setNewStepRole(step.role ?? '')
        setNewStepLane(step.lane ?? '')
        setNewStepOrder(String(step.order_index))
        setNewStepDescription(step.description ?? '')
      }
    }
  }

  const handleRefreshFlow = () => {
    setRefreshCounter((value) => value + 1)
  }

  const handleCreateProcess = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return

    const slug = newProcessSlug.trim()
    const name = newProcessName.trim()
    if (!slug || !name) {
      setProcessFormError('Category and name are required.')
      return
    }

    setIsCreatingProcess(true)
    setProcessFormError(null)
    const { data, error } = await supabase
      .from('processes')
      .insert({ slug, name, category: slug })
      .select('id, slug, name, description, owner_role, category')
      .single()

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to create process', error)
      setProcessFormError('Failed to create process')
    } else if (data) {
      setProcesses((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setNewProcessSlug('')
      setNewProcessName('')
      setSelectedProcessSlug(data.slug)
      setSelectedProcessId(data.id)
    }
    setIsCreatingProcess(false)
  }

  const handleUpdateProcess = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    if (!selectedProcessId) {
      setProcessUpdateError('Select a process first.')
      return
    }

    const name = editProcessName.trim()
    const description = editProcessDescription.trim() || null
    const category = editProcessCategory.trim() || null
    if (!name) {
      setProcessUpdateError('Process name is required.')
      return
    }

    setIsUpdatingProcess(true)
    setProcessUpdateError(null)
    const { data, error } = await supabase
      .from('processes')
      .update({ name, description, category })
      .eq('id', selectedProcessId)
      .select('id, slug, name, description, owner_role, category')
      .single()

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to update process', error)
      setProcessUpdateError('Failed to update process')
    } else if (data) {
      setProcesses((prev) => prev.map((p) => (p.id === data.id ? data : p)))
    }
    setIsUpdatingProcess(false)
  }

  const handleDeleteProcess = async (processId: string) => {
    if (!supabase) return
    if (!isAdmin) return

    const process = processes.find((p) => p.id === processId)
    if (!process) return

    const processSlug = process.slug

    // Best-effort cascading delete: comments (by slug), transitions & steps (by process id), then process
    await supabase.from('comments').delete().eq('process_id', processSlug)
    await supabase.from('process_transitions').delete().eq('process_id', processId)
    await supabase.from('process_steps').delete().eq('process_id', processId)

    const { error } = await supabase.from('processes').delete().eq('id', processId)

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete process', error)
      setProcessFormError('Failed to delete process')
      return
    }

    setProcesses((prev) => prev.filter((p) => p.id !== processId))

    setSteps([])
    setTransitions([])
    setComments([])

    if (selectedProcessId === processId) {
      const remaining = processes.filter((p) => p.id !== processId)
      if (remaining.length > 0) {
        const next = remaining[0]
        setSelectedProcessId(next.id)
        setSelectedProcessSlug(next.slug)
      } else {
        setSelectedProcessId(null)
        setSelectedProcessSlug(null)
      }
    }
  }

  const handleCreateStep = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    if (!selectedProcessId) {
      setStepFormError('Select a process first.')
      return
    }

    const title = newStepTitle.trim()
    if (!title) {
      setStepFormError('Step title is required.')
      return
    }

    const orderIndex = Number(newStepOrder) || 0

    setIsCreatingStep(true)
    setStepFormError(null)
    const { data, error } = await supabase
      .from('process_steps')
      .insert({
        process_id: selectedProcessId,
        title,
        role: newStepRole.trim() || null,
        lane: newStepLane.trim() || null,
        order_index: orderIndex,
        description: newStepDescription.trim() || null,
      })
      .select('id, process_id, title, description, role, order_index, lane')
      .single()

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to create step', error)
      setStepFormError('Failed to create step')
    } else if (data) {
      setSteps((prev) => [...prev, data].sort((a, b) => a.order_index - b.order_index))
      setNewStepTitle('')
      setNewStepRole('')
      setNewStepLane('')
      setNewStepOrder('0')
      setNewStepDescription('')
    }
    setIsCreatingStep(false)
  }

  const handleUpdateStep = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    if (!selectedProcessId || !selectedStepId) {
      setStepFormError('Select a step first.')
      return
    }

    const title = newStepTitle.trim()
    if (!title) {
      setStepFormError('Step title is required.')
      return
    }

    const orderIndex = Number(newStepOrder) || 0

    setIsCreatingStep(true)
    setStepFormError(null)
    const { data, error } = await supabase
      .from('process_steps')
      .update({
        title,
        role: newStepRole.trim() || null,
        lane: newStepLane.trim() || null,
        order_index: orderIndex,
        description: newStepDescription.trim() || null,
      })
      .eq('id', selectedStepId)
      .select('id, process_id, title, description, role, order_index, lane')
      .single()

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to update step', error)
      setStepFormError('Failed to update step')
    } else if (data) {
      setSteps((prev) => prev.map((step) => (step.id === data.id ? data : step)))
    }
    setIsCreatingStep(false)
  }

  const handleConnect = async (connection: { source?: string | null; target?: string | null }) => {
    if (!supabase) return
    if (!isAdmin) return
    if (!selectedProcessId) return

    const { source, target } = connection
    if (!source || !target) return

    const { data, error } = await supabase
      .from('process_transitions')
      .insert({
        process_id: selectedProcessId,
        from_step_id: source,
        to_step_id: target,
        label: null,
      })
      .select('id, process_id, from_step_id, to_step_id, label')
      .single()

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to create transition from connect', error)
      setTransitionFormError('Failed to create transition')
    } else if (data) {
      setTransitions((prev) => [...prev, data])
      setTransitionFormError(null)
    }
  }

  const { nodes, edges } = useMemo(() => {
    if (steps.length === 0) {
      return { nodes: [], edges: [] }
    }

    const lanes = Array.from(new Set(steps.map((step) => step.lane || 'Unassigned')))
    const laneIndexMap = new Map<string, number>()
    lanes.forEach((lane, index) => laneIndexMap.set(lane, index))

    // Vertical layout: order_index controls Y (downwards), lane controls X (left→right)
    const xGap = 260
    const yGap = 140

    const openCommentStepIds = new Set(
      comments
        .filter((comment) => comment.status === 'open' && comment.step_id)
        .map((comment) => comment.step_id as string),
    )

    const dynamicNodes: Node[] = steps.map((step) => {
      const laneKey = step.lane || 'Unassigned'
      const laneIndex = laneIndexMap.get(laneKey) ?? 0
      const position = {
        x: laneIndex * xGap,
        y: (step.order_index || 0) * yGap,
      }

      const roleColors = getRoleColors(step.role)

      const baseStyle: CSSProperties = {
        borderRadius: 16,
        paddingInline: 18,
        paddingBlock: 10,
        border: `1px solid ${roleColors.border}`,
        background: roleColors.background,
        color: '#f9fafb',
        fontSize: 12,
      }

      const isSelected = step.id === selectedStepId
      const hasOpenComments = openCommentStepIds.has(step.id)

      const style: CSSProperties = {
        ...baseStyle,
        ...(isSelected && {
          border: '2px solid #f97316',
          boxShadow: '0 0 0 1px rgba(249,115,22,0.45)',
        }),
        ...(hasOpenComments && {
          border: '2px solid #ef4444',
          boxShadow: '0 0 0 1px rgba(239,68,68,0.5)',
        }),
      }

      return {
        id: step.id,
        position,
        data: { label: `${step.order_index}. ${step.title}` },
        style,
      }
    })

    const dynamicEdges: Edge[] = transitions.map((transition) => ({
      id: transition.id,
      source: transition.from_step_id,
      target: transition.to_step_id,
      type: 'smoothstep',
    }))

    return { nodes: dynamicNodes, edges: dynamicEdges }
  }, [steps, transitions, comments, selectedStepId])

  const selectedStep = useMemo(
    () => steps.find((step) => step.id === selectedStepId) ?? null,
    [steps, selectedStepId],
  )

  const selectedProcess = useMemo(
    () => processes.find((process) => process.id === selectedProcessId) ?? null,
    [processes, selectedProcessId],
  )

  const availableCategories = useMemo(
    () =>
      Array.from(
        new Set(
          processes
            .map((process) => process.category || '')
            .filter((category) => category.trim().length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [processes],
  )

  const availableLanes = useMemo(
    () =>
      Array.from(
        new Set(
          steps
            .map((step) => step.lane || '')
            .filter((lane) => lane.trim().length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [steps],
  )

  const visibleComments = useMemo(() => {
    if (!selectedStepId) return comments
    return comments.filter((comment) => comment.step_id === selectedStepId)
  }, [comments, selectedStepId])

  const stepsByRole = useMemo(() => {
    const groups = new Map<string, ProcessStep[]>()
    steps.forEach((step) => {
      const key = step.role?.trim() || 'Unassigned'
      const existing = groups.get(key)
      if (existing) {
        existing.push(step)
      } else {
        groups.set(key, [step])
      }
    })
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [steps])

  const handleExportPdf = () => {
    if (typeof window === 'undefined') return
    setExportedAt(new Date().toLocaleString())
    window.print()
  }

  return (
    <div className="min-h-screen flex flex-col text-sm text-slate-100">
      <header className="border-b border-white/5 bg-gradient-to-r from-nest-bg/80 via-black/80 to-nest-green-dark/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-nest-gold/60 bg-gradient-to-br from-nest-green-dark to-black shadow-soft-elevated">
              <span className="text-xs font-semibold tracking-[0.15em] text-nest-gold">
                NL
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-wide text-slate-50">
                  Nestland Command Center
                </h1>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                  Internal
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                Live process maps, anonymous collaboration, single source of truth.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <div className="hidden items-center gap-2 md:flex">
              <span className="text-slate-500">Supabase · live processes</span>
              <span className="inline-flex items-center gap-1 rounded-full border border-nest-gold/25 bg-nest-surface/60 px-2.5 py-1 text-[10px] uppercase tracking-wide text-nest-gold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Beta
              </span>
            </div>
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <span className="hidden text-[10px] text-slate-400 sm:inline">
                    Signed in as {user.email}
                  </span>
                  {isAdmin && (
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-emerald-300">
                      Admin
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="rounded-full border border-white/10 bg-black/40 px-2.5 py-0.5 text-[10px] text-slate-300 hover:border-nest-gold/40 hover:text-nest-gold"
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <form className="flex items-center gap-1" onSubmit={handlePasswordLogin}>
                  <input
                    className="w-32 rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] text-slate-100 placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 sm:w-40"
                    placeholder="Admin email"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    type="email"
                  />
                  <input
                    className="w-24 rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] text-slate-100 placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 sm:w-28"
                    placeholder="Password"
                    type="password"
                    value={loginPassword}
                    onChange={(event) => setLoginPassword(event.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="rounded-full border border-white/10 bg-nest-gold px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black shadow-soft-elevated hover:bg-nest-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoggingIn ? 'Logging in...' : 'Login'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 gap-4 px-6 pb-6 pt-4">
        {/* Process list */}
        <aside
          className={`hidden shrink-0 flex-col rounded-2xl border border-white/5 bg-nest-surface/80 shadow-soft-elevated md:flex ${
            isSidebarCollapsed ? 'w-10 p-2 items-center' : 'w-72 p-3'
          }`}
        >
          <div className="mb-3 flex w-full items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((value) => !value)}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-black/40 text-[10px] text-slate-300 hover:border-nest-gold/40 hover:text-nest-gold"
                aria-label={isSidebarCollapsed ? 'Expand processes sidebar' : 'Collapse processes sidebar'}
              >
                {isSidebarCollapsed ? '›' : '‹'}
              </button>
              {!isSidebarCollapsed && (
                <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                  Processes
                </span>
              )}
            </div>
            {!isSidebarCollapsed && (
              <>
                {isLoadingProcesses ? (
                  <span className="text-[10px] text-slate-500">Loading...</span>
                ) : (
                  <span className="text-[10px] text-slate-500">{processes.length} total</span>
                )}
              </>
            )}
          </div>
          {!isSidebarCollapsed && (
            <>
              {processError && (
                <p className="mb-2 text-[10px] text-red-400">{processError}</p>
              )}
              <div className="mt-1 space-y-1 overflow-y-auto text-[11px]">
                {processes.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    No processes yet.{' '}
                    {isAdmin
                      ? 'Use the admin panel below to create one.'
                      : 'Ask an admin to create the first process.'}
                  </p>
                ) : (
                  processes
                    .filter((process) =>
                      categoryFilter === 'all'
                        ? true
                        : (process.category || '').trim() === categoryFilter,
                    )
                    .map((process) => {
                      const isActive = process.slug === selectedProcessSlug
                      return (
                        <button
                          key={process.id}
                          type="button"
                          onClick={() => handleSelectProcess(process.slug, process.id)}
                          className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-[11px] ${
                            isActive
                              ? 'border-nest-gold/40 bg-gradient-to-r from-nest-green-dark/70 via-black/80 to-nest-brown/40 text-slate-100 shadow-soft-elevated'
                              : 'border-white/5 bg-white/5 text-slate-200 hover:border-nest-gold/30 hover:bg-white/10'
                          }`}
                        >
                          <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                            <span className="truncate font-semibold">{process.name}</span>
                            {process.category && (
                              <span className="truncate text-[10px] text-slate-500">
                                Category: {process.category}
                              </span>
                            )}
                          </span>
                        </button>
                      )
                    })
                )}
              </div>
              {isAdmin && (
                <div className="mt-3 border-t border-white/5 pt-3 text-[11px]">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Admin · Processes
                  </p>
                  {availableCategories.length > 0 && (
                    <div className="mb-2 flex items-center gap-2 text-[10px] text-slate-400">
                      <span className="uppercase tracking-[0.18em] text-slate-500">Filter</span>
                      <select
                        className="flex-1 rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-slate-100 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
                        value={categoryFilter}
                        onChange={(event) =>
                          setCategoryFilter(
                            (event.target.value || 'all') as 'all' | string,
                          )
                        }
                      >
                        <option value="all">All categories</option>
                        {availableCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <form className="space-y-2" onSubmit={handleCreateProcess}>
                    <input
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
                      placeholder="Category (e.g. Renovation)"
                      value={newProcessSlug}
                      onChange={(event) => setNewProcessSlug(event.target.value)}
                    />
                    <input
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
                      placeholder="Process name"
                      value={newProcessName}
                      onChange={(event) => setNewProcessName(event.target.value)}
                    />
                    {processFormError && (
                      <p className="text-[10px] text-red-400">{processFormError}</p>
                    )}
                    <button
                      type="submit"
                      disabled={isCreatingProcess}
                      className="w-full rounded-full bg-nest-gold px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-black shadow-soft-elevated hover:bg-nest-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCreatingProcess ? 'Creating...' : 'Create process'}
                    </button>
                    {authMessage && (
                      <p className="mt-1 text-[10px] text-slate-500">{authMessage}</p>
                    )}
                  </form>
                  {selectedProcess && (
                    <div className="mt-3 border-t border-white/5 pt-3 text-[11px]">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Admin · Edit selected process
                      </p>
                      <form className="space-y-2" onSubmit={handleUpdateProcess}>
                        <input
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
                          placeholder="Category (e.g. Renovation)"
                          value={editProcessCategory}
                          onChange={(event) => setEditProcessCategory(event.target.value)}
                        />
                        <input
                          className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
                          placeholder="Process name"
                          value={editProcessName}
                          onChange={(event) => setEditProcessName(event.target.value)}
                        />
                        <textarea
                          className="h-16 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
                          placeholder="Process description"
                          value={editProcessDescription}
                          onChange={(event) => setEditProcessDescription(event.target.value)}
                        />
                        {processUpdateError && (
                          <p className="text-[10px] text-red-400">{processUpdateError}</p>
                        )}
                        <button
                          type="submit"
                          disabled={isUpdatingProcess}
                          className="w-full rounded-full border border-nest-gold/40 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-nest-gold shadow-soft-elevated hover:bg-nest-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isUpdatingProcess ? 'Updating...' : 'Update process'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteProcess(selectedProcess.id)}
                          className="mt-1 w-full rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-200 shadow-soft-elevated hover:border-red-400 hover:bg-red-500/20"
                        >
                          Delete process
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </aside>

        {/* Flowchart canvas */}
        <section className="flex min-h-[480px] flex-1 flex-col overflow-hidden rounded-2xl border border-white/5 bg-nest-surface/80 shadow-soft-elevated">
          <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5 text-[11px] text-slate-300">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-nest-gold/40 bg-nest-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-nest-gold">
                {selectedProcess?.name ?? 'Workflow'}
              </span>
              <span className="text-slate-500">
                {isLoadingFlow ? 'Loading workflow...' : 'Workflow'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {flowError && <span className="text-[10px] text-red-400">{flowError}</span>}
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'workflow' ? 'responsibilities' : 'workflow')}
                className={`rounded-full border px-2.5 py-0.5 text-[10px] ${
                  viewMode === 'workflow'
                    ? 'border-white/10 bg-black/40 text-slate-300 hover:border-nest-gold/40 hover:text-nest-gold'
                    : 'border-nest-gold/40 bg-nest-gold/10 text-nest-gold'
                }`}
              >
                {viewMode === 'workflow' ? 'Responsibilities' : 'Workflow map'}
              </button>
              <button
                type="button"
                onClick={handleRefreshFlow}
                className="rounded-full border border-white/10 bg-black/40 px-2.5 py-0.5 text-[10px] text-slate-300 hover:border-nest-gold/40 hover:text-nest-gold"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className="rounded-full border border-white/10 bg-black/40 px-2.5 py-0.5 text-[10px] text-slate-300 hover:border-nest-gold/40 hover:text-nest-gold"
              >
                Fullscreen
              </button>
              <span className="text-[10px] text-slate-500">Live from Supabase</span>
            </div>
          </div>
          <div className="flex-1 bg-gradient-to-br from-black via-slate-900 to-black">
            {viewMode === 'workflow' ? (
              <ReactFlowProvider>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  fitView
                  style={{ width: '100%', height: '100%' }}
                  proOptions={{ hideAttribution: true }}
                  panOnScroll
                  zoomOnScroll
                  zoomOnPinch
                  panOnDrag
                  selectionOnDrag={false}
                  nodesDraggable={false}
                  onConnect={handleConnect}
                  onNodeClick={(_, node) => handleSelectStep(node.id)}
                  onPaneClick={() => setSelectedStepId(null)}
                >
                  <Background color="#111827" gap={24} />
                  <Controls position="bottom-right" />
                </ReactFlow>
              </ReactFlowProvider>
            ) : (
              <div className="flex h-full flex-col px-4 py-3 text-[11px] text-slate-200">
                {stepsByRole.length === 0 ? (
                  <p className="text-[11px] text-slate-500">No steps defined yet.</p>
                ) : (
                  <div className="flex-1 overflow-y-auto rounded-2xl border border-white/10 bg-black/40 p-3">
                    <table className="min-w-full border-separate border-spacing-y-1 text-[10px]">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="px-3 py-1 font-medium">Responsibility</th>
                          <th className="px-3 py-1 font-medium">Steps</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stepsByRole.map(([role, group]) => (
                          <tr key={role} className="align-top text-slate-300">
                            <td className="px-3 py-1">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${getRoleBadgeClasses(role)}`}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-current/70" />
                                {role}
                              </span>
                            </td>
                            <td className="px-3 py-1">
                              <ul className="space-y-0.5">
                                {group
                                  .slice()
                                  .sort((a, b) => a.order_index - b.order_index)
                                  .map((step) => (
                                    <li
                                      key={step.id}
                                      className="flex items-center justify-between gap-2"
                                    >
                                      <span className="truncate text-[10px] text-slate-200">
                                        {step.order_index}. {step.title}
                                      </span>
                                    </li>
                                  ))}
                              </ul>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
          {isAdmin && (
            <div className="border-t border-white/5 bg-black/40 px-4 py-3 text-[11px]">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Admin · Edit Flow
                </p>
                <p className="text-[10px] text-slate-500">
                  Process:{' '}
                  {processes.find((p) => p.id === selectedProcessId)?.slug ?? 'none selected'}
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <form className="space-y-2" onSubmit={handleCreateStep}>
                  <p className="text-[10px] font-semibold text-slate-300">Add step</p>
                  <input
                    className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
                    placeholder="Title (e.g. Qualify lead)"
                    value={newStepTitle}
                    onChange={(event) => setNewStepTitle(event.target.value)}
                  />
                  <div className="flex gap-2">
                    <select
                      className="w-1/2 rounded-xl border border-white/10 bg-black/40 px-2.5 py-1.5 text-[11px] text-slate-100 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
                      value={newStepRole}
                      onChange={(event) => setNewStepRole(event.target.value)}
                    >
                      <option value="">Role</option>
                      {ROLE_OPTIONS.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <select
                      className="w-1/2 rounded-xl border border-white/10 bg-black/40 px-2.5 py-1.5 text-[11px] text-slate-100 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
                      value={newStepLane}
                      onChange={(event) => setNewStepLane(event.target.value)}
                    >
                      <option value="">Lane</option>
                      {LANE_OPTIONS.map((lane) => (
                        <option key={lane} value={lane}>
                          {lane}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      className="w-24 rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
                      placeholder="Order"
                      value={newStepOrder}
                      onChange={(event) => setNewStepOrder(event.target.value)}
                    />
                    <span className="text-[10px] text-slate-500">Horizontal position</span>
                  </div>
                  <textarea
                    className="h-16 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
                    placeholder="Step details / notes"
                    value={newStepDescription}
                    onChange={(event) => setNewStepDescription(event.target.value)}
                  />
                  {stepFormError && (
                    <p className="text-[10px] text-red-400">{stepFormError}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isCreatingStep}
                      className="flex-1 rounded-full bg-nest-gold px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-black shadow-soft-elevated hover:bg-nest-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCreatingStep ? 'Adding...' : 'Add step'}
                    </button>
                    <button
                      type="button"
                      disabled={isCreatingStep || !selectedStep}
                      onClick={handleUpdateStep}
                      className="flex-1 rounded-full border border-nest-gold/40 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-nest-gold shadow-soft-elevated hover:bg-nest-gold/10 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCreatingStep ? 'Updating...' : 'Update selected step'}
                    </button>
                  </div>
                </form>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold text-slate-300">Danger zone</p>
                    {availableLanes.length > 0 && (
                      <p className="text-[10px] text-slate-500">
                        Lanes: {availableLanes.join(', ')}
                      </p>
                    )}
                  </div>
                  {transitionFormError && (
                    <p className="text-[10px] text-red-400">{transitionFormError}</p>
                  )}
                  <button
                    type="button"
                    disabled={!selectedStep}
                    onClick={async () => {
                      if (!supabase || !selectedStepId) return
                      if (!selectedProcessId) return

                      // Delete comments for this step
                      await supabase.from('comments').delete().eq('step_id', selectedStepId)
                      // Delete transitions touching this step
                      await supabase
                        .from('process_transitions')
                        .delete()
                        .eq('process_id', selectedProcessId)
                        .or(`from_step_id.eq.${selectedStepId},to_step_id.eq.${selectedStepId}`)

                      const { error } = await supabase
                        .from('process_steps')
                        .delete()
                        .eq('id', selectedStepId)

                      if (error) {
                        // eslint-disable-next-line no-console
                        console.error('Failed to delete step', error)
                        setStepFormError('Failed to delete step')
                        return
                      }

                      setSteps((prev) => prev.filter((step) => step.id !== selectedStepId))
                      setTransitions((prev) =>
                        prev.filter(
                          (transition) =>
                            transition.from_step_id !== selectedStepId &&
                            transition.to_step_id !== selectedStepId,
                        ),
                      )
                      setComments((prev) =>
                        prev.filter((comment) => comment.step_id !== selectedStepId),
                      )
                      setSelectedStepId(null)
                    }}
                    className="w-full rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-200 shadow-soft-elevated hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Delete selected step
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Comments & details */}
        <aside className="hidden w-80 shrink-0 flex-col rounded-2xl border border-white/5 bg-nest-surface/80 p-3 shadow-soft-elevated lg:flex">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-400">
                Comments
              </p>
              <p className="text-[10px] text-slate-500">Anonymous · Visible to Nest Land team</p>
            </div>
            <button
              type="button"
              onClick={handleExportPdf}
              className="rounded-full border border-white/10 bg-black/40 px-2.5 py-0.5 text-[10px] text-slate-300 hover:border-nest-gold/40 hover:text-nest-gold"
            >
              Export PDF
            </button>
          </div>
          <div className="mb-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[11px]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Step details
            </p>
            {selectedStep ? (
              <div className="mt-1 space-y-1">
                <p className="text-[11px] font-semibold text-slate-100">{selectedStep.title}</p>
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                  <span>Responsibility:</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${getRoleBadgeClasses(selectedStep.role)}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current/70" />
                    {selectedStep.role ?? 'Unassigned'}
                  </span>
                  {selectedStep.lane && (
                    <span className="text-slate-500">Lane: {selectedStep.lane}</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400">
                  Order index: <span className="text-slate-200">{selectedStep.order_index}</span>
                </p>
                {selectedStep.description && (
                  <p className="mt-1 text-[11px] text-slate-300 whitespace-pre-wrap">
                    {selectedStep.description}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-1 text-[10px] text-slate-500">
                Click a step in the flow to see responsibilities and notes here.
              </p>
            )}
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto text-[11px]">
            {isLoadingComments ? (
              <p className="text-[11px] text-slate-500">Loading comments...</p>
            ) : visibleComments.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                {selectedStep
                  ? 'No comments yet for this step.'
                  : 'No comments yet for this process.'}
              </p>
            ) : (
              visibleComments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                >
                  <p className="text-slate-200 whitespace-pre-wrap">{comment.body}</p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-500">
                    <span>
                      {(selectedProcess?.name ?? 'Workflow')} ·{' '}
                      {comment.status === 'open' ? 'open' : 'resolved'} ·{' '}
                      {new Date(comment.created_at).toLocaleString()}
                    </span>
                    {isAdmin && comment.status === 'open' && (
                      <button
                        type="button"
                        onClick={() => handleResolveComment(comment.id)}
                        disabled={resolvingCommentId === comment.id}
                        className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {resolvingCommentId === comment.id ? 'Resolving…' : 'Mark resolved'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
            {commentError && (
              <p className="text-[10px] text-red-400">{commentError}</p>
            )}
          </div>
          <form className="mt-3 space-y-2" onSubmit={handleSubmitComment}>
            <textarea
              className="h-20 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
              value={newComment}
              onChange={(event) => setNewComment(event.target.value)}
              disabled={isSubmittingComment || !supabase}
              placeholder="Leave an anonymous comment or improvement suggestion for this process..."
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="submit"
                disabled={isSubmittingComment || !supabase}
                className="rounded-full bg-nest-gold px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-black shadow-soft-elevated hover:bg-nest-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingComment ? 'Posting...' : 'Post comment'}
              </button>
            </div>
          </form>
        </aside>
      </main>
      {/* Print-only workflow export (A4-friendly) */}
      <div id="print-workflow">
        <div className="print-container">
          <header className="print-header">
            <h1 className="print-title">{selectedProcess?.name ?? 'Workflow'}</h1>
            {selectedProcess?.description && (
              <p className="print-subtitle">{selectedProcess.description}</p>
            )}
            <p className="print-meta">
              Exported on: {exportedAt ?? new Date().toLocaleString()}
            </p>
          </header>
          <section className="print-section">
            <h2 className="print-section-title">Step-by-step sequence</h2>
            <table className="print-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Step</th>
                  <th>Responsibility</th>
                  <th>Lane</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {steps
                  .slice()
                  .sort((a, b) => a.order_index - b.order_index)
                  .map((step) => (
                    <tr key={step.id}>
                      <td>{step.order_index}</td>
                      <td>{step.title}</td>
                      <td>{step.role ?? 'Unassigned'}</td>
                      <td>{step.lane ?? '—'}</td>
                      <td>{step.description ?? ''}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
      {isFullscreen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-black/95">
          <header className="flex items-center justify-between border-b border-white/10 bg-black/70 px-4 py-2 text-[11px] text-slate-300">
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-nest-gold/40 bg-nest-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-nest-gold">
                {selectedProcess?.name ?? 'Workflow'}
              </span>
              <span className="text-slate-500">Fullscreen workflow view</span>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="rounded-full border border-white/10 bg-black/40 px-2.5 py-0.5 text-[10px] text-slate-300 hover:border-nest-gold/40 hover:text-nest-gold"
            >
              Close
            </button>
          </header>
          <div className="relative flex-1 bg-gradient-to-br from-black via-slate-900 to-black">
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                fitView
                style={{ width: '100%', height: '100%' }}
                proOptions={{ hideAttribution: true }}
                panOnScroll
                zoomOnScroll
                zoomOnPinch
                panOnDrag
                selectionOnDrag={false}
                nodesDraggable={false}
                onConnect={handleConnect}
                onNodeClick={(_, node) => handleSelectStep(node.id)}
                onPaneClick={() => setSelectedStepId(null)}
              >
                <Background color="#111827" gap={24} />
                <Controls position="bottom-right" />
              </ReactFlow>
            </ReactFlowProvider>
            {selectedStep && (
              <div className="pointer-events-auto absolute top-4 right-4 z-50 w-80 max-w-[90vw] rounded-2xl border border-white/10 bg-black/80 p-3 text-[11px] text-slate-100 shadow-soft-elevated backdrop-blur">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Step details
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedStepId(null)}
                    className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] text-slate-300 hover:border-nest-gold/40 hover:text-nest-gold"
                  >
                    Close
                  </button>
                </div>
                <p className="text-[11px] font-semibold text-slate-50">{selectedStep.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                  <span>Responsibility:</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${getRoleBadgeClasses(selectedStep.role)}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current/70" />
                    {selectedStep.role ?? 'Unassigned'}
                  </span>
                  {selectedStep.lane && (
                    <span className="text-slate-500">Lane: {selectedStep.lane}</span>
                  )}
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  Order index: <span className="text-slate-200">{selectedStep.order_index}</span>
                </p>
                {selectedStep.description && (
                  <p className="mt-1 text-[11px] text-slate-200 whitespace-pre-wrap">
                    {selectedStep.description}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default App
