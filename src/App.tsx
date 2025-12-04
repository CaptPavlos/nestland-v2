import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import './App.css'
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { supabase, auth, getCurrentUser, type User } from './lib/supabaseClient'
import { notifyNewComment } from './lib/pushover'

type Comment = {
  id: string
  created_at: string
  process_id: string
  step_id: string | null
  project_id?: string | null
  body: string
  status: 'open' | 'resolved'
  created_by?: string | null
  context?: { author_first_name?: string | null } | null
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
  duration_days: number | null
  created_at: string
}

type ProcessTransition = {
  id: string
  process_id: string
  from_step_id: string
  to_step_id: string
  label: string | null
}

type Project = {
  id: string
  name: string
  process_id: string
  current_step_id: string | null
  status: string
  created_at: string
}

type ProjectStepSummary = {
  id: string
  process_id: string
  title: string
  order_index: number
  description: string | null
   duration_days: number | null
}

type ProjectStepComment = {
  id: string
  project_id: string
  step_id: string
  body: string
  created_at: string
  created_by: string | null
}

type ProjectInvoice = {
  id: string
  project_id: string
  amount: number
  description: string | null
  created_at: string
  invoice_number: string | null
  direction: 'paid' | 'received'
}

const ADMIN_EMAIL = 'captain-pavlos@outlook.com'
const DEFAULT_PROCESS_SLUG = 'renovation'
const PROJECT_FILES_BUCKET = 'project-files'

// Define empty nodeTypes and edgeTypes outside the component to avoid React Flow warnings
const nodeTypes = {}
const edgeTypes = {}

const ROLE_COLORS: Record<string, {
  dark: { border: string; background: string; text: string };
  light: { border: string; background: string; text: string };
  badge: string;
}> = {
  Client: {
    dark: { border: '#38bdf8', background: 'rgba(15,23,42,0.9)', text: '#f9fafb' },
    light: { border: '#0284c7', background: '#e0f2fe', text: '#0c4a6e' },
    badge: 'border-sky-500 bg-sky-100 text-sky-900',
  },
  MD: {
    dark: { border: '#facc15', background: 'rgba(51, 37, 0, 0.9)', text: '#f9fafb' },
    light: { border: '#ca8a04', background: '#fef9c3', text: '#713f12' },
    badge: 'border-yellow-500 bg-yellow-100 text-yellow-900',
  },
  OPS: {
    dark: { border: '#22c55e', background: 'rgba(6, 78, 59, 0.9)', text: '#f9fafb' },
    light: { border: '#16a34a', background: '#dcfce7', text: '#14532d' },
    badge: 'border-emerald-500 bg-emerald-100 text-emerald-900',
  },
  PM: {
    dark: { border: '#a855f7', background: 'rgba(46,16,101,0.9)', text: '#f9fafb' },
    light: { border: '#9333ea', background: '#f3e8ff', text: '#581c87' },
    badge: 'border-purple-500 bg-purple-100 text-purple-900',
  },
  'PM & OPS': {
    dark: { border: '#f97316', background: 'rgba(30,64,175,0.9)', text: '#f9fafb' },
    light: { border: '#ea580c', background: '#ffedd5', text: '#7c2d12' },
    badge: 'border-orange-500 bg-orange-100 text-orange-900',
  },
  Unassigned: {
    dark: { border: '#64748b', background: 'rgba(15,23,42,0.95)', text: '#f9fafb' },
    light: { border: '#64748b', background: '#f1f5f9', text: '#334155' },
    badge: 'border-slate-400 bg-slate-100 text-slate-800',
  },
}

function getRoleColors(role: string | null, isWhiteMode: boolean): { border: string; background: string; text: string } {
  const key = role?.trim() || 'Unassigned'
  const config = ROLE_COLORS[key]
  if (config) {
    return isWhiteMode ? config.light : config.dark
  }
  // Fallback for unknown roles
  return isWhiteMode
    ? { border: '#64748b', background: '#f1f5f9', text: '#334155' }
    : { border: '#64748b', background: 'rgba(15,23,42,0.95)', text: '#f9fafb' }
}

function getRoleBadgeClasses(role: string | null): string {
  const key = role?.trim() || 'Unassigned'
  const config = ROLE_COLORS[key]
  if (config) return config.badge
  return 'border-slate-400 bg-slate-100 text-slate-800'
}

function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start)
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    const day = d.getDay()
    if (day !== 0 && day !== 6) {
      added++
    }
  }
  return d
}

function FitViewOnInit(props: {
  nodeCount: number
  selectedProcessId: string | null
  flowVersion: number
}) {
  const { nodeCount, selectedProcessId, flowVersion } = props
  const instance = useReactFlow()

  useEffect(() => {
    if (!selectedProcessId || nodeCount === 0) return
    const id = window.setTimeout(() => {
      instance.fitView({ padding: 0.2 })
    }, 0)
    return () => window.clearTimeout(id)
  }, [selectedProcessId, nodeCount, flowVersion, instance])

  return null
}

function App() {
  const [isDesktop, setIsDesktop] = useState(true)
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
  const [flowVersion, setFlowVersion] = useState(0)

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
  const [newStepOrder, setNewStepOrder] = useState('0')
  const [isCreatingStep, setIsCreatingStep] = useState(false)
  const [stepFormError, setStepFormError] = useState<string | null>(null)
  const [newStepDescription, setNewStepDescription] = useState('')
  const [newStepDurationDays, setNewStepDurationDays] = useState('')
  const [newStepDurationHours, setNewStepDurationHours] = useState('')

  const [transitionFormError, setTransitionFormError] = useState<string | null>(null)
  const [isDeletingAllConnections, setIsDeletingAllConnections] = useState(false)

  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [isLoadingComments, setIsLoadingComments] = useState(false)
  const [commentError, setCommentError] = useState<string | null>(null)
  const [resolvingCommentId, setResolvingCommentId] = useState<string | null>(null)
  const [projectComments, setProjectComments] = useState<ProjectStepComment[]>([])
  const [newProjectComments, setNewProjectComments] = useState<Record<string, string>>({})
  const [isSubmittingProjectCommentKey, setIsSubmittingProjectCommentKey] = useState<string | null>(null)
  const [projectCommentsError, setProjectCommentsError] = useState<string | null>(null)

  const [authorFirstNames, setAuthorFirstNames] = useState<Record<string, string>>({})

  const [activePage, setActivePage] = useState<'workflow' | 'projects' | 'wiki' | 'settings'>(
    'workflow',
  )

  const [wikiTitle, setWikiTitle] = useState('Company Regulations')
  const [wikiContent, setWikiContent] = useState('')
  const [wikiCategories, setWikiCategories] = useState('')
  const [isLoadingWiki, setIsLoadingWiki] = useState(false)
  const [wikiError, setWikiError] = useState<string | null>(null)
  const [isEditingWiki, setIsEditingWiki] = useState(false)
  const [wikiDraftTitle, setWikiDraftTitle] = useState('Company Regulations')
  const [wikiDraftContent, setWikiDraftContent] = useState('')
  const [wikiDraftCategories, setWikiDraftCategories] = useState('')
  const [isSavingWiki, setIsSavingWiki] = useState(false)

  const [projects, setProjects] = useState<Project[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectProcessId, setNewProjectProcessId] = useState('')
  const [isCreatingProject, setIsCreatingProject] = useState(false)
  const [projectFormError, setProjectFormError] = useState<string | null>(null)

  const [projectSteps, setProjectSteps] = useState<ProjectStepSummary[]>([])

  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [editingProjectName, setEditingProjectName] = useState('')
  const [isUpdatingProjectNameId, setIsUpdatingProjectNameId] = useState<string | null>(null)
  const [deletingProjectCommentId, setDeletingProjectCommentId] = useState<string | null>(null)
  const [expandedProjectHistoryId, setExpandedProjectHistoryId] = useState<string | null>(null)
  const [isDeletingProjectId, setIsDeletingProjectId] = useState<string | null>(null)
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false)
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [selectedProjectForModal, setSelectedProjectForModal] = useState<Project | null>(null)
  const [isLegendExpanded, setIsLegendExpanded] = useState(false)
  const [isProjectHistoryOpen, setIsProjectHistoryOpen] = useState(false)
  const [projectFiles, setProjectFiles] = useState<Record<string, { name: string; path: string; size: number; url: string }[]>>({})
  const [isUploadingFilesProjectId, setIsUploadingFilesProjectId] = useState<string | null>(null)
  const [filesError, setFilesError] = useState<string | null>(null)
  const [invoicesByProject, setInvoicesByProject] = useState<Record<string, ProjectInvoice[]>>({})
  const [isAddingInvoiceProjectId, setIsAddingInvoiceProjectId] = useState<string | null>(null)
  const [invoicesError, setInvoicesError] = useState<string | null>(null)
  const [newInvoiceAmountByProject, setNewInvoiceAmountByProject] = useState<Record<string, string>>({})
  const [newInvoiceDescByProject, setNewInvoiceDescByProject] = useState<Record<string, string>>({})
  const [newInvoiceNumberByProject, setNewInvoiceNumberByProject] = useState<Record<string, string>>({})
  const [newInvoiceDirectionByProject, setNewInvoiceDirectionByProject] = useState<Record<string, 'paid' | 'received'>>({})
  const [isDeletingInvoiceId, setIsDeletingInvoiceId] = useState<string | null>(null)
  const [isDeletingFilePath, setIsDeletingFilePath] = useState<string | null>(null)
  const [isChangingProjectStep, setIsChangingProjectStep] = useState(false)
  const [profileFirstName, setProfileFirstName] = useState('')
  const [profileLastName, setProfileLastName] = useState('')
  const [profileRole, setProfileRole] = useState('')
  const [, setIsLoadingProfile] = useState(false)
  const [isSavingProfile, setIsSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [viewMode, setViewMode] = useState<'workflow' | 'responsibilities'>('workflow')
  const [isCommentsSidebarVisible, setIsCommentsSidebarVisible] = useState(true)
  const [exportedAt, setExportedAt] = useState<string | null>(null)

  const [isWhiteMode, setIsWhiteMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const stored = window.localStorage.getItem('nestland_theme')
    return stored === 'light'
  })

  

  const [wikiUrl, setWikiUrl] = useState(() => {
    if (typeof window === 'undefined') return ''
    const storedWikiUrl = window.localStorage.getItem('nestland_wiki_url')
    return storedWikiUrl ?? ''
  })
  const [customRoles, setCustomRoles] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    const storedRoles = window.localStorage.getItem('nestland_custom_roles')
    if (!storedRoles) return []
    try {
      const parsed = JSON.parse(storedRoles)
      if (Array.isArray(parsed)) {
        return parsed.filter((role) => typeof role === 'string')
      }
      return []
    } catch {
      return []
    }
  })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isAdminPanelMinimized, setIsAdminPanelMinimized] = useState(false)
  const [adminPanelHeight, setAdminPanelHeight] = useState<'sm' | 'md' | 'lg' | 'full'>('md')
  const [newRoleName, setNewRoleName] = useState('')
  const [rolesError, setRolesError] = useState<string | null>(null)

  const [appMessage] = useState<string | null>(null)
  const [appMessageType] = useState<'success' | 'error'>('success')

  const isAdmin = user?.email === ADMIN_EMAIL

  // Modal polish: body scroll lock and Escape to close
  useEffect(() => {
    const anyOpen = isNewProjectModalOpen || isProjectModalOpen
    const prev = document.body.style.overflow
    if (anyOpen) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = prev
    }
  }, [isNewProjectModalOpen, isProjectModalOpen])

  useEffect(() => {
    if (!isNewProjectModalOpen && !isProjectModalOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isProjectModalOpen) setIsProjectModalOpen(false)
        if (isNewProjectModalOpen) setIsNewProjectModalOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isNewProjectModalOpen, isProjectModalOpen])

  useEffect(() => {
    // Load user from localStorage on mount
    const currentUser = getCurrentUser()
    setUser(currentUser)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }

    checkDesktop()

    const mediaQuery = window.matchMedia('(min-width: 1024px)')
    const handleChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('nestland_wiki_url', wikiUrl)
  }, [wikiUrl])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('nestland_custom_roles', JSON.stringify(customRoles))
  }, [customRoles])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const root = document.documentElement
    const body = document.body
    if (isWhiteMode) {
      root.classList.add('theme-light')
      body.classList.add('theme-light')
      window.localStorage.setItem('nestland_theme', 'light')
    } else {
      root.classList.remove('theme-light')
      body.classList.remove('theme-light')
      window.localStorage.setItem('nestland_theme', 'dark')
    }
  }, [isWhiteMode])

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
           
          console.error('Failed to load processes', error)
          setProcessError('Failed to load processes')
        } else {
          const rows = data ?? []
          setProcesses(rows)
          setProcessError(null)

          if (rows.length > 0) {
            const preferred = rows.find((p) => p.slug === DEFAULT_PROCESS_SLUG)
            const first = preferred ?? rows[0]
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
  }, [])

  useEffect(() => {
    if (activePage !== 'wiki') return

    const client = supabase
    if (!client) return

    let isCancelled = false

    const loadWiki = async () => {
      setIsLoadingWiki(true)
      const { data, error } = await client
        .from('company_wiki')
        .select('title, content, categories')
        .eq('slug', 'company_regulations')
        .single()

      if (!isCancelled) {
        if (error) {
           
          console.error('Failed to load wiki', error)
          setWikiError('Failed to load wiki')
        } else if (data) {
          setWikiTitle(data.title)
          setWikiContent(data.content)
          setWikiCategories((data as { categories?: string | null }).categories ?? '')
          setWikiError(null)
        }
        setIsLoadingWiki(false)
      }
    }

    void loadWiki()

    return () => {
      isCancelled = true
    }
  }, [activePage])

  useEffect(() => {
    if (activePage !== 'projects') return

    const client = supabase
    if (!client) return

    let isCancelled = false

    const loadProjects = async () => {
      setIsLoadingProjects(true)
      setProjectsError(null)
      const { data, error } = await client.rpc('get_project_overview')

      if (isCancelled) {
        return
      }

      if (error) {
         
        console.error('Failed to load projects via overview', error)
        setProjects([])
        setProjectSteps([])
        setProjectComments([])
        setProjectsError('Failed to load projects')
        setIsLoadingProjects(false)
        return
      }

      const items = (data ?? []) as Array<
        Partial<{
          project: Project
          steps: Array<
            Partial<{
              id: string
              process_id: string
              title: string
              order_index: number
              description: string | null
              duration_days: number | null
            }>
          >
          comments: Array<
            Partial<{
              id: string
              project_id: string
              step_id: string
              body: string
              created_at: string
              created_by: string | null
            }>
          >
        }>
      >

      if (items.length === 0) {
        setProjects([])
        setProjectSteps([])
        setProjectComments([])
        setIsLoadingProjects(false)
        return
      }

      const nextProjects: Project[] = []
      const nextSteps: ProjectStepSummary[] = []
      const nextComments: ProjectStepComment[] = []
      const seenProcessIds = new Set<string>()

      for (const item of items) {
        if (item.project) {
          nextProjects.push(item.project)
        }

        if (Array.isArray(item.steps)) {
          const processIdFromProject = item.project?.process_id ?? null
          const processId =
            processIdFromProject || (item.steps[0]?.process_id as string | undefined) || null

          if (processId && !seenProcessIds.has(processId)) {
            seenProcessIds.add(processId)

            for (const step of item.steps) {
              if (!step || !step.id || !step.title) continue
              nextSteps.push({
                id: step.id,
                process_id: processId,
                title: step.title,
                order_index: step.order_index ?? 0,
                description: (step as { description?: string | null }).description ?? null,
                duration_days: (step as { duration_days?: number | null }).duration_days ?? null,
              })
            }
          }
        }

        if (Array.isArray(item.comments)) {
          for (const comment of item.comments) {
            if (!comment || !comment.id || !comment.project_id || !comment.step_id) continue
            nextComments.push({
              id: comment.id,
              project_id: comment.project_id,
              step_id: comment.step_id,
              body: comment.body ?? '',
              created_at: comment.created_at ?? new Date().toISOString(),
              created_by: (comment as { created_by?: string | null }).created_by ?? null,
            })
          }
        }
      }

      setProjects(nextProjects)
      setProjectSteps(nextSteps)
      setProjectComments(nextComments)
      setProjectCommentsError(null)
      setIsLoadingProjects(false)
    }

    void loadProjects()

    return () => {
      isCancelled = true
    }
  }, [activePage])

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
          .select('id, process_id, title, description, role, order_index, duration_days, created_at')
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
             
            console.error('Failed to load steps', stepsResult.error)
          }
          if (transitionsResult.error) {
             
            console.error('Failed to load transitions', transitionsResult.error)
          }
          setFlowError('Failed to load process flow')
        } else {
          setSteps(stepsResult.data ?? [])
          setTransitions(transitionsResult.data ?? [])
          setFlowError(null)
          setFlowVersion((value) => value + 1)
        }
        setIsLoadingFlow(false)
      }
    }

    void loadFlow()

    return () => {
      isCancelled = true
    }
  }, [selectedProcessId])

  useEffect(() => {
    // When the selected process or its steps change, ensure we don't keep
    // a step selected that doesn't belong to the current process. We do NOT
    // auto-select any step by default.
    if (!selectedProcessId || steps.length === 0) {
      return
    }
  }, [selectedProcessId, steps, selectedStepId])

  useEffect(() => {
    if (activePage !== 'settings') return

    const client = supabase
    if (!client) return

    if (!user) return

    let isCancelled = false

    const loadProfile = async () => {
      setIsLoadingProfile(true)
      setProfileError(null)
      setProfileSuccess(null)

      const { data, error } = await client
        .from('profiles')
        .select('full_name, role, email')
        .eq('id', user.id)
        .maybeSingle()

      if (isCancelled) return

      if (error) {
         
        console.error('Failed to load profile', error)
        setProfileError('Failed to load profile')
      } else if (data) {
        const fullName = (data as { full_name?: string | null }).full_name ?? ''
        const [first = '', ...rest] = fullName.split(' ')
        const last = rest.join(' ')
        setProfileFirstName(first)
        setProfileLastName(last)
        setProfileRole((data as { role?: string | null }).role ?? '')
        setProfileError(null)
      } else {
        setProfileFirstName('')
        setProfileLastName('')
        setProfileRole('')
      }

      setIsLoadingProfile(false)
    }

    void loadProfile()

    return () => {
      isCancelled = true
    }
  }, [activePage, user])

  useEffect(() => {
    const client = supabase
    if (!client) return

    let isCancelled = false

    const loadComments = async () => {
      setIsLoadingComments(true)
      const { data, error } = await client
        .from('comments')
        .select('id, created_at, process_id, step_id, body, status, context')
        .eq('process_id', selectedProcessSlug ?? DEFAULT_PROCESS_SLUG)
        .order('created_at', { ascending: false })

      if (!isCancelled) {
        if (error) {
           
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

  useEffect(() => {
    const client = supabase
    if (!client) return

    const ids = new Set<string>()
    for (const comment of projectComments) {
      if (comment.created_by) {
        ids.add(comment.created_by)
      }
    }

    if (ids.size === 0) {
      return
    }

    let isCancelled = false

    const loadAuthors = async () => {
      const { data, error } = await client
        .from('profiles')
        .select('id, full_name')
        .in('id', Array.from(ids))

      if (isCancelled || error || !data) {
        return
      }

      const next: Record<string, string> = {}
      for (const row of data as Array<{ id: string; full_name: string | null }>) {
        const fullName = row.full_name ?? ''
        const [first = ''] = fullName.split(' ')
        if (first) {
          next[row.id] = first
        }
      }

      if (!isCancelled && Object.keys(next).length > 0) {
        setAuthorFirstNames((prev) => ({ ...prev, ...next }))
      }
    }

    void loadAuthors()

    return () => {
      isCancelled = true
    }
  }, [projectComments])

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
          author_first_name: (() => {
            const preferred = profileFirstName.trim()
            if (preferred) return preferred
            if (!user?.email) return null
            const localPart = user.email.split('@')[0] ?? ''
            const token = localPart.split(/[._\s-]+/)[0] || localPart
            if (!token) return null
            return token.charAt(0).toUpperCase() + token.slice(1)
          })(),
        },
      })
      .select('id, created_at, process_id, step_id, body, status, context')
      .single()

    if (error) {
       
      console.error('Failed to post comment', error)
      setCommentError('Failed to post comment')
    } else if (data) {
      setComments((prev) => [data, ...prev])
      setNewComment('')
      setCommentError(null)
      
      // Send push notification for new comment
      const authorName = (() => {
        const preferred = profileFirstName.trim()
        if (preferred) return preferred
        if (!user?.email) return null
        const localPart = user.email.split('@')[0] ?? ''
        const token = localPart.split(/[._\s-]+/)[0] || localPart
        if (!token) return null
        return token.charAt(0).toUpperCase() + token.slice(1)
      })()
      
      const currentProcess = processes.find(p => p.slug === (selectedProcessSlug ?? DEFAULT_PROCESS_SLUG))
      void notifyNewComment({
        authorName,
        commentBody: body,
        processName: currentProcess?.name,
      })
    }

    setIsSubmittingComment(false)
  }

  const handleSaveProfile = async (event: FormEvent) => {
    event.preventDefault()

    if (!supabase) return
    if (!user) {
      setProfileError('You must be signed in to update your profile.')
      return
    }

    const firstName = profileFirstName.trim()
    const lastName = profileLastName.trim()
    const role = profileRole.trim()

    if (!firstName && !lastName) {
      setProfileError('Display name is required.')
      setProfileSuccess(null)
      return
    }

    if (!role) {
      setProfileError('Company role is required.')
      setProfileSuccess(null)
      return
    }

    setIsSavingProfile(true)
    setProfileError(null)
    setProfileSuccess(null)

    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        full_name: `${firstName} ${lastName}`.trim() || null,
        role: role || null,
      })
      .select('full_name, role')
      .single()

    if (error) {
       
      console.error('Failed to save profile', error)
      const err = error as { message?: string; details?: string }
      setProfileError(err.message || err.details || 'Failed to save profile')
    } else if (data) {
      const fullName = (data as { full_name?: string | null }).full_name ?? ''
      const [savedFirst = '', ...rest] = fullName.split(' ')
      const savedLast = rest.join(' ')
      setProfileFirstName(savedFirst)
      setProfileLastName(savedLast)
      setProfileRole((data as { role?: string | null }).role ?? '')
      setProfileSuccess('Profile updated')
    }

    setIsSavingProfile(false)
  }

  const handleSaveWiki = async (event: FormEvent) => {
    event.preventDefault()

    if (!supabase) return
    if (!isAdmin) return

    const title = wikiDraftTitle.trim() || 'Company Regulations'
    const content = wikiDraftContent.trim()

    if (!content) {
      setWikiError('Wiki content cannot be empty.')
      return
    }

    setIsSavingWiki(true)
    setWikiError(null)

    const { data, error } = await supabase
      .from('company_wiki')
      .upsert({
        slug: 'company_regulations',
        title,
        content,
      })
      .select('title, content')
      .single()

    if (error) {
       
      console.error('Failed to save wiki', error)
      setWikiError('Failed to save wiki')
    } else if (data) {
      setWikiTitle(data.title)
      setWikiContent(data.content)
      setIsEditingWiki(false)
    }

    setIsSavingWiki(false)
  }

  const handleCreateProject = async (event: FormEvent) => {
    event.preventDefault()

    if (!supabase) return

    if (!user) {
      setProjectFormError('You must be signed in to create a project.')
      return
    }

    const name = newProjectName.trim()
    const processId = newProjectProcessId

    if (!name || !processId) {
      setProjectFormError('Project name and process are required.')
      return
    }

    setIsCreatingProject(true)
    setProjectFormError(null)

    const { data, error } = await supabase
      .from('projects')
      .insert({ name, process_id: processId })
      .select('id, name, process_id, current_step_id, status, created_at')
      .single()

    if (error) {
       
      console.error('Failed to create project', error)
      setProjectFormError('Failed to create project')
    } else if (data) {
      setProjects((prev) => [data, ...prev])
      setNewProjectName('')
      setNewProjectProcessId('')
      setIsNewProjectModalOpen(false)
    }

    setIsCreatingProject(false)
  }

  const handleChangeProjectStep = async (projectId: string, stepId: string | null) => {
    if (!supabase) return

    if (!user) {
      setProjectsError('You must be signed in to update project progress.')
      return
    }

    setIsChangingProjectStep(true)
    let data: Project | null = null
    try {
      const resp = await supabase
        .from('projects')
        .update({ current_step_id: stepId })
        .eq('id', projectId)
        .select('id, name, process_id, current_step_id, status, created_at')
        .single()

      if (resp.error) {
        console.error('Failed to update project step', resp.error)
        setProjectsError('Failed to update project step')
        return
      }
      data = resp.data as Project
      setProjects((prev) => prev.map((project) => (project.id === projectId ? (data as Project) : project)))
      setProjectsError(null)
    } finally {
      setIsChangingProjectStep(false)
    }
  }

  const handleSubmitProjectStepComment = async (
    event: FormEvent,
    projectId: string,
    stepId: string | null,
  ) => {
    event.preventDefault()

    if (!supabase) return

    if (!user) {
      setProjectCommentsError('You must be signed in to post project step comments.')
      return
    }

    if (!stepId) return

    const key = `${projectId}:${stepId}`
    const body = (newProjectComments[key] ?? '').trim()
    if (!body) return

    setIsSubmittingProjectCommentKey(key)
    setProjectCommentsError(null)

    const { data, error } = await supabase
      .from('project_step_comments')
      .insert({
        project_id: projectId,
        step_id: stepId,
        body,
        created_by: user.id,
      })
      .select('id, project_id, step_id, body, created_at, created_by')
      .single()

    if (error) {
       
      console.error('Failed to post project step comment', error)
      setProjectCommentsError('Failed to post project step comment')
    } else if (data) {
      setProjectComments((prev) => [data, ...prev])
      setNewProjectComments((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      
      // Send push notification for new project step comment
      const project = projects.find(p => p.id === projectId)
      const step = projectSteps.find(s => s.id === stepId)
      void notifyNewComment({
        authorName: profileFirstName.trim() || null,
        commentBody: body,
        projectName: project?.name,
        stepTitle: step?.title,
      })
    }

    setIsSubmittingProjectCommentKey(null)
  }

  const handleDeleteProjectStepComment = async (commentId: string) => {
    if (!supabase) return
    if (!isAdmin) return

    setDeletingProjectCommentId(commentId)
    setProjectCommentsError(null)

    console.log('=== DELETE COMMENT DEBUG ===')
    console.log('Comment ID to delete:', commentId)
    console.log('User email:', user?.email)

    const { data, error } = await supabase
      .from('project_step_comments')
      .delete()
      .eq('id', commentId)
      .select()

    console.log('Delete response:', { data, error })

    if (error) {
       
      console.error('Failed to delete project step comment', error)
      setProjectCommentsError(`Failed to delete: ${error.message}`)
    } else if (!data || data.length === 0) {
      // RLS policy prevented deletion - no rows were actually deleted
      console.error('Delete returned no rows - comment may not exist or RLS blocking')
      setProjectCommentsError('Unable to delete comment. It may not exist or you lack permission.')
    } else {
      console.log('Delete SUCCESS! Removed:', data)
      setProjectComments((prev) => prev.filter((comment) => comment.id !== commentId))
    }

    setDeletingProjectCommentId(null)
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!supabase) return
    if (!isAdmin) return

    const confirmed = window.confirm(
      'Are you sure you want to delete this project? This cannot be undone.',
    )
    if (!confirmed) return

    setIsDeletingProjectId(projectId)
    setProjectsError(null)

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)

    if (error) {
       
      console.error('Failed to delete project', error)
      setProjectsError('Failed to delete project')
    } else {
      setProjects((prev) => prev.filter((project) => project.id !== projectId))
      setProjectComments((prev) => prev.filter((comment) => comment.project_id !== projectId))
      if (expandedProjectHistoryId === projectId) {
        setExpandedProjectHistoryId(null)
      }
    }

    setIsDeletingProjectId(null)
  }

  const handleStartEditProjectName = (project: Project) => {
    if (!isAdmin) return
    setEditingProjectId(project.id)
    setEditingProjectName(project.name)
  }

  const handleOpenProjectModal = (project: Project) => {
    if (!user) return
    setSelectedProjectForModal(project)
    setIsProjectModalOpen(true)
    void loadProjectFiles(project.id)
    void loadProjectInvoices(project.id)
  }

  const handleCloseProjectModal = () => {
    setIsProjectModalOpen(false)
    setSelectedProjectForModal(null)
  }

  const handleCancelEditProjectName = () => {
    setEditingProjectId(null)
    setEditingProjectName('')
  }

  const loadProjectFiles = async (projectId: string) => {
    if (!supabase) return
    setFilesError(null)
    try {
      const prefix = `projects/${projectId}`
      const { data, error } = await supabase.storage.from(PROJECT_FILES_BUCKET).list(prefix, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'updated_at', order: 'desc' },
      })
      if (error) {
        setFilesError('Failed to list files')
        return
      }
      const files = data ?? []
      const withUrls: { name: string; path: string; size: number; url: string }[] = []
      for (const f of files) {
        if (f.name === '.emptyFolderPlaceholder') continue
        const path = `${prefix}/${f.name}`
        const { data: urlData } = await supabase.storage
          .from(PROJECT_FILES_BUCKET)
          .createSignedUrl(path, 60 * 60)
        const fileObj = f as { metadata?: { size?: number }; size?: number }
        const metaSize = fileObj.metadata?.size
        const size = typeof metaSize === 'number' ? metaSize : (typeof fileObj.size === 'number' ? fileObj.size : 0)
        withUrls.push({ name: f.name, path, size, url: urlData?.signedUrl ?? '#' })
      }
      setProjectFiles((prev) => ({ ...prev, [projectId]: withUrls }))
    } catch {
      setFilesError('Failed to list files')
    }
  }

  const handleUploadProjectFiles = async (projectId: string, files: FileList | null) => {
    if (!supabase || !files || files.length === 0) return
    setIsUploadingFilesProjectId(projectId)
    setFilesError(null)
    try {
      const failures: { name: string; message: string }[] = []
      for (const file of Array.from(files)) {
        const path = `projects/${projectId}/${Date.now()}-${file.name}`
        const { error } = await supabase.storage.from(PROJECT_FILES_BUCKET).upload(path, file, {
          upsert: true,
        })
        if (error) {
          failures.push({ name: file.name, message: error.message ?? 'Unknown error' })
        }
      }
      // Refresh list regardless of failures so successfully uploaded files appear
      await loadProjectFiles(projectId)
      if (failures.length > 0) {
        const failedList = failures.map((f) => f.name).join(', ')
        setFilesError(`Failed to upload ${failures.length} file(s): ${failedList}`)
      }
    } finally {
      setIsUploadingFilesProjectId(null)
    }
  }

  const loadProjectInvoices = async (projectId: string) => {
    if (!supabase) return
    setInvoicesError(null)
    const { data, error } = await supabase
      .from('project_invoices')
      .select('id, project_id, amount, description, created_at, invoice_number, direction')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
    if (error) {
      setInvoicesError('Failed to load invoices')
      return
    }
    setInvoicesByProject((prev) => ({ ...prev, [projectId]: (data as ProjectInvoice[]) ?? [] }))
  }

  const handleAddInvoice = async (event: FormEvent, projectId: string) => {
    event.preventDefault()
    if (!supabase) return
    const amountStr = newInvoiceAmountByProject[projectId] ?? ''
    const description = (newInvoiceDescByProject[projectId] ?? '').trim()
    const invoice_number = (newInvoiceNumberByProject[projectId] ?? '').trim()
    const direction = (newInvoiceDirectionByProject[projectId] ?? 'paid') as 'paid' | 'received'
    const amount = Number(amountStr)
    if (!Number.isFinite(amount) || amount <= 0) {
      setInvoicesError('Please enter a valid positive amount')
      return
    }
    setIsAddingInvoiceProjectId(projectId)
    setInvoicesError(null)
    const { data, error } = await supabase
      .from('project_invoices')
      .insert({ project_id: projectId, amount, description, invoice_number, direction })
      .select('id, project_id, amount, description, created_at, invoice_number, direction')
      .single()
    if (error) {
      setInvoicesError('Failed to add invoice')
    } else if (data) {
      setInvoicesByProject((prev) => ({
        ...prev,
        [projectId]: [data as ProjectInvoice, ...(prev[projectId] ?? [])],
      }))
      setNewInvoiceAmountByProject((prev) => ({ ...prev, [projectId]: '' }))
      setNewInvoiceDescByProject((prev) => ({ ...prev, [projectId]: '' }))
      setNewInvoiceNumberByProject((prev) => ({ ...prev, [projectId]: '' }))
      setNewInvoiceDirectionByProject((prev) => ({ ...prev, [projectId]: 'paid' }))
      setInvoicesError(null)
    }
    setIsAddingInvoiceProjectId(null)
  }

  const handleDeleteInvoice = async (invoiceId: string, projectId: string) => {
    if (!supabase) return
    setIsDeletingInvoiceId(invoiceId)
    setInvoicesError(null)
    const { error } = await supabase.from('project_invoices').delete().eq('id', invoiceId)
    if (error) {
      setInvoicesError('Failed to delete invoice')
    } else {
      setInvoicesByProject((prev) => ({
        ...prev,
        [projectId]: (prev[projectId] ?? []).filter((inv) => inv.id !== invoiceId),
      }))
    }
    setIsDeletingInvoiceId(null)
  }

  const handleDeleteProjectFile = async (projectId: string, path: string) => {
    if (!supabase) return
    setIsDeletingFilePath(path)
    setFilesError(null)
    const { error } = await supabase.storage.from(PROJECT_FILES_BUCKET).remove([path])
    if (error) {
      setFilesError('Failed to delete file')
    } else {
      await loadProjectFiles(projectId)
    }
    setIsDeletingFilePath(null)
  }

  const handleSaveProjectName = async (event: FormEvent, projectId: string) => {
    event.preventDefault()

    if (!supabase) return
    if (!isAdmin) return

    const name = editingProjectName.trim()
    if (!name) {
      setProjectsError('Project name is required.')
      return
    }

    setIsUpdatingProjectNameId(projectId)
    setProjectsError(null)

    const { data, error } = await supabase
      .from('projects')
      .update({ name })
      .eq('id', projectId)
      .select('id, name, process_id, current_step_id, status, created_at')
      .single()

    if (error) {
       
      console.error('Failed to update project name', error)
      setProjectsError('Failed to update project name')
    } else if (data) {
      setProjects((prev) => prev.map((project) => (project.id === projectId ? data : project)))
      setEditingProjectId(null)
      setEditingProjectName('')
    }

    setIsUpdatingProjectNameId(null)
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
       
      console.error('Failed to resolve comment', error)
      setCommentError('Failed to resolve comment')
    } else if (data) {
      setComments((prev) => prev.map((comment) => (comment.id === id ? data : comment)))
      setCommentError(null)
    }
    setResolvingCommentId(null)
  }

  const handleDeleteComment = async (id: string) => {
    if (!supabase) return
    if (!isAdmin) return

    console.log('=== DELETE WORKFLOW COMMENT DEBUG ===')
    console.log('Comment ID to delete:', id)

    const { data, error } = await supabase
      .from('comments')
      .delete()
      .eq('id', id)
      .select()

    console.log('Delete response:', { data, error })

    if (error) {
       
      console.error('Failed to delete comment', error)
      setCommentError('Failed to delete comment')
      return
    }

    if (!data || data.length === 0) {
      console.error('Delete returned no rows - RLS policy may be blocking')
      setCommentError('Permission denied: Unable to delete comment.')
      return
    }

    console.log('Delete SUCCESS!')
    setComments((prev) => prev.filter((comment) => comment.id !== id))
    setCommentError(null)
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
    const { data, error } = await auth.signInWithPassword({ email, password })

    if (error) {
      console.error('Failed to log in', error)
      setAuthMessage(error.message || 'Login failed. Check email and password.')
    } else if (data.user) {
      setUser(data.user)
      setAuthMessage(null)
    }
    setIsLoggingIn(false)
  }

  const handleSignOut = async () => {
    await auth.signOut()
    setUser(null)
  }

  const handleSelectProcess = (slug: string, id: string) => {
    setSelectedProcessSlug(slug)
    setSelectedProcessId(id)

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
        setNewStepOrder(String(step.order_index))
        setNewStepDescription(step.description ?? '')
        if (step.duration_days !== null && step.duration_days !== undefined) {
          const total = step.duration_days
          const wholeDays = Math.trunc(total)
          const rawHours = Math.round((total - wholeDays) * 24)
          const hours = Math.min(23, rawHours)
          setNewStepDurationDays(wholeDays ? String(wholeDays) : '')
          setNewStepDurationHours(hours ? String(hours) : '')
        } else {
          setNewStepDurationDays('')
          setNewStepDurationHours('')
        }
      }
    }
  }

  const handleAddRole = (event: FormEvent) => {
    event.preventDefault()
    const name = newRoleName.trim()
    if (!name) return
    setCustomRoles((prev) => {
      if (prev.includes(name)) return prev
      return [...prev, name]
    })
    setNewRoleName('')
  }

  const handleRemoveRole = (role: string) => {
    // Do not allow removing a role that is still used by any step
    const isUsed = steps.some((step) => {
      const roles = (step.role ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
      return roles.includes(role)
    })

    if (isUsed) {
      setRolesError(`Cannot remove role "${role}" because it is still used in one or more steps.`)
      return
    }

    setCustomRoles((prev) => prev.filter((item) => item !== role))
    setRolesError(null)
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

    const daysStr = newStepDurationDays.trim()
    const hoursStr = newStepDurationHours.trim()
    let daysNum = 0
    let hoursNum = 0
    let hasAnyDuration = false

    if (daysStr !== '') {
      const parsed = Number(daysStr)
      if (!Number.isFinite(parsed) || parsed < 0) {
        setStepFormError('Days must be a non-negative number.')
        return
      }
      daysNum = parsed
      hasAnyDuration = true
    }

    if (hoursStr !== '') {
      const parsed = Number(hoursStr)
      if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 24) {
        setStepFormError('Hours must be between 0 and 23.')
        return
      }
      hoursNum = parsed
      hasAnyDuration = true
    }

    const durationDays = hasAnyDuration ? daysNum + hoursNum / 24 : null

    setIsCreatingStep(true)
    setStepFormError(null)
    const expectedStepCount = steps.filter((step) => step.process_id === selectedProcessId).length

    let createdStep: ProcessStep | null = null

    // First, try to perform an atomic insert using a transactional RPC.
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'insert_process_step_with_shift',
        {
          process_id: selectedProcessId,
          title,
          role: newStepRole.trim() || null,
          order_index: orderIndex,
          description: newStepDescription.trim() || null,
          duration_days: durationDays,
          expected_step_count: expectedStepCount,
        },
      )

      if (rpcError) {
        // If the RPC reports a concurrency conflict, surface that explicitly.
        const message = rpcError.message ?? ''
        const code = (rpcError as { code?: string }).code

        if (code === 'P0004' || message.toLowerCase().includes('concurrent')) {
          setStepFormError(
            'The workflow changed while you were editing. Please reload and try again.',
          )
          setIsCreatingStep(false)
          return
        }

         
        console.error('insert_process_step_with_shift RPC failed, falling back', rpcError)
      } else if (rpcResult) {
        createdStep = Array.isArray(rpcResult)
          ? (rpcResult[0] as ProcessStep)
          : (rpcResult as ProcessStep)
      }
    } catch (rpcUnexpectedError) {
       
      console.error('Unexpected RPC error during step creation, falling back', rpcUnexpectedError)
    }

    // Fallback path: preserve the existing non-transactional behaviour if RPC is unavailable.
    if (!createdStep) {
      // Shift existing steps at or after the desired order index down by 1
      const { data: stepsToShift, error: shiftQueryError } = await supabase
        .from('process_steps')
        .select('id, order_index, process_id')
        .eq('process_id', selectedProcessId)
        .gte('order_index', orderIndex)
        .order('order_index', { ascending: false })

      if (shiftQueryError) {
        setStepFormError('Failed to prepare step insertion.')
        setIsCreatingStep(false)
        return
      }

      if (stepsToShift && stepsToShift.length > 0) {
        for (const step of stepsToShift) {
          const { error: shiftError } = await supabase
            .from('process_steps')
            .update({ order_index: (step.order_index || 0) + 1 })
            .eq('id', step.id)

          if (shiftError) {
            setStepFormError('Failed to shift existing steps when inserting.')
            setIsCreatingStep(false)
            return
          }
        }
      }

      const { data, error } = await supabase
        .from('process_steps')
        .insert({
          process_id: selectedProcessId,
          title,
          role: newStepRole.trim() || null,
          order_index: orderIndex,
          description: newStepDescription.trim() || null,
          duration_days: durationDays,
        })
        .select('id, process_id, title, description, role, order_index, duration_days, created_at')
        .single()

      if (error) {
         
        console.error('Failed to create step', error)
        setStepFormError('Failed to create step')
        setIsCreatingStep(false)
        return
      }

      createdStep = data as ProcessStep
    }

    if (createdStep) {
      setSteps((prev) => {
        const shifted = prev.map((step) => {
          if (step.process_id !== selectedProcessId) return step
          if ((step.order_index || 0) < orderIndex) return step
          return { ...step, order_index: (step.order_index || 0) + 1 }
        })
        return [...shifted, createdStep!].sort((a, b) => a.order_index - b.order_index)
      })
      setNewStepTitle('')
      setNewStepRole('')
      setNewStepOrder('0')
      setNewStepDescription('')
      setNewStepDurationDays('')
      setNewStepDurationHours('')
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

    const daysStr = newStepDurationDays.trim()
    const hoursStr = newStepDurationHours.trim()
    let daysNum = 0
    let hoursNum = 0
    let hasAnyDuration = false

    if (daysStr !== '') {
      const parsed = Number(daysStr)
      if (!Number.isFinite(parsed) || parsed < 0) {
        setStepFormError('Days must be a non-negative number.')
        return
      }
      daysNum = parsed
      hasAnyDuration = true
    }

    if (hoursStr !== '') {
      const parsed = Number(hoursStr)
      if (!Number.isFinite(parsed) || parsed < 0 || parsed >= 24) {
        setStepFormError('Hours must be between 0 and 23.')
        return
      }
      hoursNum = parsed
      hasAnyDuration = true
    }

    const durationDays = hasAnyDuration ? daysNum + hoursNum / 24 : null

    setIsCreatingStep(true)
    setStepFormError(null)
    const { data, error } = await supabase
      .from('process_steps')
      .update({
        title,
        role: newStepRole.trim() || null,
        order_index: orderIndex,
        description: newStepDescription.trim() || null,
        duration_days: durationDays,
      })
      .eq('id', selectedStepId)
      .select('id, process_id, title, description, role, order_index, duration_days, created_at')
      .single()

    if (error) {
       
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
       
      console.error('Failed to create transition from connect', error)
      setTransitionFormError('Failed to create connection between steps')
    } else if (data) {
      setTransitions((prev) => [...prev, data])
      setTransitionFormError(null)
    }
  }

  const handleDeleteTransition = async (transitionId: string) => {
    if (!supabase) return
    if (!isAdmin) return

    const { error } = await supabase
      .from('process_transitions')
      .delete()
      .eq('id', transitionId)

    if (error) {
       
      console.error('Failed to delete connection', error)
      setTransitionFormError('Failed to delete connection between steps')
      return
    }

    setTransitions((prev) => prev.filter((transition) => transition.id !== transitionId))
    setTransitionFormError(null)
  }

  const [isAutoConnecting, setIsAutoConnecting] = useState(false)

  const handleAutoConnectSteps = async () => {
    if (!supabase) return
    if (!isAdmin) return
    if (!selectedProcessId) return

    // Get steps for this process sorted by order_index
    const processSteps = steps
      .filter((s) => s.process_id === selectedProcessId)
      .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))

    if (processSteps.length < 2) {
      setTransitionFormError('Need at least 2 steps to auto-connect')
      return
    }

    setIsAutoConnecting(true)
    setTransitionFormError(null)

    // Get existing transitions for this process
    const existingTransitions = transitions.filter((t) => t.process_id === selectedProcessId)
    const existingPairs = new Set(
      existingTransitions.map((t) => `${t.from_step_id}:${t.to_step_id}`)
    )

    const newTransitions: ProcessTransition[] = []

    // Create transitions between consecutive steps
    for (let i = 0; i < processSteps.length - 1; i++) {
      const fromStep = processSteps[i]
      const toStep = processSteps[i + 1]
      const pairKey = `${fromStep.id}:${toStep.id}`

      // Skip if transition already exists
      if (existingPairs.has(pairKey)) continue

      const { data, error } = await supabase
        .from('process_transitions')
        .insert({
          process_id: selectedProcessId,
          from_step_id: fromStep.id,
          to_step_id: toStep.id,
          label: null,
        })
        .select('id, process_id, from_step_id, to_step_id, label')
        .single()

      if (error) {
        console.error('Failed to create auto-connection', error)
        setTransitionFormError(`Failed to connect step ${i + 1} to step ${i + 2}`)
        break
      } else if (data) {
        newTransitions.push(data)
      }
    }

    if (newTransitions.length > 0) {
      setTransitions((prev) => [...prev, ...newTransitions])
    }

    setIsAutoConnecting(false)
  }

  const visibleComments = useMemo(() => {
    if (!selectedStepId) return []
    return comments.filter((comment) => comment.step_id === selectedStepId)
  }, [comments, selectedStepId])

  const openCommentStepIds = useMemo(() => new Set(
    comments
      .filter((comment) => comment.status === 'open' && comment.step_id)
      .map((comment) => comment.step_id as string),
  ), [comments])

  const { nodes, edges } = useMemo(() => {
    if (steps.length === 0) {
      return { nodes: [], edges: [] }
    }

    const getLaneKey = (step: ProcessStep): string => {
      const roles = (step.role ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value.length > 0)

      if (roles.length === 0) return 'Unassigned'
      if (roles.length === 1) return roles[0]

      return roles.sort((a, b) => a.localeCompare(b)).join(' & ')
    }

    const lanes = Array.from(new Set(steps.map((step) => getLaneKey(step))))
    const laneIndexMap = new Map<string, number>()
    lanes.forEach((lane, index) => laneIndexMap.set(lane, index))

    // Vertical layout: order_index controls Y (downwards), lane controls X (left→right)
    const xGap = 260
    const yGap = 140

    const dynamicNodes: Node[] = steps.map((step) => {
      const laneKey = getLaneKey(step)
      const laneIndex = laneIndexMap.get(laneKey) ?? 0
      const position = {
        x: laneIndex * xGap,
        y: (step.order_index || 0) * yGap,
      }

      const roleColors = getRoleColors(step.role, isWhiteMode)

      const baseStyle: CSSProperties = {
        borderRadius: 16,
        paddingInline: 18,
        paddingBlock: 10,
        border: `2px solid ${roleColors.border}`,
        background: roleColors.background,
        color: roleColors.text,
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
      style: {
        stroke: isWhiteMode ? '#0f172a' : '#e5e7eb',
        strokeWidth: 2,
      },
    }))

    return { nodes: dynamicNodes, edges: dynamicEdges }
  }, [steps, transitions, openCommentStepIds, selectedStepId, isWhiteMode])

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

  const dynamicRoleOptions = useMemo(
    () =>
      Array.from(
        new Set(customRoles.map((role) => role.trim()).filter((role) => role.length > 0)),
      ),
    [customRoles],
  )

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

  // Desktop-only check
  if (!isDesktop) {
    return (
      <div className={`min-h-screen flex items-center justify-center text-sm ${
        isWhiteMode ? 'bg-slate-50 text-slate-900' : 'text-slate-100'
      }`}>
        <div className="max-w-md mx-auto text-center px-6">
          <div className={`flex h-16 w-16 items-center justify-center rounded-full border shadow-soft-elevated mx-auto mb-6 ${
            isWhiteMode
              ? 'border-amber-600 bg-gradient-to-br from-amber-50 to-amber-100'
              : 'border-nest-gold/60 bg-gradient-to-br from-nest-green-dark to-black'
          }`}>
            <span className="text-lg font-semibold tracking-[0.15em] text-nest-gold">
              NL
            </span>
          </div>
          <h1 className={`text-2xl font-bold mb-4 ${
            isWhiteMode ? 'text-slate-900' : 'text-slate-50'
          }`}>
            Desktop Only
          </h1>
          <p className={`text-base mb-6 ${
            isWhiteMode ? 'text-slate-600' : 'text-slate-400'
          }`}>
            Unfortunately, the Nestland Command Center is only available on desktop devices. 
            Please switch to a desktop or laptop computer to access the workflow management system.
          </p>
          <div className={`text-sm ${
            isWhiteMode ? 'text-slate-500' : 'text-slate-500'
          }`}>
            <p>Minimum screen width: 1024px</p>
            <p className="mt-2">Recommended browsers: Chrome, Firefox, Safari, or Edge</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`min-h-screen flex flex-col text-sm ${
        isWhiteMode ? 'bg-slate-50 text-slate-900' : 'text-slate-100'
      }`}
    >
      <header className={`border-b backdrop-blur ${
        isWhiteMode
          ? 'border-slate-200 bg-gradient-to-r from-white via-slate-50 to-slate-100'
          : 'border-white/5 bg-gradient-to-r from-nest-bg/80 via-black/80 to-nest-green-dark/40'
      }`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className={`hidden lg:flex h-9 w-9 items-center justify-center rounded-full border shadow-soft-elevated ${
              isWhiteMode
                ? 'border-amber-600 bg-gradient-to-br from-amber-50 to-amber-100'
                : 'border-nest-gold/60 bg-gradient-to-br from-nest-green-dark to-black'
            }`}>
              <span className="text-xs font-semibold tracking-[0.15em] text-nest-gold">
                NL
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className={`text-sm font-semibold tracking-wide ${
                  isWhiteMode ? 'text-slate-900' : 'text-slate-50'
                }`}>
                  Nestland Command Center
                </h1>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                  Internal
                </span>
              </div>
              <p className={`mt-0.5 hidden text-[11px] sm:block ${
                isWhiteMode ? 'text-slate-600' : 'text-slate-400'
              }`}>
                Live process maps, anonymous collaboration, single source of truth.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <span className={`hidden text-[10px] lg:inline ${
                    isWhiteMode ? 'text-slate-600' : 'text-slate-400'
                  }`}>
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
                    className={`rounded-full border px-2.5 py-0.5 text-[10px] hover:border-nest-gold/40 hover:text-nest-gold ${
                      isWhiteMode
                        ? 'border-slate-300 bg-white text-slate-700 shadow-sm'
                        : 'border-white/10 bg-black/40 text-slate-300'
                    }`}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <form className="flex items-center gap-1" onSubmit={handlePasswordLogin}>
                  <input
                    className={`w-32 rounded-full border px-2 py-0.5 text-[10px] placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 sm:w-40 ${
                      isWhiteMode
                        ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                        : 'border-white/10 bg-black/40 text-slate-100'
                    }`}
                    placeholder="Admin email"
                    value={loginEmail}
                    onChange={(event) => setLoginEmail(event.target.value)}
                    type="email"
                  />
                  <input
                    className={`w-24 rounded-full border px-2 py-0.5 text-[10px] placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 sm:w-28 ${
                      isWhiteMode
                        ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                        : 'border-white/10 bg-black/40 text-slate-100'
                    }`}
                    placeholder="Password"
                    type="password"
                    autoComplete="current-password"
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
          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <div className="hidden items-center gap-2 md:flex">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wide ${
                  isWhiteMode
                    ? 'border-slate-300 bg-white text-black shadow-sm'
                    : 'border-white/20 bg-black/60 text-slate-100'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Beta
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Primary tab: Projects */}
              <button
                type="button"
                onClick={() => setActivePage('projects')}
                className={`rounded-full border px-2.5 py-0.5 text-[10px] ${
                  activePage === 'projects'
                    ? isWhiteMode
                      ? 'border-black bg-black text-white'
                      : 'border-nest-gold/40 bg-nest-gold/10 text-nest-gold'
                    : isWhiteMode
                      ? 'border-slate-300 bg-white text-slate-700 shadow-sm hover:border-nest-gold/40 hover:text-nest-gold'
                      : 'border-white/10 bg-black/40 text-slate-300 hover:border-nest-gold/40 hover:text-nest-gold'
                }`}
              >
                Projects
              </button>

              {/* Separator */}
              <span className="h-4 w-px bg-white/15" />

              {/* Secondary tabs */}
              <button
                type="button"
                onClick={() => setActivePage('workflow')}
                className={`rounded-full border px-2.5 py-0.5 text-[10px] ${
                  activePage === 'workflow'
                    ? isWhiteMode
                      ? 'border-black bg-black text-white'
                      : 'border-nest-gold/40 bg-nest-gold/10 text-nest-gold'
                    : isWhiteMode
                      ? 'border-slate-300 bg-white text-slate-700 shadow-sm hover:border-nest-gold/40 hover:text-nest-gold'
                      : 'border-white/10 bg-black/40 text-slate-300 hover:border-nest-gold/40 hover:text-nest-gold'
                }`}
              >
                Workflows
              </button>
              <button
                type="button"
                onClick={() => setActivePage('wiki')}
                className={`rounded-full border px-2.5 py-0.5 text-[10px] ${
                  activePage === 'wiki'
                    ? isWhiteMode
                      ? 'border-black bg-black text-white'
                      : 'border-nest-gold/40 bg-nest-gold/10 text-nest-gold'
                    : isWhiteMode
                      ? 'border-slate-300 bg-white text-slate-700 shadow-sm hover:border-nest-gold/40 hover:text-nest-gold'
                      : 'border-white/10 bg-black/40 text-slate-300 hover:border-nest-gold/40 hover:text-nest-gold'
                }`}
              >
                Wiki
              </button>
              {wikiUrl && (
                <a
                  href={wikiUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] hover:border-nest-gold/40 hover:text-nest-gold ${
                    isWhiteMode
                      ? 'border-slate-300 bg-white text-slate-700 shadow-sm'
                      : 'border-white/10 bg-black/40 text-slate-300'
                  }`}
                >
                  Drive
                </a>
              )}
              {user && (
                <button
                  type="button"
                  onClick={() => setActivePage('settings')}
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] ${
                    activePage === 'settings'
                      ? isWhiteMode
                        ? 'border-black bg-black text-white'
                        : 'border-nest-gold/40 bg-nest-gold/10 text-nest-gold'
                      : isWhiteMode
                        ? 'border-slate-300 bg-white text-slate-700 shadow-sm hover:border-nest-gold/40 hover:text-nest-gold'
                        : 'border-white/10 bg-black/40 text-slate-300 hover:border-nest-gold/40 hover:text-nest-gold'
                  }`}
                >
                  Settings
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(true)}
                  className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] hover:border-nest-gold/40 hover:text-nest-gold ${
                    isWhiteMode
                      ? 'border-slate-300 bg-white text-slate-700 shadow-sm'
                      : 'border-white/10 bg-black/40 text-slate-300'
                  }`}
                  aria-label="Admin settings"
                >
                  ⚙
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsWhiteMode((value) => !value)}
                className={`hidden md:inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] hover:border-nest-gold/40 hover:text-nest-gold ${
                  isWhiteMode
                    ? 'border-slate-300 bg-white text-slate-700 shadow-sm'
                    : 'border-white/10 bg-black/40 text-slate-300'
                }`}
                aria-label={isWhiteMode ? 'Switch to dark mode' : 'Switch to white mode'}
                title={isWhiteMode ? 'Switch to dark mode' : 'Switch to white mode'}
              >
                <span aria-hidden="true">{isWhiteMode ? '☾' : '☀'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {appMessage && (
        <div className="fixed top-4 right-4 z-40 flex max-w-xs flex-col gap-2 text-[11px]">
          <div
            className={`rounded-lg border px-3 py-2 shadow-soft-elevated ${
              appMessageType === 'success'
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-100'
                : 'border-red-500/50 bg-red-500/15 text-red-100'
            }`}
          >
            {appMessage}
          </div>
        </div>
      )}

      {activePage === 'workflow' ? (
        <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4 lg:flex-row">
          {/* Process list */}
          <aside
            className={`hidden shrink-0 flex-col rounded-2xl border md:flex ${
              isWhiteMode
                ? 'border-slate-200 bg-white'
                : 'border-white/5 bg-nest-surface/80'
            } ${
              isSidebarCollapsed ? 'w-10 p-2 items-center' : 'w-72 p-3'
            }`}
          >
          <div className="mb-3 flex w-full items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((value) => !value)}
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] hover:border-nest-gold/40 hover:text-nest-gold ${
                  isWhiteMode
                    ? 'border-slate-300 bg-slate-50 text-slate-700'
                    : 'border-white/10 bg-black/40 text-slate-300'
                }`}
                aria-label={isSidebarCollapsed ? 'Expand processes sidebar' : 'Collapse processes sidebar'}
              >
                {isSidebarCollapsed ? '›' : '‹'}
              </button>
              {!isSidebarCollapsed && (
                <span className={`text-[11px] font-medium uppercase tracking-[0.18em] ${
                  isWhiteMode ? 'text-slate-700' : 'text-slate-400'
                }`}>
                  Processes
                </span>
              )}
            </div>
            {!isSidebarCollapsed && (
              <>
                {isLoadingProcesses ? (
                  <span className={`text-[10px] ${
                    isWhiteMode ? 'text-slate-600' : 'text-slate-500'
                  }`}>Loading...</span>
                ) : (
                  <span className={`text-[10px] ${
                    isWhiteMode ? 'text-slate-600' : 'text-slate-500'
                  }`}>{processes.length} total</span>
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
                  <p className={`text-[11px] ${
                    isWhiteMode ? 'text-slate-600' : 'text-slate-500'
                  }`}>
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
                              ? isWhiteMode
                                ? 'border-amber-500 bg-gradient-to-r from-amber-200 via-amber-100 to-amber-300 text-slate-900'
                                : 'border-nest-gold/40 bg-gradient-to-r from-nest-green-dark/70 via-black/80 to-nest-brown/40 text-slate-100'
                              : isWhiteMode
                                ? 'border-slate-200 bg-slate-50 text-slate-700 hover:border-nest-gold/30 hover:bg-slate-100'
                                : 'border-white/5 bg-white/5 text-slate-200 hover:border-nest-gold/30 hover:bg-white/10'
                          }`}
                        >
                          <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
                            <span className="truncate font-semibold">{process.name}</span>
                            {process.category && (
                              <span className={`truncate text-[10px] ${
                                isWhiteMode ? 'text-slate-600' : 'text-slate-500'
                              }`}>
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
                <div className={`mt-3 border-t pt-3 text-[11px] ${
                  isWhiteMode ? 'border-slate-200' : 'border-white/5'
                }`}>
                  <p className={`mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    isWhiteMode ? 'text-slate-700' : 'text-slate-400'
                  }`}>
                    Admin · Processes
                  </p>
                  {availableCategories.length > 0 && (
                    <div className={`mb-2 flex items-center gap-2 text-[10px] ${
                      isWhiteMode ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      <span className={`uppercase tracking-[0.18em] ${
                        isWhiteMode ? 'text-slate-600' : 'text-slate-500'
                      }`}>Filter</span>
                      <select
                        className={`flex-1 rounded-full border px-2 py-1 text-[10px] focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
                          isWhiteMode
                            ? 'border-slate-300 bg-white text-slate-900'
                            : 'border-white/10 bg-black/40 text-slate-100'
                        }`}
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
                      className={`w-full rounded-xl border px-3 py-1.5 text-[11px] placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
                        isWhiteMode
                          ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                          : 'border-white/10 bg-black/40 text-slate-100'
                      }`}
                      placeholder="Category (e.g. Renovation)"
                      value={newProcessSlug}
                      onChange={(event) => setNewProcessSlug(event.target.value)}
                    />
                    <input
                      className={`w-full rounded-xl border px-3 py-1.5 text-[11px] placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
                        isWhiteMode
                          ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                          : 'border-white/10 bg-black/40 text-slate-100'
                      }`}
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
                      className="w-full rounded-full bg-nest-gold px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-black hover:bg-nest-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCreatingProcess ? 'Creating...' : 'Create process'}
                    </button>
                    {authMessage && (
                      <p className="mt-1 text-[10px] text-slate-500">{authMessage}</p>
                    )}
                  </form>
                  {selectedProcess && (
                    <div
                      className={`mt-3 border-t pt-3 text-[11px] ${
                        isWhiteMode ? 'border-slate-200' : 'border-white/5'
                      }`}
                    >
                      <p
                        className={`mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${
                          isWhiteMode ? 'text-slate-700' : 'text-slate-400'
                        }`}
                      >
                        Admin · Edit selected process
                      </p>
                      <form className="space-y-2" onSubmit={handleUpdateProcess}>
                        <input
                          className={`w-full rounded-xl border px-3 py-1.5 text-[11px] placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
                            isWhiteMode
                              ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                              : 'border-white/10 bg-black/40 text-slate-100'
                          }`}
                          placeholder="Category (e.g. Renovation)"
                          value={editProcessCategory}
                          onChange={(event) => setEditProcessCategory(event.target.value)}
                        />
                        <input
                          className={`w-full rounded-xl border px-3 py-1.5 text-[11px] placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
                            isWhiteMode
                              ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                              : 'border-white/10 bg-black/40 text-slate-100'
                          }`}
                          placeholder="Process name"
                          value={editProcessName}
                          onChange={(event) => setEditProcessName(event.target.value)}
                        />
                        <textarea
                          className={`h-16 w-full resize-none rounded-xl border px-3 py-1.5 text-[11px] placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
                            isWhiteMode
                              ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                              : 'border-white/10 bg-black/40 text-slate-100'
                          }`}
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
                          className={`w-full rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-60 ${
                            isWhiteMode
                              ? 'border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200'
                              : 'border-nest-gold/40 bg-black/40 text-nest-gold hover:bg-nest-gold/10'
                          }`}
                        >
                          {isUpdatingProcess ? 'Updating...' : 'Update process'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteProcess(selectedProcess.id)}
                          className={`mt-1 w-full rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                            isWhiteMode
                              ? 'border-red-500 bg-red-500 text-white hover:bg-red-600 hover:border-red-600'
                              : 'border-red-500/40 bg-red-500/10 text-red-200 hover:border-red-400 hover:bg-red-500/20'
                          }`}
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
        <section
          className={`flex min-h-[480px] flex-1 flex-col overflow-hidden rounded-2xl border ${
            isWhiteMode ? 'border-slate-200 bg-white' : 'border-white/5 bg-nest-surface/80'
          }`}
        >
          <div
            className={`flex items-center justify-between border-b px-4 py-2.5 text-[11px] ${
              isWhiteMode ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-white/5 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  isWhiteMode
                    ? 'border border-black bg-black text-white'
                    : 'border border-nest-gold/40 bg-nest-gold/10 text-nest-gold'
                }`}
              >
                {selectedProcess?.name ?? 'Workflow'}
              </span>
              <span className="text-slate-500">
                {isLoadingFlow ? 'Loading workflow...' : 'Workflow'}
                {selectedProcessId && steps.length > 0 &&
                  (() => {
                    const processSteps = steps.filter((s) => s.process_id === selectedProcessId)
                    const totalDays = processSteps.reduce((sum, step) => {
                      const value = step.duration_days ?? 0
                      return sum + (Number.isFinite(value) ? value : 0)
                    }, 0)
                    const totalHours = Math.round(totalDays * 24)
                    const days = Math.floor(totalHours / 24)
                    const hours = totalHours % 24
                    const parts: string[] = []
                    if (days > 0) parts.push(`${days}d`)
                    if (hours > 0) parts.push(`${hours}h`)
                    const durationLabel = parts.length > 0 ? parts.join(' ') : '0d'
                    // Find most recent edit time from steps
                    const lastEditTime = processSteps.reduce((latest, step) => {
                      const stepTime = new Date(step.created_at).getTime()
                      return stepTime > latest ? stepTime : latest
                    }, 0)
                    const lastEditLabel = lastEditTime > 0
                      ? new Date(lastEditTime).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : null
                    return (
                      <span className="ml-2 text-[10px] text-slate-500">
                        · {processSteps.length} steps · {durationLabel}
                        {lastEditLabel && ` · Last: ${lastEditLabel}`}
                      </span>
                    )
                  })()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Mobile process selector */}
              <div className="md:hidden">
                <label className="sr-only" htmlFor="mobile-process-select">
                  Select process
                </label>
                <select
                  id="mobile-process-select"
                  className={`rounded-full border px-2.5 py-1 text-[10px] focus:outline-none focus:ring-1 focus:ring-nest-gold/60 ${
                    isWhiteMode
                      ? 'border-slate-300 bg-white text-slate-800 shadow-sm'
                      : 'border-white/10 bg-black/60 text-slate-100'
                  }`}
                  value={selectedProcessId ?? ''}
                  onChange={(event) => {
                    const id = event.target.value
                    if (!id) return
                    const proc = processes.find((p) => p.id === id)
                    if (!proc) return
                    handleSelectProcess(proc.slug, proc.id)
                  }}
                >
                  <option value="" disabled>
                    Choose process
                  </option>
                  {processes.map((proc) => (
                    <option key={proc.id} value={proc.id}>
                      {proc.name || proc.slug}
                    </option>
                  ))}
                </select>
              </div>
              {flowError && <span className="text-[10px] text-red-400">{flowError}</span>}
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'workflow' ? 'responsibilities' : 'workflow')}
                className={`rounded-full border px-2.5 py-0.5 text-[10px] ${
                  viewMode === 'workflow'
                    ? isWhiteMode
                      ? 'border-slate-300 bg-white text-slate-700 hover:border-nest-gold/40 hover:text-nest-gold'
                      : 'border-white/10 bg-black/40 text-slate-300 hover:border-nest-gold/40 hover:text-nest-gold'
                    : 'border-nest-gold/40 bg-nest-gold/10 text-nest-gold'
                }`}
              >
                {viewMode === 'workflow' ? 'Responsibilities' : 'Workflow map'}
              </button>
              {!isCommentsSidebarVisible && (
                <button
                  type="button"
                  onClick={() => setIsCommentsSidebarVisible(true)}
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] hover:border-nest-gold/40 hover:text-nest-gold ${
                    isWhiteMode
                      ? 'border-slate-300 bg-white text-slate-700'
                      : 'border-white/10 bg-black/40 text-slate-300'
                  }`}
                >
                  Show comments
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsFullscreen(true)}
                className={`rounded-full border px-2.5 py-0.5 text-[10px] hover:border-nest-gold/40 hover:text-nest-gold ${
                  isWhiteMode
                    ? 'border-slate-300 bg-white text-slate-700'
                    : 'border-white/10 bg-black/40 text-slate-300'
                }`}
              >
                Fullscreen
              </button>
            </div>
          </div>
          <div
            className={`flex-1 bg-gradient-to-br ${
              isWhiteMode
                ? 'from-slate-100 via-slate-50 to-slate-100'
                : 'from-black via-slate-900 to-black'
            }`}
          >
            {viewMode === 'workflow' ? (
              <ReactFlowProvider>
                <div className="relative h-full w-full">
                  {isLoadingFlow && (
                    <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-4">
                      <div
                        className={`rounded-full px-3 py-1 text-[10px] font-medium shadow ${
                          isWhiteMode
                            ? 'bg-white/95 text-slate-800 border border-slate-300'
                            : 'bg-black/80 text-slate-100 border border-white/10'
                        }`}
                      >
                        Loading workflow…
                      </div>
                    </div>
                  )}
                  {selectedProcessId && nodes.length > 0 ? (
                    <ReactFlow
                      key={`${selectedProcessId ?? 'none'}:${flowVersion}`}
                      nodes={nodes}
                      edges={edges}
                      nodeTypes={nodeTypes}
                      edgeTypes={edgeTypes}
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
                      onEdgeClick={(_, edge) => {
                        if (!isAdmin) return
                        if (window.confirm('Delete this connection between steps?')) {
                          void handleDeleteTransition(edge.id)
                        }
                      }}
                      onPaneClick={() => setSelectedStepId(null)}
                    >
                      <FitViewOnInit
                        nodeCount={nodes.length}
                        selectedProcessId={selectedProcessId}
                        flowVersion={flowVersion}
                      />
                      <Background color={isWhiteMode ? '#e5e7eb' : '#111827'} gap={24} />
                      <Controls position="bottom-right" />
                    </ReactFlow>
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-slate-500">
                      {isLoadingFlow ? 'Loading workflow...' : 'No steps defined yet.'}
                    </div>
                  )}
                </div>
              </ReactFlowProvider>
            ) : (
              <div
                className={`flex h-full flex-col px-4 py-3 text-[11px] ${
                  isWhiteMode ? 'text-slate-800' : 'text-slate-200'
                }`}
              >
                {stepsByRole.length === 0 ? (
                  <p
                    className={`text-[11px] ${
                      isWhiteMode ? 'text-slate-500' : 'text-slate-500'
                    }`}
                  >
                    No steps defined yet.
                  </p>
                ) : (
                  <div
                    className={`flex-1 overflow-y-auto rounded-2xl border p-3 ${
                      isWhiteMode
                        ? 'border-slate-200 bg-slate-50'
                        : 'border-white/10 bg-black/40'
                    }`}
                  >
                    <table className="min-w-full border-separate border-spacing-y-1 text-[10px]">
                      <thead>
                        <tr className="text-left text-slate-500">
                          <th className="px-3 py-1 font-medium">Responsibility</th>
                          <th className="px-3 py-1 font-medium">Steps</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stepsByRole.map(([role, group]) => (
                          <tr
                            key={role}
                            className={`align-top ${
                              isWhiteMode ? 'text-slate-900' : 'text-slate-300'
                            }`}
                          >
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
                                      <span
                                        className={`truncate text-[10px] ${
                                          isWhiteMode ? 'text-slate-900' : 'text-slate-200'
                                        }`}
                                      >
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
            <div
              className={`border-t px-4 py-3 text-[11px] ${
                isWhiteMode ? 'border-slate-200 bg-white text-slate-800' : 'border-white/5 bg-black/40'
              }`}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                      isWhiteMode ? 'text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    Admin · Edit Flow
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAdminPanelMinimized(!isAdminPanelMinimized)}
                    className={`rounded px-2 py-0.5 text-[9px] uppercase tracking-wide transition-colors ${
                      isWhiteMode
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    {isAdminPanelMinimized ? '▼ Expand' : '▲ Minimize'}
                  </button>
                  {!isAdminPanelMinimized && (
                    <div className="flex items-center gap-1">
                      {(['sm', 'md', 'lg', 'full'] as const).map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setAdminPanelHeight(size)}
                          className={`rounded px-1.5 py-0.5 text-[8px] uppercase tracking-wide transition-colors ${
                            adminPanelHeight === size
                              ? isWhiteMode
                                ? 'bg-nest-gold text-black'
                                : 'bg-nest-gold text-black'
                              : isWhiteMode
                                ? 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                : 'bg-white/5 text-slate-500 hover:bg-white/10'
                          }`}
                        >
                          {size === 'sm' ? 'S' : size === 'md' ? 'M' : size === 'lg' ? 'L' : 'Full'}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!selectedProcessId}
                    onClick={() => {
                      const process = processes.find((p) => p.id === selectedProcessId)
                      if (!process) return
                      const processSteps = steps
                        .filter((s) => s.process_id === selectedProcessId)
                        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                      const processTransitions = transitions.filter((t) => t.process_id === selectedProcessId)
                      
                      // Create Odoo-friendly XML format for workflow
                      const odooXml = `<?xml version="1.0" encoding="utf-8"?>
<odoo>
  <data>
    <!-- Process: ${process.name} -->
    <!-- Category: ${process.category || 'Uncategorized'} -->
    <!-- Description: ${process.description || 'No description'} -->
    
    <!-- Activity Types for each step -->
${processSteps.map((step, idx) => `    <record id="activity_${process.slug}_step_${idx + 1}" model="mail.activity.type">
      <field name="name">${step.title}</field>
      <field name="summary">${step.description || ''}</field>
      <field name="delay_count">${Math.ceil(step.duration_days || 1)}</field>
      <field name="delay_unit">days</field>
      <field name="res_model">project.task</field>
      <field name="sequence">${step.order_index}</field>
      <!-- Role: ${step.role || 'Unassigned'} -->
    </record>`).join('\n\n')}

    <!-- Workflow Stages -->
${processSteps.map((step, idx) => `    <record id="stage_${process.slug}_${idx + 1}" model="project.task.type">
      <field name="name">${step.title}</field>
      <field name="sequence">${step.order_index}</field>
      <field name="description">${step.description || ''}</field>
    </record>`).join('\n\n')}
  </data>
</odoo>

<!--
TRANSITIONS (for automation rules):
${processTransitions.map((t) => {
  const fromStep = processSteps.find((s) => s.id === t.from_step_id)
  const toStep = processSteps.find((s) => s.id === t.to_step_id)
  return `From: "${fromStep?.title}" → To: "${toStep?.title}"`
}).join('\n')}
-->

<!--
STEPS SUMMARY (CSV format for easy import):
order_index,title,role,duration_days,description
${processSteps.map((s) => `${s.order_index},"${s.title}","${s.role || ''}",${s.duration_days || ''},"${(s.description || '').replace(/"/g, '""')}"`).join('\n')}
-->
`
                      const blob = new Blob([odooXml], { type: 'application/xml' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `${process.name}-odoo.xml`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className={`rounded px-2 py-0.5 text-[9px] uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                      isWhiteMode
                        ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                        : 'bg-purple-900/30 text-purple-300 hover:bg-purple-900/50'
                    }`}
                  >
                    Export Odoo
                  </button>
                  <p
                    className={`text-[10px] ${
                      isWhiteMode ? 'text-slate-600' : 'text-slate-500'
                    }`}
                  >
                    {processes.find((p) => p.id === selectedProcessId)?.slug ?? 'none'}
                  </p>
                </div>
              </div>
              {!isAdminPanelMinimized && <div className={`space-y-3 overflow-y-auto ${
                adminPanelHeight === 'sm' ? 'max-h-40' :
                adminPanelHeight === 'md' ? 'max-h-72' :
                adminPanelHeight === 'lg' ? 'max-h-[28rem]' :
                'max-h-none'
              }`}>
                <form className="space-y-2" onSubmit={handleCreateStep}>
                  <p
                    className={`text-[10px] font-semibold ${
                      isWhiteMode ? 'text-slate-800' : 'text-slate-300'
                    }`}
                  >
                    Add step
                  </p>
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <input
                        className={`w-full rounded-xl border px-3 py-1.5 text-[11px] placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
                          isWhiteMode
                            ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                            : 'border-white/10 bg-black/40 text-slate-100'
                        }`}
                        placeholder="Title (e.g. Qualify lead)"
                        value={newStepTitle}
                        onChange={(event) => setNewStepTitle(event.target.value)}
                      />
                      <textarea
                        className={`h-20 md:h-full w-full resize-none rounded-xl border px-3 py-1.5 text-[11px] placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
                          isWhiteMode
                            ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                            : 'border-white/10 bg-black/40 text-slate-100'
                        }`}
                        placeholder="Step details / notes"
                        value={newStepDescription}
                        onChange={(event) => setNewStepDescription(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-col gap-1">
                        <p
                          className={`text-[10px] ${
                            isWhiteMode ? 'text-slate-700' : 'text-slate-500'
                          }`}
                        >
                          Roles (multi-select)
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {dynamicRoleOptions.map((role) => {
                            const selectedRoles = newStepRole
                              .split(',')
                              .map((value) => value.trim())
                              .filter((value) => value.length > 0)
                            const isSelected = selectedRoles.includes(role)
                            return (
                              <button
                                key={role}
                                type="button"
                                onClick={() => {
                                  const current = newStepRole
                                    .split(',')
                                    .map((value) => value.trim())
                                    .filter((value) => value.length > 0)
                                  const next = isSelected
                                    ? current.filter((value) => value !== role)
                                    : [...current, role]
                                  setNewStepRole(next.join(', '))
                                }}
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] ${
                                  isSelected
                                    ? 'border-nest-gold/60 bg-nest-gold/20 text-nest-gold'
                                    : isWhiteMode
                                      ? 'border-slate-300 bg-white text-slate-700 shadow-sm hover:border-nest-gold/40 hover:text-nest-gold'
                                      : 'border-white/10 bg-black/40 text-slate-200 hover:border-nest-gold/40 hover:text-nest-gold'
                                }`}
                              >
                                {role}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <input
                            className={`w-24 rounded-xl border px-3 py-1.5 text-[11px] placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
                              isWhiteMode
                                ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                                : 'border-white/10 bg-black/40 text-slate-100'
                            }`}
                            placeholder="Order"
                            value={newStepOrder}
                            onChange={(event) => setNewStepOrder(event.target.value)}
                          />
                          <input
                            className={`w-20 rounded-xl border px-2 py-1.5 text-[11px] placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
                              isWhiteMode
                                ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                                : 'border-white/10 bg-black/40 text-slate-100'
                            }`}
                            placeholder="Days"
                            value={newStepDurationDays}
                            onChange={(event) => setNewStepDurationDays(event.target.value)}
                          />
                          <input
                            className={`w-20 rounded-xl border px-2 py-1.5 text-[11px] placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
                              isWhiteMode
                                ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                                : 'border-white/10 bg-black/40 text-slate-100'
                            }`}
                            placeholder="Hours"
                            value={newStepDurationHours}
                            onChange={(event) => setNewStepDurationHours(event.target.value)}
                          />
                        </div>
                        <p
                          className={`text-[10px] ${
                            isWhiteMode ? 'text-slate-700' : 'text-slate-500'
                          }`}
                        >
                          Duration is stored as days. Enter days and hours (hours 0-23).
                        </p>
                      </div>
                      {stepFormError && (
                        <p className="text-[10px] text-red-400">{stepFormError}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          disabled={isCreatingStep || !!selectedStep}
                          className="flex-1 rounded-full bg-nest-gold px-3 py-0 text-[10px] font-semibold uppercase tracking-wide text-black hover:bg-nest-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isCreatingStep ? 'Adding...' : 'Add NEW Step'}
                        </button>
                        <button
                          type="button"
                          disabled={isCreatingStep || !selectedStep}
                          onClick={handleUpdateStep}
                          className={`flex-1 rounded-full border px-3 py-0 text-[10px] font-semibold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-60 ${
                            isWhiteMode
                              ? 'border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200'
                              : 'border-nest-gold/40 bg-black/40 text-nest-gold hover:bg-nest-gold/10'
                          }`}
                        >
                          {isCreatingStep ? 'Updating...' : 'Update'}
                        </button>
                        <button
                          type="button"
                          disabled={isCreatingStep || !selectedStep}
                          onClick={() => {
                            setSelectedStepId(null)
                            setStepFormError(null)
                            setNewStepTitle('')
                            setNewStepRole('')
                            setNewStepOrder('0')
                            setNewStepDescription('')
                            setNewStepDurationDays('')
                            setNewStepDurationHours('')
                          }}
                          className={`flex-none rounded-full border px-3 py-0 text-[10px] disabled:cursor-not-allowed disabled:opacity-60 ${
                            isWhiteMode
                              ? 'border-slate-300 bg-slate-50 text-slate-800 hover:border-nest-gold/40 hover:text-nest-gold'
                              : 'border-white/15 bg-transparent text-slate-300 hover:border-nest-gold/40 hover:text-nest-gold'
                          }`}
                        >
                          Clear selection
                        </button>
                      </div>
                      <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className={`text-[10px] font-semibold ${isWhiteMode ? 'text-slate-600' : 'text-slate-400'}`}>Connections</p>
                        </div>
                        <button
                          type="button"
                          disabled={!selectedProcessId || isAutoConnecting || steps.filter((s) => s.process_id === selectedProcessId).length < 2}
                          onClick={handleAutoConnectSteps}
                          className={`w-full rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-60 ${
                            isWhiteMode
                              ? 'border-emerald-500 bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
                              : 'border-emerald-500/40 bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40'
                          }`}
                        >
                          {isAutoConnecting ? 'Connecting...' : 'Auto-Connect All Steps'}
                        </button>
                      </div>
                      <div className="mt-2 space-y-1 border-t border-red-500/25 pt-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[10px] font-semibold text-red-300">Danger zone</p>
                        </div>
                        {transitionFormError && (
                          <p className="text-[10px] text-red-400">{transitionFormError}</p>
                        )}
                        <button
                          type="button"
                          disabled={!selectedProcessId || isDeletingAllConnections}
                          onClick={async () => {
                            if (!supabase) return
                            if (!selectedProcessId) return

                            const confirmed = window.confirm(
                              'Remove all connections for this process? This cannot be undone.',
                            )
                            if (!confirmed) return

                            setIsDeletingAllConnections(true)
                            setTransitionFormError(null)

                            const { error } = await supabase
                              .from('process_transitions')
                              .delete()
                              .eq('process_id', selectedProcessId)

                            if (error) {
                               
                              console.error('Failed to delete connections for process', error)
                              setTransitionFormError('Failed to delete all connections for this process')
                              setIsDeletingAllConnections(false)
                              return
                            }

                            setTransitions((prev) =>
                              prev.filter((transition) => transition.process_id !== selectedProcessId),
                            )
                            setTransitionFormError(null)
                            setIsDeletingAllConnections(false)
                          }}
                          className={`w-40 ml-auto rounded-full border px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-60 ${
                            isWhiteMode
                              ? 'border-red-500 bg-red-500 text-white hover:bg-red-600 hover:border-red-600'
                              : 'border-red-500/40 bg-red-500/10 text-red-200 hover:border-red-400 hover:bg-red-500/20'
                          }`}
                        >
                          Remove all connections
                        </button>
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
                          className={`w-40 ml-auto rounded-full border px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-60 ${
                            isWhiteMode
                              ? 'border-red-500 bg-red-500 text-white hover:bg-red-600 hover:border-red-600'
                              : 'border-red-500/40 bg-red-500/10 text-red-200 hover:border-red-400 hover:bg-red-500/20'
                          }`}
                        >
                          Delete selected step
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </div>}
            </div>
          )}
        </section>

        {/* Comments & details */}
        {isCommentsSidebarVisible && (
          <aside
            className={`mt-4 w-full shrink-0 flex flex-col rounded-2xl border p-3 lg:mt-0 lg:w-80 ${
              isWhiteMode ? 'border-slate-200 bg-white' : 'border-white/5 bg-nest-surface/80'
            }`}
          >
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p
                className={`text-[11px] font-medium uppercase tracking-[0.18em] ${
                  isWhiteMode ? 'text-slate-700' : 'text-slate-400'
                }`}
              >
                Comments
              </p>
              <p
                className={`text-[10px] ${
                  isWhiteMode ? 'text-slate-600' : 'text-slate-500'
                }`}
              >
                Anonymous · Visible to Nest Land team
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportPdf}
                className={`rounded-full border px-2.5 py-0.5 text-[10px] hover:border-nest-gold/40 hover:text-nest-gold ${
                  isWhiteMode
                    ? 'border-slate-300 bg-white text-slate-700'
                    : 'border-white/10 bg-black/40 text-slate-300'
                }`}
              >
                Export PDF
              </button>
              <button
                type="button"
                onClick={() => setIsCommentsSidebarVisible(false)}
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] hover:border-nest-gold/40 hover:text-nest-gold ${
                  isWhiteMode
                    ? 'border-slate-300 bg-slate-50 text-slate-700'
                    : 'border-white/10 bg-black/40 text-slate-300'
                }`}
                aria-label="Hide comments sidebar"
              >
                ×
              </button>
            </div>
          </div>
          <div
            className={`mb-3 rounded-xl border px-3 py-2 text-[11px] ${
              isWhiteMode
                ? 'border-slate-200 bg-slate-50 text-slate-800'
                : 'border-white/10 bg-black/30'
            }`}
          >
            <p
              className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                isWhiteMode ? 'text-slate-700' : 'text-slate-400'
              }`}
            >
              Step details
            </p>
            {selectedStep ? (
              <div className="mt-1 space-y-1">
                <p
                  className={`text-[11px] font-semibold ${
                    isWhiteMode ? 'text-slate-900' : 'text-slate-100'
                  }`}
                >
                  {selectedStep.title}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                  <span>Responsibility:</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${getRoleBadgeClasses(selectedStep.role)}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current/70" />
                    {selectedStep.role ? selectedStep.role.trim() : 'Unassigned'}
                  </span>
                </div>
                <p
                  className={`text-[10px] ${
                    isWhiteMode ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  Order index:{' '}
                  <span className={isWhiteMode ? 'text-slate-900' : 'text-slate-200'}>
                    {selectedStep.order_index}
                  </span>
                </p>
                {selectedStep.description && (
                  <p
                    className={`mt-1 text-[11px] whitespace-pre-wrap ${
                      isWhiteMode ? 'text-slate-800' : 'text-slate-300'
                    }`}
                  >
                    {selectedStep.description}
                  </p>
                )}
              </div>
            ) : (
              <p
                className={`mt-1 text-[10px] ${
                  isWhiteMode ? 'text-slate-600' : 'text-slate-500'
                }`}
              >
                Click a step in the flow to see responsibilities and notes here.
              </p>
            )}
          </div>
          <div className="flex-1 max-h-80 space-y-2 overflow-y-auto pr-1 text-[11px]">
            {isLoadingComments ? (
              <p className="text-[11px] text-slate-500">Loading comments...</p>
            ) : visibleComments.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                {selectedStep
                  ? 'No comments yet for this step.'
                  : 'Select a step in the flow to see its comments here.'}
              </p>
            ) : (
              visibleComments.map((comment) => (
                <div
                  key={comment.id}
                  className={`rounded-xl border px-3 py-2 ${
                    isWhiteMode
                      ? 'border-slate-200 bg-slate-50'
                      : 'border-white/10 bg-black/30'
                  }`}
                >
                  <p
                    className={`whitespace-pre-wrap ${
                      isWhiteMode ? 'text-slate-800' : 'text-slate-200'
                    }`}
                  >
                    {comment.body}
                  </p>
                  <div
                    className={`mt-1 flex items-center justify-between gap-2 text-[10px] ${
                      isWhiteMode ? 'text-slate-500' : 'text-slate-500'
                    }`}
                  >
                    <span>
                      {(comment.context?.author_first_name?.trim() || 'Unknown')} ·{' '}
                      {comment.status === 'open' ? 'open' : 'resolved'} ·{' '}
                      {new Date(comment.created_at).toLocaleString()}
                    </span>
                    {isAdmin && (
                      <div className="flex gap-1">
                        {comment.status === 'open' && (
                          <button
                            type="button"
                            onClick={() => handleResolveComment(comment.id)}
                            disabled={resolvingCommentId === comment.id}
                            className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {resolvingCommentId === comment.id ? 'Resolving…' : 'Mark resolved'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(comment.id)}
                          className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-200 hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Delete
                        </button>
                      </div>
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
              className={`h-20 w-full resize-none rounded-xl border px-3 py-2 text-[11px] placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
                isWhiteMode
                  ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                  : 'border-white/10 bg-black/40 text-slate-100'
              }`}
              value={newComment}
              onChange={(event) => setNewComment(event.target.value)}
              disabled={isSubmittingComment || !supabase || !user}
              placeholder={
                user
                  ? 'Leave a comment or improvement suggestion for this process...'
                  : 'Sign in to leave a comment on this process.'
              }
            />
            <div className="flex items-center justify-between gap-2">
              <button
                type="submit"
                disabled={isSubmittingComment || !supabase || !user}
                className="rounded-full bg-nest-gold px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-black hover:bg-nest-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingComment ? 'Posting...' : 'Post comment'}
              </button>
            </div>
          </form>
        </aside>
        )}
      </main>
      ) : activePage === 'projects' ? (
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 pb-4 pt-3 sm:px-6 sm:pb-6 sm:pt-4">
          <section
            className={`flex-1 rounded-2xl border p-3 text-[11px] sm:p-4 ${
              isWhiteMode
                ? 'border-slate-200 bg-white text-slate-900'
                : 'border-white/5 bg-nest-surface/80 text-slate-100'
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p
                  className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    isWhiteMode ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  Projects
                </p>
                <p
                  className={`text-[11px] ${
                    isWhiteMode ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  Create projects from process templates and track where each one is in the workflow.
                </p>
              </div>
              <span className="text-[10px] text-slate-500">
                {projects.length} project{projects.length === 1 ? '' : 's'} · {processes.length} template
                {processes.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="flex flex-col gap-4 md:flex-row md:items-start">
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={`text-[10px] font-semibold ${
                      isWhiteMode ? 'text-slate-900' : 'text-slate-300'
                    }`}
                  >
                    Current projects
                  </p>
                  <div className="flex items-center gap-2">
                    {isLoadingProjects && (
                      <span className="text-[10px] text-slate-500">Loading...</span>
                    )}
                    {user && (
                      <button
                        type="button"
                        onClick={() => setIsNewProjectModalOpen(true)}
                        className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                          isWhiteMode
                            ? 'border border-black bg-black text-white hover:bg-slate-900'
                            : 'border border-white/30 bg-black text-white hover:border-nest-gold/40'
                        }`}
                      >
                        New Project
                      </button>
                    )}
                  </div>
                </div>
                {(() => {
                  const now = new Date()
                  const msPerDay = 86400000
                  // Add N business days (excludes Sat/Sun). Supports fractional days.
                  const addBusinessDays = (start: Date, days: number): Date => {
                    let date = new Date(start)
                    const whole = Math.floor(days)
                    const frac = days - whole
                    let added = 0
                    while (added < whole) {
                      date.setDate(date.getDate() + 1)
                      const day = date.getDay()
                      if (day !== 0 && day !== 6) {
                        added++
                      }
                    }
                    if (frac > 0) {
                      date = new Date(date.getTime() + frac * msPerDay)
                      const day = date.getDay()
                      if (day === 0) date.setDate(date.getDate() + 1)
                      if (day === 6) date.setDate(date.getDate() + 2)
                    }
                    return date
                  }
                  const projFinishes = projects.map((p) => {
                    const steps = projectSteps
                      .filter((s) => s.process_id === p.process_id)
                      .slice()
                      .sort((a, b) => a.order_index - b.order_index)
                    const idx = p.current_step_id ? steps.findIndex((s) => s.id === p.current_step_id) : -1
                    const startIdx = idx >= 0 ? idx : 0
                    const remaining = steps.slice(startIdx).reduce((sum, step) => {
                      const val = step.duration_days ?? 0
                      return sum + (Number.isFinite(val) ? (val as number) : 0)
                    }, 0)
                    const finish = addBusinessDays(now, remaining)
                    return { id: p.id, name: p.name, process_id: p.process_id, remaining, finish }
                  })
                  const latestFinish = projFinishes.length
                    ? new Date(Math.max(...projFinishes.map((x) => x.finish.getTime())))
                    : now
                  const endOfYear = new Date(latestFinish.getFullYear(), 11, 31, 23, 59, 59, 999)
                  const totalMs = Math.max(1, endOfYear.getTime() - now.getTime())
                  const monthTicks: Date[] = []
                  let m = new Date(now.getFullYear(), now.getMonth(), 1)
                  if (m < now) m = new Date(now.getFullYear(), now.getMonth() + 1, 1)
                  while (m <= endOfYear) {
                    monthTicks.push(new Date(m))
                    m = new Date(m.getFullYear(), m.getMonth() + 1, 1)
                  }
                  const yearTicks: Date[] = []
                  let y = new Date(now.getFullYear(), 0, 1)
                  if (y < now) y = new Date(now.getFullYear() + 1, 0, 1)
                  while (y <= endOfYear) {
                    yearTicks.push(new Date(y))
                    y = new Date(y.getFullYear() + 1, 0, 1)
                  }
                  const quarterTicks: Date[] = []
                  let q = new Date(now.getFullYear(), now.getMonth(), 1)
                  while ((q < now) || (q.getMonth() % 3 !== 0)) {
                    q = new Date(q.getFullYear(), q.getMonth() + 1, 1)
                  }
                  while (q <= endOfYear) {
                    quarterTicks.push(new Date(q))
                    q = new Date(q.getFullYear(), q.getMonth() + 3, 1)
                  }
                  // Assign colors per process (static palette for Tailwind)
                  const processPalette = [
                    'bg-amber-400',
                    'bg-sky-400',
                    'bg-emerald-400',
                    'bg-fuchsia-400',
                    'bg-orange-400',
                    'bg-blue-400',
                    'bg-teal-400',
                    'bg-pink-400',
                    'bg-purple-400',
                    'bg-lime-400',
                  ]
                  const processIds = Array.from(new Set(projFinishes.map((pf) => pf.process_id)))
                  const processColorMap = new Map<string, string>()
                  processIds.forEach((pid, i) => {
                    processColorMap.set(pid, processPalette[i % processPalette.length])
                  })

                  const projectMarks = projFinishes
                    .map((pf) => {
                      const pct = ((pf.finish.getTime() - now.getTime()) / totalMs) * 100
                      const clamped = Math.min(100, Math.max(0, pct))
                      const color = processColorMap.get(pf.process_id) || (isWhiteMode ? 'bg-black' : 'bg-nest-gold')
                      return { ...pf, pct: clamped, color }
                    })
                    .sort((a, b) => a.pct - b.pct)
                  const endYearStr = endOfYear.toLocaleDateString()
                  const latestStr = latestFinish.toLocaleDateString()
                  const daysToLatest = projFinishes.length
                    ? projFinishes.reduce((max, pf) => Math.max(max, pf.remaining), 0)
                    : 0
                  const daysToLatestStr =
                    daysToLatest % 1 === 0 ? String(daysToLatest) : daysToLatest.toFixed(1)

                  return (
                    <div
                      className={`mb-2 rounded-xl border p-2 pb-6 ${
                        isWhiteMode
                          ? 'border-slate-200 bg-slate-50'
                          : 'border-white/10 bg-black/30'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={isWhiteMode ? 'text-slate-700' : 'text-slate-400'}>Today</span>
                        <span className={isWhiteMode ? 'text-slate-700' : 'text-slate-400'}>
                          End of year: {endYearStr}
                        </span>
                      </div>
                      <p className={isWhiteMode ? 'text-[10px] text-slate-600' : 'text-[10px] text-slate-400'}>
                        Latest completion: {latestStr} · {daysToLatestStr} business days
                      </p>
                      <div
                        className={`relative mt-2 h-2 w-full overflow-visible rounded-full ${
                          isWhiteMode ? 'bg-slate-200' : 'bg-white/10'
                        }`}
                      >
                        {monthTicks.map((d, i) => {
                          const pct = ((d.getTime() - now.getTime()) / totalMs) * 100
                          const left = Math.min(100, Math.max(0, pct))
                          return (
                            <span
                              key={`m-${i}`}
                              className={`${
                                isWhiteMode ? 'bg-slate-400/40' : 'bg-white/20'
                              } absolute top-0 bottom-0 w-px`}
                              style={{ left: `${left}%` }}
                            />
                          )
                        })}
                        {yearTicks.map((d, i) => {
                          const pct = ((d.getTime() - now.getTime()) / totalMs) * 100
                          const left = Math.min(100, Math.max(0, pct))
                          return (
                            <span
                              key={`y-${i}`}
                              className={`${
                                isWhiteMode ? 'bg-slate-500/70' : 'bg-white/40'
                              } absolute -top-0.5 bottom-[-2px] w-[2px]`}
                              style={{ left: `${left}%` }}
                            />
                          )
                        })}
                        {projectMarks.map((pf) => (
                          <button
                            key={pf.id}
                            type="button"
                            title={`${pf.name} · ${pf.finish.toLocaleDateString()}`}
                            onClick={() => {
                              if (!user) return
                              const pr = projects.find((p) => p.id === pf.id)
                              if (pr) handleOpenProjectModal(pr)
                            }}
                            className={`${pf.color} ${isWhiteMode ? 'ring-black/20' : 'ring-white/20'} absolute -top-1 h-3 w-3 -translate-x-1/2 transform rounded-full ring-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-nest-gold`}
                            style={{ left: `${pf.pct}%` }}
                            aria-label={`${pf.name} finishes ${pf.finish.toLocaleDateString()}`}
                          />
                        ))}
                        {quarterTicks.map((d, i) => {
                          const pct = ((d.getTime() - now.getTime()) / totalMs) * 100
                          const left = Math.min(100, Math.max(0, pct))
                          const label = d.toLocaleString(undefined, { month: 'short' })
                          return (
                            <span
                              key={`ql-${i}`}
                              className={`${isWhiteMode ? 'text-slate-600' : 'text-slate-400'} absolute -bottom-4 -translate-x-1/2 whitespace-nowrap text-[9px]`}
                              style={{ left: `${left}%` }}
                            >
                              {label}
                            </span>
                          )
                        })}
                        {yearTicks.map((d, i) => {
                          const pct = ((d.getTime() - now.getTime()) / totalMs) * 100
                          const left = Math.min(100, Math.max(0, pct))
                          const label = String(d.getFullYear())
                          return (
                            <span
                              key={`yl-${i}`}
                              className={`${isWhiteMode ? 'text-slate-700' : 'text-slate-300'} absolute -bottom-6 -translate-x-1/2 whitespace-nowrap text-[9px] font-semibold`}
                              style={{ left: `${left}%` }}
                            >
                              {label}
                            </span>
                          )
                        })}
                      </div>
                      <div className="mt-2 flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => setIsLegendExpanded((v) => !v)}
                          className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                            isWhiteMode
                              ? 'border border-black bg-black text-white hover:bg-slate-900'
                              : 'border border-white/30 bg-black text-white hover:border-nest-gold/40'
                          }`}
                        >
                          {isLegendExpanded ? 'Hide legend' : 'Legend'}
                        </button>
                      </div>
                      {/* Process legend */}
                      {isLegendExpanded && processIds.length > 0 && (
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                          {processIds.map((pid) => {
                            const color = processColorMap.get(pid) || (isWhiteMode ? 'bg-black' : 'bg-nest-gold')
                            const name = (processes.find((p) => p.id === pid)?.name) || 'Unknown'
                            const count = projFinishes.filter((pf) => pf.process_id === pid).length
                            return (
                              <span key={pid} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                                <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
                                <span className={isWhiteMode ? 'text-slate-700' : 'text-slate-300'}>
                                  {name} ({count})
                                </span>
                              </span>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })()}
                {projectsError && (
                  <p className="text-[10px] text-red-400">{projectsError}</p>
                )}
                {projects.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    {user
                      ? 'No projects yet. Use the New Project button above to create your first one.'
                      : 'No projects yet. Sign in and use the New Project button above to create your first one.'}
                  </p>
                ) : (
                  <div className="max-h-[420px] space-y-2 overflow-y-auto">
                    {projects.map((project) => {
                      const process = processes.find((p) => p.id === project.process_id)
                      const stepsForProcess = projectSteps.filter(
                        (step) => step.process_id === project.process_id,
                      )
                      const currentStep = project.current_step_id
                        ? stepsForProcess.find((step) => step.id === project.current_step_id)
                        : null

                      const stepComments: ProjectStepComment[] = currentStep
                        ? projectComments
                            .filter(
                              (comment) =>
                                comment.project_id === project.id &&
                                comment.step_id === currentStep.id,
                            )
                            .slice()
                            .sort(
                              (a, b) =>
                                new Date(b.created_at).getTime() -
                                new Date(a.created_at).getTime(),
                            )
                        : []

                      const lastStepActivity = stepComments[0] ?? null

                      const sortedStepsForProcess = stepsForProcess
                        .slice()
                        .sort((a, b) => a.order_index - b.order_index)

                      const previousStepActivities = sortedStepsForProcess
                        .filter((step) => {
                          if (!currentStep) return false
                          return step.order_index < currentStep.order_index
                        })
                        .map((step) => {
                          const commentsForStep = projectComments
                            .filter(
                              (comment) =>
                                comment.project_id === project.id &&
                                comment.step_id === step.id,
                            )
                            .slice()
                            .sort(
                              (a, b) =>
                                new Date(b.created_at).getTime() -
                                new Date(a.created_at).getTime(),
                            )
                          const activity = commentsForStep[0]
                          if (!activity) return null
                          return { step, activity }
                        })
                        .filter(
                          (
                            item,
                          ): item is { step: ProjectStepSummary; activity: ProjectStepComment } =>
                            item !== null,
                        )
                        .slice()
                        .sort(
                          (a, b) =>
                            new Date(b.activity.created_at).getTime() -
                            new Date(a.activity.created_at).getTime(),
                        )
                      const currentIndex = currentStep
                        ? sortedStepsForProcess.findIndex((step) => step.id === currentStep.id)
                        : -1
                      const remainingSteps =
                        currentIndex >= 0
                          ? sortedStepsForProcess.slice(currentIndex)
                          : sortedStepsForProcess
                      const remainingDuration = remainingSteps.reduce((sum, step) => {
                        const value = step.duration_days ?? 0
                        return sum + (Number.isFinite(value) ? value : 0)
                      }, 0)
                      const remainingDurationDisplay =
                        remainingDuration % 1 === 0
                          ? String(remainingDuration)
                          : remainingDuration.toFixed(1)
                      const estimatedFinishDate: string | null = null

                      const commentKey = currentStep
                        ? `${project.id}:${currentStep.id}`
                        : null
                      const commentDraft = commentKey
                        ? newProjectComments[commentKey] ?? ''
                        : ''

                      return (
                        <div
                          key={project.id}
                          className={`rounded-xl border px-3 py-2 text-[11px] ${
                            isWhiteMode
                              ? 'border-slate-200 bg-slate-50 text-slate-800'
                              : 'border-white/10 bg-black/30 text-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              {isAdmin && editingProjectId === project.id ? (
                                <form
                                  className="space-y-1"
                                  onSubmit={(event) => void handleSaveProjectName(event, project.id)}
                                >
                                  <input
                                    className={`w-full rounded-xl border px-2 py-1 text-[10px] placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
                                      isWhiteMode
                                        ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                                        : 'border-white/10 bg-black/40 text-slate-100'
                                    }`}
                                    value={editingProjectName}
                                    onChange={(event) => setEditingProjectName(event.target.value)}
                                  />
                                  <div className="flex gap-1 text-[9px]">
                                    <button
                                      type="submit"
                                      disabled={isUpdatingProjectNameId === project.id}
                                      className="rounded-full bg-nest-gold px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-black hover:bg-nest-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {isUpdatingProjectNameId === project.id ? 'Saving…' : 'Save name'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCancelEditProjectName}
                                      className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[9px] text-slate-300 hover:border-nest-gold/40 hover:text-nest-gold"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </form>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2">
                                    <p
                                      className={`truncate text-[11px] font-semibold ${
                                        isWhiteMode ? 'text-slate-900' : 'text-slate-100'
                                      }`}
                                    >
                                      {project.name}
                                    </p>
                                    {isAdmin && (
                                      <div className="flex items-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleStartEditProjectName(project)}
                                          className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
                                            isWhiteMode
                                              ? 'border border-black bg-black text-white hover:bg-slate-900'
                                              : 'border border-white/30 bg-black text-white hover:border-nest-gold/40'
                                          }`}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => void handleDeleteProject(project.id)}
                                          disabled={isDeletingProjectId === project.id}
                                          className="rounded-full border border-red-500/60 bg-red-500/10 px-2 py-0.5 text-[9px] font-semibold text-red-200 hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          {isDeletingProjectId === project.id ? 'Deleting…' : 'Delete'}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  <p className="mt-0.5 text-[10px] text-slate-500">
                                    Template:{' '}
                                    {process ? process.name : 'Unknown process'}
                                  </p>
                                </>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 text-[10px] text-slate-400">
                              <button
                                type="button"
                                onClick={() => handleOpenProjectModal(project)}
                                disabled={!user}
                                className={`rounded-full px-2 py-0.5 text-[9px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                                  isWhiteMode
                                    ? 'border border-black bg-black text-white hover:bg-slate-900'
                                    : 'border border-white/30 bg-black text-white hover:border-nest-gold/40'
                                }`}
                              >
                                Open
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)]">
                            <div className="space-y-1">
                              <p className="text-xs text-slate-400">Progress</p>
                              <p
                                className={`text-xs ${
                                  currentStep
                                    ? isWhiteMode
                                      ? 'font-semibold text-slate-900'
                                      : 'font-semibold text-slate-100'
                                    : 'text-slate-500'
                                }`}
                              >
                                {currentStep
                                  ? `${currentStep.order_index}. ${currentStep.title}`
                                  : 'Not started yet.'}
                              </p>
                              {currentStep?.description && (
                                <p className="text-xs text-slate-400">
                                  {currentStep.description}
                                </p>
                              )}
                              {currentStep && (
                                <p className="text-[10px] text-slate-500">
                                  {lastStepActivity
                                    ? `Last update ${
                                        lastStepActivity.created_by &&
                                        lastStepActivity.created_by === user?.id
                                          ? 'by you'
                                          : 'by team member'
                                      } at ${new Date(
                                        lastStepActivity.created_at,
                                      ).toLocaleString()}`
                                    : 'No updates yet for this step.'}
                                </p>
                              )}
                              {remainingDuration > 0 && (
                                <>
                                  <p className="text-xs text-slate-400">
                                    Estimated remaining duration: {remainingDurationDisplay} days
                                  </p>
                                  {estimatedFinishDate && (
                                    <p className="text-xs text-slate-400">
                                      Estimated finish date: {estimatedFinishDate}
                                    </p>
                                  )}
                                </>
                              )}
                              {/* inline step controls moved to modal */}
                            </div>
                            <div
                              className={`hidden space-y-1 rounded-lg border p-2 ${
                                isWhiteMode
                                  ? 'border-slate-200 bg-slate-50'
                                  : 'border-white/10 bg-black/30'
                              }`}
                            >
                              <p
                                className={`text-xs font-semibold ${
                                  isWhiteMode ? 'text-slate-800' : 'text-slate-300'
                                }`}
                              >
                                Step comments
                              </p>
                              {!currentStep ? (
                                <p className="text-xs text-slate-500">
                                  Start the project to comment on steps.
                                </p>
                              ) : stepComments.length === 0 ? (
                                <p className="text-xs text-slate-500">
                                  No comments yet for this step.
                                </p>
                              ) : (
                                <div className="space-y-1 max-h-24 overflow-y-auto">
                                  {stepComments.map((comment) => (
                                    <div
                                      key={comment.id}
                                      className={`rounded border px-2 py-1 ${
                                        isWhiteMode
                                          ? 'border-slate-200 bg-white'
                                          : 'border-white/10 bg-black/40'
                                      }`}
                                    >
                                      <p
                                        className={`text-xs whitespace-pre-wrap ${
                                          isWhiteMode ? 'text-slate-800' : 'text-slate-200'
                                        }`}
                                      >
                                        {comment.body}
                                      </p>
                                      <div className="mt-0.5 flex items-center justify-between gap-2">
                                        <p className="text-[10px] text-slate-500">
                                          {(() => {
                                            const authorId = comment.created_by
                                            if (!authorId) return 'Unknown'
                                            if (authorId === user?.id) {
                                              return profileFirstName.trim() || 'You'
                                            }
                                            const name = authorFirstNames[authorId]
                                            return name || 'Team member'
                                          })()}{' '}
                                          · {new Date(comment.created_at).toLocaleString()}
                                        </p>
                                        {isAdmin && (
                                          <button
                                            type="button"
                                            onClick={() => void handleDeleteProjectStepComment(comment.id)}
                                            disabled={deletingProjectCommentId === comment.id}
                                            className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[9px] text-red-200 hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                          >
                                            {deletingProjectCommentId === comment.id ? 'Deleting…' : 'Delete'}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {projectCommentsError && (
                                <p className="text-xs text-red-400">{projectCommentsError}</p>
                              )}
                              {currentStep && (
                                <form
                                  className="space-y-1"
                                  onSubmit={(event) =>
                                    void handleSubmitProjectStepComment(
                                      event,
                                      project.id,
                                      currentStep.id,
                                    )
                                  }
                                >
                                  <textarea
                                    className={`h-12 w-full resize-none rounded border px-2 py-1.5 text-xs placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
                                      isWhiteMode
                                        ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                                        : 'border-white/10 bg-black/40 text-slate-100'
                                    }`}
                                    value={commentDraft}
                                    onChange={(event) => {
                                      if (!commentKey) return
                                      const value = event.target.value
                                      setNewProjectComments((prev) => ({
                                        ...prev,
                                        [commentKey]: value,
                                      }))
                                    }}
                                    disabled={!user || (commentKey !== null && isSubmittingProjectCommentKey === commentKey)}
                                    placeholder={
                                      user
                                        ? 'Add a note or clarification for this project step...'
                                        : 'Sign in to comment on this project step.'
                                    }
                                  />
                                  <div className="flex justify-end">
                                    <button
                                      type="submit"
                                      disabled={isSubmittingProjectCommentKey === commentKey}
                                      className="rounded-full bg-nest-gold px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-black hover:bg-nest-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {commentKey && isSubmittingProjectCommentKey === commentKey
                                        ? 'Posting...'
                                        : 'Post'}
                                    </button>
                                  </div>
                                </form>
                              )}
                            </div>
                          </div>
                          {expandedProjectHistoryId === project.id && (
                              <div
                                className={`mt-2 rounded-lg border p-2 text-[10px] ${
                                  isWhiteMode
                                    ? 'border-slate-200 bg-slate-50 text-slate-800'
                                    : 'border-white/10 bg-black/30 text-slate-200'
                                }`}
                              >
                                <p
                                  className={`mb-1 text-[10px] font-semibold ${
                                    isWhiteMode ? 'text-slate-800' : 'text-slate-300'
                                  }`}
                                >
                                  History
                                </p>
                                {previousStepActivities.length === 0 ? (
                                  <p className="text-[9px] text-slate-500">No history yet.</p>
                                ) : (
                                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                                    {previousStepActivities.map(({ step, activity }) => {
                                      const actorLabel =
                                        activity.created_by && activity.created_by === user?.id
                                          ? 'You'
                                          : 'Team member'
                                      const timestamp = new Date(
                                        activity.created_at,
                                      ).toLocaleString()
                                      const hasComment = !!activity.body && activity.body.trim().length > 0
                                      return (
                                        <li key={step.id} className="flex flex-col">
                                          <span
                                            className={`text-[10px] ${
                                              isWhiteMode ? 'text-slate-900' : 'text-slate-200'
                                            }`}
                                          >
                                            {actorLabel} moved to step {step.order_index}. {step.title}
                                          </span>
                                          <span
                                            className={`text-[9px] ${
                                              isWhiteMode ? 'text-slate-700' : 'text-slate-500'
                                            }`}
                                          >
                                            at {timestamp}{' '}
                                            {hasComment
                                              ? `· Comment: "${activity.body}"`
                                              : '· No comment'}
                                          </span>
                                        </li>
                                      )
                                    })}
                                  </ul>
                                )}
                              </div>
                            )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              {/* New Project aside removed in favor of modal */}
            </div>
          </section>
          {isNewProjectModalOpen && user && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIsNewProjectModalOpen(false)}>
              <div
                className={`w-full max-w-sm rounded-2xl border p-4 text-[11px] shadow-soft-elevated ${
                  isWhiteMode ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-black/80 text-slate-100'
                }`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="new-project-title"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h3 id="new-project-title" className="text-[12px] font-semibold">New Project</h3>
                  <button
                    type="button"
                    onClick={() => setIsNewProjectModalOpen(false)}
                    className={`rounded-full px-2 py-0.5 text-[10px] ${
                      isWhiteMode ? 'border border-slate-300' : 'border border-white/20'
                    }`}
                  >
                    Close
                  </button>
                </div>
                <p className={isWhiteMode ? 'text-[10px] text-slate-600' : 'text-[10px] text-slate-400'}>
                  Pick a process template and give the project a clear name (e.g. Renovation – Penthouse A).
                </p>
                <form className="mt-2 space-y-2" onSubmit={handleCreateProject}>
                  <input
                    className={`w-full rounded-xl border px-3 py-1 text-[11px] placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
                      isWhiteMode ? 'border-slate-300 bg-white text-slate-900 shadow-sm' : 'border-white/10 bg-black/40 text-slate-100'
                    }`}
                    placeholder="Project name"
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    disabled={isCreatingProject}
                  />
                  <select
                    className={`w-full rounded-xl border px-2.5 py-1 text-[11px] focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
                      isWhiteMode ? 'border-slate-300 bg-white text-slate-900 shadow-sm' : 'border-white/10 bg-black/40 text-slate-100'
                    }`}
                    value={newProjectProcessId}
                    onChange={(event) => setNewProjectProcessId(event.target.value)}
                    disabled={isCreatingProject}
                  >
                    <option value="">Select process template</option>
                    {processes.map((process) => (
                      <option key={process.id} value={process.id}>
                        {process.name}
                      </option>
                    ))}
                  </select>
                  {projectFormError && (
                    <p className="text-[10px] text-red-400">{projectFormError}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      disabled={isCreatingProject}
                      className="flex-1 rounded-full bg-nest-gold px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-black hover:bg-nest-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isCreatingProject ? 'Creating…' : 'Create project'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsNewProjectModalOpen(false)}
                      className={`rounded-full px-3 py-1 text-[10px] ${
                        isWhiteMode ? 'border border-slate-300' : 'border border-white/20'
                      }`}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {isProjectModalOpen && user && selectedProjectForModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleCloseProjectModal}>
              <div
                className={`w-full max-w-3xl rounded-2xl border p-5 text-[11px] shadow-soft-elevated ${
                  isWhiteMode ? 'border-slate-200 bg-white text-slate-900' : 'border-white/10 bg-black/80 text-slate-100'
                }`}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="project-details-title"
              >
                {(() => {
                  const projectRef = selectedProjectForModal as Project
                  const project = projects.find((p) => p.id === projectRef.id) ?? projectRef
                  const steps = projectSteps
                    .filter((s) => s.process_id === project.process_id)
                    .slice()
                    .sort((a, b) => a.order_index - b.order_index)
                  const currentIndex = project.current_step_id
                    ? steps.findIndex((s) => s.id === project.current_step_id)
                    : -1
                  const currentStep = currentIndex >= 0 ? steps[currentIndex] : null
                  const stepComments = currentStep
                    ? projectComments
                        .filter((c) => c.project_id === project.id && c.step_id === currentStep.id)
                        .slice()
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    : []
                  const commentKey = currentStep ? `${project.id}:${currentStep.id}` : null
                  const commentDraft = commentKey ? (newProjectComments[commentKey] ?? '') : ''

                  return (
                    <>
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <h3 id="project-details-title" className="text-[12px] font-semibold">
                          {project.name}
                        </h3>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIsProjectHistoryOpen((v) => !v)}
                            className={`rounded-full px-2 py-0.5 text-[10px] ${
                              isWhiteMode ? 'border border-slate-300' : 'border border-white/20'
                            }`}
                          >
                            {isProjectHistoryOpen ? 'Hide history' : 'History'}
                          </button>
                          <button
                            type="button"
                            onClick={handleCloseProjectModal}
                            className={`rounded-full px-2 py-0.5 text-[10px] ${
                              isWhiteMode ? 'border border-slate-300' : 'border border-white/20'
                            }`}
                          >
                            Close
                          </button>
                        </div>
                      </div>
                      <div className={`rounded-xl border p-3 ${isWhiteMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/40'}`}>
                        <p className="text-[10px] text-slate-500">Current Status</p>
                        <p className={`text-xs ${currentStep ? (isWhiteMode ? 'font-semibold text-slate-900' : 'font-semibold text-slate-100') : 'text-slate-500'}`}>
                          {currentStep ? `${currentStep.order_index}. ${currentStep.title}` : 'Not started yet.'}
                        </p>
                        {currentStep?.description && (
                          <p className="text-xs text-slate-400">{currentStep.description}</p>
                        )}
                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            disabled={!currentStep || currentIndex <= 0 || isChangingProjectStep}
                            onClick={() => {
                              if (!currentStep || currentIndex <= 0) return
                              const prev = steps[currentIndex - 1]
                              void handleChangeProjectStep(project.id, prev.id)
                            }}
                            className={`rounded-full px-3 py-1 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                              isWhiteMode
                                ? 'border border-red-500 bg-red-500 text-white hover:bg-red-600'
                                : 'border border-red-500/60 bg-red-500/15 text-red-200 hover:border-red-400 hover:bg-red-500/25'
                            }`}
                          >
                            {isChangingProjectStep ? 'Updating…' : '← Back'}
                          </button>
                          <button
                            type="button"
                            disabled={!steps.length || currentIndex >= steps.length - 1 || isChangingProjectStep}
                            onClick={() => {
                              if (!steps.length || currentIndex >= steps.length - 1) return
                              const next = steps[currentIndex + 1]
                              void handleChangeProjectStep(project.id, next.id)
                            }}
                            className={`rounded-full px-3 py-1 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                              isWhiteMode
                                ? 'border border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600'
                                : 'border border-emerald-500/60 bg-emerald-500/15 text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/25'
                            }`}
                          >
                            {isChangingProjectStep ? 'Updating…' : 'Done →'}
                          </button>
                        </div>
                        {(() => {
                          const remainingSteps = currentIndex >= 0 ? steps.slice(currentIndex) : steps
                          const remainingDays = remainingSteps.reduce((sum, s) => sum + (Number.isFinite(s.duration_days ?? 0) ? (s.duration_days as number) : 0), 0)
                          const eta = addBusinessDays(new Date(), remainingDays)
                          const etaStr = eta.toLocaleDateString()
                          return (
                            <p className={isWhiteMode ? 'mt-2 text-[10px] text-slate-600' : 'mt-2 text-[10px] text-slate-400'}>
                              ETA: {etaStr}
                            </p>
                          )
                        })()}
                      </div>
                      {isProjectHistoryOpen && (
                        <div className={`mb-3 rounded-xl border p-3 ${isWhiteMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/40'}`}>
                          <p className="mb-2 text-[10px] font-semibold text-slate-400">History</p>
                          <div className="grid gap-3 md:grid-cols-2">
                            {/* Step activity (comments) */}
                            <div>
                              <p className={isWhiteMode ? 'text-[10px] text-slate-600' : 'text-[10px] text-slate-400'}>Progress</p>
                              {(() => {
                                const stepMap = new Map(steps.map((s) => [s.id, s]))
                                const items = projectComments
                                  .filter((c) => c.project_id === project.id)
                                  .slice()
                                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                                if (items.length === 0) {
                                  return <p className="text-[10px] text-slate-500">No activity yet.</p>
                                }
                                return (
                                  <ul className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                                    {items.map((c) => {
                                      const s = stepMap.get(c.step_id)
                                      const author = authorFirstNames[c.created_by || ''] || 'Unknown'
                                      return (
                                        <li key={c.id} className="text-[10px]">
                                          <span className={isWhiteMode ? 'text-slate-800' : 'text-slate-200'}>
                                            {s ? `${s.order_index}. ${s.title}` : 'Step'}
                                          </span>
                                          <span className={isWhiteMode ? 'text-slate-500' : 'text-slate-500'}>
                                            {' '}· {author} · {new Date(c.created_at).toLocaleString()}
                                          </span>
                                          {c.body && (
                                            <div className={isWhiteMode ? 'text-slate-700' : 'text-slate-300'}>
                                              “{c.body}”
                                            </div>
                                          )}
                                        </li>
                                      )
                                    })}
                                  </ul>
                                )
                              })()}
                            </div>
                            {/* Financial (invoices) */}
                            <div>
                              <p className={isWhiteMode ? 'text-[10px] text-slate-600' : 'text-[10px] text-slate-400'}>Financial</p>
                              {(() => {
                                const list = invoicesByProject[project.id] ?? []
                                if (list.length === 0) return <p className="text-[10px] text-slate-500">No invoices yet.</p>
                                return (
                                  <ul className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                                    {list.map((inv) => {
                                      const signed = inv.direction === 'paid' ? -inv.amount : inv.amount
                                      const pos = signed >= 0
                                      const fmt = Math.abs(signed).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                      return (
                                        <li key={inv.id} className="text-[10px]">
                                          <span className={pos ? 'text-emerald-500' : 'text-red-500'}>
                                            {pos ? '+' : '−'}€{fmt}
                                          </span>
                                          <span className={isWhiteMode ? 'text-slate-500' : 'text-slate-500'}>
                                            {' '}· {inv.invoice_number || '—'} · {new Date(inv.created_at).toLocaleString()}
                                          </span>
                                          {inv.description && (
                                            <div className={isWhiteMode ? 'text-slate-700' : 'text-slate-300'}>
                                              “{inv.description}”
                                            </div>
                                          )}
                                        </li>
                                      )
                                    })}
                                  </ul>
                                )
                              })()}
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="mt-3">
                        {/* Files */}
                        <div className={`mb-3 rounded-xl border p-3 ${isWhiteMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/40'}`}>
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-[10px] font-semibold text-slate-400">Files</p>
                            <label
                              className={`inline-flex cursor-pointer items-center gap-2 rounded-full px-2 py-1 text-[10px] ${
                                isWhiteMode ? 'border border-black bg-black text-white hover:bg-slate-900' : 'border border-white/30 bg-black text-white hover:border-nest-gold/40'
                              }`}
                            >
                              <input
                                type="file"
                                multiple
                                className="hidden"
                                onChange={(e) => void handleUploadProjectFiles(project.id, e.target.files)}
                              />
                              {isUploadingFilesProjectId === project.id ? 'Uploading…' : 'Upload files'}
                            </label>
                          </div>
                          {filesError && <p className="text-[10px] text-red-400">{filesError}</p>}
                          <div className="max-h-40 space-y-1 overflow-y-auto">
                            {(projectFiles[project.id] ?? []).length === 0 ? (
                              <p className="text-[10px] text-slate-500">No files yet.</p>
                            ) : (
                              (projectFiles[project.id] ?? []).map((f) => (
                                <div key={f.path} className="flex items-center justify-between gap-2 text-[10px]">
                                  <span className={isWhiteMode ? 'text-slate-700' : 'text-slate-300'}>{f.name}</span>
                                  <div className="flex items-center gap-1">
                                    <a
                                      href={f.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className={`rounded-full px-2 py-0.5 ${isWhiteMode ? 'border border-slate-300' : 'border border-white/20'}`}
                                    >
                                      Open
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteProjectFile(project.id, f.path)}
                                      disabled={isDeletingFilePath === f.path}
                                      className="rounded-full border border-red-500/60 bg-red-500/10 px-2 py-0.5 text-[9px] text-red-200 hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {isDeletingFilePath === f.path ? 'Deleting…' : 'Delete'}
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        {/* Invoices */}
                        <div className={`mb-3 rounded-xl border p-3 ${isWhiteMode ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-black/40'}`}>
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-[10px] font-semibold text-slate-400">Invoices</p>
                            {(() => {
                              const list = invoicesByProject[project.id] ?? []
                              const total = list.reduce((sum, inv) => sum + (inv.amount * (inv.direction === 'paid' ? -1 : 1)), 0)
                              const pos = total >= 0
                              const fmt = Math.abs(total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              return (
                                <span className={`text-[10px] ${pos ? 'text-emerald-500' : 'text-red-500'}`}>
                                  Total: {pos ? '+' : '−'}€{fmt}
                                </span>
                              )
                            })()}
                          </div>
                          {invoicesError && <p className="text-[10px] text-red-400">{invoicesError}</p>}
                          <div className="max-h-40 space-y-1 overflow-y-auto">
                            {(invoicesByProject[project.id] ?? []).length === 0 ? (
                              <p className="text-[10px] text-slate-500">No invoices yet.</p>
                            ) : (
                              (invoicesByProject[project.id] ?? []).map((inv) => (
                                <div key={inv.id} className="flex items-center justify-between gap-2 text-[10px]">
                                  <div className="flex min-w-0 flex-1 items-center gap-2">
                                    <span className={`shrink-0 ${isWhiteMode ? 'text-slate-700' : 'text-slate-300'}`}>
                                      {inv.invoice_number || '—'}
                                    </span>
                                    <span className={`truncate ${isWhiteMode ? 'text-slate-600' : 'text-slate-400'}`}>
                                      {inv.description || '—'}
                                    </span>
                                  </div>
                                  <div className="shrink-0">
                                    {(() => {
                                      const signed = inv.direction === 'paid' ? -inv.amount : inv.amount
                                      const pos = signed >= 0
                                      const fmt = Math.abs(signed).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                      return (
                                        <span className={`${pos ? 'text-emerald-500' : 'text-red-500'}`}>
                                          {pos ? '+' : '−'}€{fmt}
                                        </span>
                                      )
                                    })()}
                                  </div>
                                  <span className={isWhiteMode ? 'text-slate-500' : 'text-slate-500'}>
                                    {new Date(inv.created_at).toLocaleDateString()}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteInvoice(inv.id, project.id)}
                                    disabled={isDeletingInvoiceId === inv.id}
                                    className="rounded-full border border-red-500/60 bg-red-500/10 px-2 py-0.5 text-[9px] text-red-200 hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isDeletingInvoiceId === inv.id ? 'Deleting…' : 'Delete'}
                                  </button>
                                </div>
                              ))
                            )}
                          </div>
                          <form
                            className="mt-2 flex flex-wrap items-center gap-2"
                            onSubmit={(e) => void handleAddInvoice(e, project.id)}
                          >
                            <input
                              className={`w-32 rounded-xl border px-2 py-1 text-[10px] ${isWhiteMode ? 'border-slate-300 bg-white text-slate-900' : 'border-white/10 bg-black/40 text-slate-100'}`}
                              placeholder="Invoice No."
                              value={newInvoiceNumberByProject[project.id] ?? ''}
                              onChange={(e) => {
                                setNewInvoiceNumberByProject((prev) => ({ ...prev, [project.id]: e.target.value }))
                                setInvoicesError(null)
                              }}
                            />
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className={`w-28 rounded-xl border px-2 py-1 text-[10px] ${isWhiteMode ? 'border-slate-300 bg-white text-slate-900' : 'border-white/10 bg-black/40 text-slate-100'}`}
                              placeholder="Amount (€)"
                              value={newInvoiceAmountByProject[project.id] ?? ''}
                              onChange={(e) => {
                                setNewInvoiceAmountByProject((prev) => ({ ...prev, [project.id]: e.target.value }))
                                setInvoicesError(null)
                              }}
                            />
                            <select
                              className={`w-28 rounded-xl border px-2 py-1 text-[10px] ${isWhiteMode ? 'border-slate-300 bg-white text-slate-900' : 'border-white/10 bg-black/40 text-slate-100'}`}
                              value={newInvoiceDirectionByProject[project.id] ?? 'paid'}
                              onChange={(e) => {
                                const val = (e.target.value === 'received' ? 'received' : 'paid') as 'paid' | 'received'
                                setNewInvoiceDirectionByProject((prev) => ({ ...prev, [project.id]: val }))
                                setInvoicesError(null)
                              }}
                            >
                              <option value="paid">Paid (−)</option>
                              <option value="received">Received (+)</option>
                            </select>
                            <input
                              className={`min-w-[140px] flex-1 rounded-xl border px-2 py-1 text-[10px] ${isWhiteMode ? 'border-slate-300 bg-white text-slate-900' : 'border-white/10 bg-black/40 text-slate-100'}`}
                              placeholder="Description (optional)"
                              value={newInvoiceDescByProject[project.id] ?? ''}
                              onChange={(e) => {
                                setNewInvoiceDescByProject((prev) => ({ ...prev, [project.id]: e.target.value }))
                                setInvoicesError(null)
                              }}
                            />
                            <button
                              type="submit"
                              disabled={isAddingInvoiceProjectId === project.id}
                              className="rounded-full bg-nest-gold px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-black hover:bg-nest-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {isAddingInvoiceProjectId === project.id ? 'Adding…' : 'Add'}
                            </button>
                          </form>
                        </div>
                        <p className="text-[10px] font-semibold text-slate-400">Step comments</p>
                        {currentStep ? (
                          <>
                            {stepComments.length === 0 ? (
                              <p className="text-xs text-slate-500">No comments yet for this step.</p>
                            ) : (
                              <div className="mt-1 max-h-40 space-y-1 overflow-y-auto">
                                {stepComments.map((c) => (
                                  <div key={c.id} className={`rounded border px-2 py-1 ${isWhiteMode ? 'border-slate-200 bg-white' : 'border-white/10 bg-black/40'}`}>
                                    <p className={`text-xs ${isWhiteMode ? 'text-slate-800' : 'text-slate-200'}`}>{c.body}</p>
                                    <div className="mt-0.5 flex items-center justify-between gap-2">
                                      <p className="text-[10px] text-slate-500">
                                        {(authorFirstNames[c.created_by || ''] || 'Unknown')} · {new Date(c.created_at).toLocaleString()}
                                      </p>
                                      {isAdmin && (
                                        <button
                                          type="button"
                                          onClick={() => void handleDeleteProjectStepComment(c.id)}
                                          disabled={deletingProjectCommentId === c.id}
                                          className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[9px] text-red-200 hover:border-red-400 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                          {deletingProjectCommentId === c.id ? 'Deleting…' : 'Delete'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            <form
                              className="mt-2 space-y-1"
                              onSubmit={(event) => void handleSubmitProjectStepComment(event, project.id, currentStep.id)}
                            >
                              <input
                                className={`w-full rounded-lg border px-3 py-2 text-xs placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
                                  isWhiteMode ? 'border-slate-300 bg-white text-slate-900 shadow-sm' : 'border-white/10 bg-black/40 text-slate-100'
                                }`}
                                placeholder="Add a comment..."
                                value={commentDraft}
                                onChange={(event) => {
                                  if (!commentKey) return
                                  setNewProjectComments({
                                    ...newProjectComments,
                                    [commentKey]: event.target.value,
                                  })
                                }}
                              />
                              <button
                                type="submit"
                                disabled={!commentKey || !commentDraft.trim() || isSubmittingProjectCommentKey === commentKey}
                                className="rounded-full bg-nest-gold px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-black hover:bg-nest-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isSubmittingProjectCommentKey === commentKey ? 'Posting…' : 'Post Comment'}
                              </button>
                            </form>
                          </>
                        ) : (
                          <p className="text-xs text-slate-500">Start the project to comment on steps.</p>
                        )}
                      </div>
                    </>
                  )
                })()}
              </div>
            </div>
          )}
        </main>
      ) : activePage === 'settings' ? (
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-4 px-6 pb-6 pt-4">
          <section className="flex-1 rounded-2xl border border-white/5 bg-nest-surface/80 p-4 text-[11px] text-slate-100 shadow-soft-elevated">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Settings  b7 Profile
                </p>
                <p className="text-[11px] text-slate-400">
                  Set your display name and choose one of the company roles.
                </p>
              </div>
            </div>
            {!user ? (
              <p className="text-[11px] text-slate-500">Sign in to edit your profile.</p>
            ) : (
              <form className="space-y-3 max-w-sm" onSubmit={handleSaveProfile}>
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-slate-300">Account</p>
                  <p className="text-[10px] text-slate-500">
                    Registered email:{' '}
                    <span className="font-medium text-slate-200">{user.email}</span>
                  </p>
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-500">First name</p>
                    <input
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
                      value={profileFirstName}
                      onChange={(event) => setProfileFirstName(event.target.value)}
                      placeholder="First name"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-500">Last name</p>
                    <input
                      className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
                      value={profileLastName}
                      onChange={(event) => setProfileLastName(event.target.value)}
                      placeholder="Last name"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500">Company role</p>
                  <select
                    className="w-full rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] text-slate-100 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
                    value={profileRole}
                    onChange={(event) => setProfileRole(event.target.value)}
                  >
                    <option value="">Select your role</option>
                    {customRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-500">
                    You must choose one of the roles defined by the admin.
                  </p>
                </div>
                {profileError && (
                  <p className="text-[10px] text-red-400">{profileError}</p>
                )}
                {profileSuccess && (
                  <p className="text-[10px] text-emerald-400">{profileSuccess}</p>
                )}
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="rounded-full bg-nest-gold px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-black shadow-soft-elevated hover:bg-nest-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSavingProfile ? 'Saving...' : 'Save profile'}
                </button>
              </form>
            )}
          </section>
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-6 pb-6 pt-4">
          <section className="flex-1 rounded-2xl border border-white/5 bg-nest-surface/80 p-4 text-[11px] text-slate-100 shadow-soft-elevated">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Wiki · Internal regulations
                </p>
                <p className="text-[11px] text-slate-400">
                  Central reference for company processes and regulations.
                </p>
              </div>
              {isAdmin && !isEditingWiki && (
                <button
                  type="button"
                  onClick={() => {
                    setWikiDraftTitle(wikiTitle)
                    setWikiDraftContent(wikiContent)
                    setWikiDraftCategories(wikiCategories)
                    setIsEditingWiki(true)
                  }}
                  className="rounded-full border border-nest-gold/40 bg-black/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-nest-gold hover:bg-nest-gold/10"
                >
                  Edit
                </button>
              )}
            </div>
            {wikiError && (
              <p className="mb-2 text-[10px] text-red-400">{wikiError}</p>
            )}
            {isLoadingWiki ? (
              <p className="text-[11px] text-slate-500">Loading wiki...</p>
            ) : isEditingWiki && isAdmin ? (
              <form className="space-y-3" onSubmit={handleSaveWiki}>
                <input
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
                  value={wikiDraftTitle}
                  onChange={(event) => setWikiDraftTitle(event.target.value)}
                />
                <textarea
                  className="min-h-[220px] w-full resize-y rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
                  value={wikiDraftContent}
                  onChange={(event) => setWikiDraftContent(event.target.value)}
                  placeholder="Write your company regulations here..."
                />
                <input
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
                  value={wikiDraftCategories}
                  onChange={(event) => setWikiDraftCategories(event.target.value)}
                  placeholder="Categories (comma-separated, e.g. Safety, Legal, Operations)"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isSavingWiki}
                    className="rounded-full bg-nest-gold px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-black shadow-soft-elevated hover:bg-nest-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingWiki ? 'Saving...' : 'Save wiki'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingWiki(false)
                      setWikiError(null)
                    }}
                    className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-200 hover:border-nest-gold/40 hover:text-nest-gold"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <article className="max-h-[520px] overflow-y-auto rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <h2 className="mb-1 text-[12px] font-semibold text-slate-100">{wikiTitle}</h2>
                {wikiCategories && (
                  <p className="mb-2 text-[10px] text-slate-400">
                    Categories: {wikiCategories}
                  </p>
                )}
                {wikiContent ? (
                  <p className="whitespace-pre-wrap text-[11px] text-slate-200">{wikiContent}</p>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    No wiki content yet. {isAdmin ? 'Click Edit to add your first version.' : 'Ask an admin to add the regulations.'}
                  </p>
                )}
              </article>
            )}
          </section>
        </main>
      )}
      {isAdmin && isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-nest-surface/95 p-4 text-[11px] text-slate-100 shadow-soft-elevated">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Admin · Settings
              </p>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] text-slate-300 hover:border-nest-gold/40 hover:text-nest-gold"
              >
                Close
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-slate-300">Wiki link</p>
                <p className="mb-1 text-[10px] text-slate-500">
                  Paste the URL of your internal wiki or regulations page. It will appear as a Wiki button in the
                  header.
                </p>
                <input
                  className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
                  placeholder="https://wiki.your-company.com/regulations"
                  value={wikiUrl}
                  onChange={(event) => setWikiUrl(event.target.value)}
                />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-300">Company roles</p>
                <p className="mb-1 text-[10px] text-slate-500">
                  These roles are available when assigning responsibilities and lanes to steps.
                </p>
                <div className="mb-1 flex flex-wrap gap-1">
                  {customRoles.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleRemoveRole(role)}
                      className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] text-rose-100 hover:border-rose-400 hover:bg-rose-500/20"
                    >
                      <span>{role}</span>
                      <span className="text-[11px]">×</span>
                    </button>
                  ))}
                </div>
                {rolesError && (
                  <p className="mb-1 text-[10px] text-red-400">{rolesError}</p>
                )}
                <form className="mt-1 flex gap-2" onSubmit={handleAddRole}>
                  <input
                    className="flex-1 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50"
                    placeholder="Add custom role (e.g. Legal)"
                    value={newRoleName}
                    onChange={(event) => setNewRoleName(event.target.value)}
                  />
                  <button
                    type="submit"
                    className="rounded-full border border-nest-gold/40 bg-nest-gold/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-nest-gold hover:bg-nest-gold/20"
                  >
                    Add
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Print-only workflow export (A4-friendly) */}
      <div id="print-workflow">
        <div className="print-container">
          <header className="print-header">
            <div className="print-header-main">
              <div>
                <h1 className="print-title">Workflow Export</h1>
                {selectedProcess?.name && (
                  <p className="print-subtitle">Process: {selectedProcess.name}</p>
                )}
                {steps.length > 0 &&
                  (() => {
                    const totalPoints = steps.length
                    const totalDays = steps.reduce((sum, step) => {
                      const value = step.duration_days ?? 0
                      return sum + (Number.isFinite(value) ? value : 0)
                    }, 0)
                    const totalHours = Math.round(totalDays * 24)
                    const days = Math.floor(totalHours / 24)
                    const hours = totalHours % 24
                    const parts: string[] = []
                    if (days > 0) parts.push(`${days}d`)
                    if (hours > 0) parts.push(`${hours}h`)
                    const durationLabel = parts.length > 0 ? parts.join(' ') : '0d'

                    return (
                      <p className="print-meta">
                        Total: {totalPoints} points · {durationLabel}
                      </p>
                    )
                  })()}
              </div>
            </div>
            <p className="print-meta">
              Exported on {exportedAt ?? new Date().toLocaleString()} by {user?.email ?? 'Unknown user'}
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
                  <th>Time</th>
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
                      <td>
                        {(() => {
                          const value = step.duration_days
                          if (value === null || value === undefined) return ''
                          const total = value || 0
                          const wholeDays = Math.trunc(total)
                          const hours = Math.round((total - wholeDays) * 24)
                          const parts: string[] = []
                          if (wholeDays) parts.push(`${wholeDays}d`)
                          if (hours) parts.push(`${hours}h`)
                          if (parts.length === 0) return '0d'
                          return parts.join(' ')
                        })()}
                      </td>
                      <td>{step.description ?? ''}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
      {isFullscreen && (
        <div
          className={`fixed inset-0 z-40 flex flex-col ${
            isWhiteMode ? 'bg-slate-100' : 'bg-black/95'
          }`}
        >
          <header
            className={`flex items-center justify-between border-b px-4 py-2 text-[11px] ${
              isWhiteMode
                ? 'border-slate-200 bg-white text-slate-800'
                : 'border-white/10 bg-black/70 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="rounded-full border border-nest-gold/40 bg-nest-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-nest-gold">
                {selectedProcess?.name ?? 'Workflow'}
              </span>
              <span className="text-slate-500">Fullscreen workflow view</span>
            </div>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className={`rounded-full border px-2.5 py-0.5 text-[10px] hover:border-nest-gold/40 hover:text-nest-gold ${
                isWhiteMode
                  ? 'border-slate-300 bg-white text-slate-700 shadow-sm'
                  : 'border-white/10 bg-black/40 text-slate-300'
              }`}
            >
              Close
            </button>
          </header>
          <div
            className={`relative flex-1 bg-gradient-to-br ${
              isWhiteMode
                ? 'from-slate-100 via-slate-50 to-slate-100'
                : 'from-black via-slate-900 to-black'
            }`}
          >
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
                <Background color={isWhiteMode ? '#e5e7eb' : '#111827'} gap={24} />
                <Controls position="bottom-right" />
              </ReactFlow>
            </ReactFlowProvider>
            {selectedStep && (
              <div
                className={`pointer-events-auto absolute top-4 right-4 z-50 w-80 max-w-[90vw] rounded-2xl border p-3 text-[11px] shadow-soft-elevated backdrop-blur ${
                  isWhiteMode
                    ? 'border-slate-200 bg-white text-slate-900'
                    : 'border-white/10 bg-black/80 text-slate-100'
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p
                    className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                      isWhiteMode ? 'text-slate-700' : 'text-slate-400'
                    }`}
                  >
                    Step details
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedStepId(null)}
                    className={`rounded-full border px-2 py-0.5 text-[10px] hover:border-nest-gold/40 hover:text-nest-gold ${
                      isWhiteMode
                        ? 'border-slate-300 bg-slate-50 text-slate-800'
                        : 'border-white/10 bg-black/40 text-slate-300'
                    }`}
                  >
                    Close
                  </button>
                </div>
                <p
                  className={`text-[11px] font-semibold ${
                    isWhiteMode ? 'text-slate-900' : 'text-slate-50'
                  }`}
                >
                  {selectedStep.title}
                </p>
                <div
                  className={`mt-1 flex flex-wrap items-center gap-2 text-[10px] ${
                    isWhiteMode ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  <span>Responsibility:</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] ${getRoleBadgeClasses(selectedStep.role)}`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-current/70" />
                    {selectedStep.role ?? 'Unassigned'}
                  </span>
                </div>
                <p
                  className={`mt-1 text-[10px] ${
                    isWhiteMode ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  Order index:{' '}
                  <span className={isWhiteMode ? 'text-slate-900' : 'text-slate-200'}>
                    {selectedStep.order_index}
                  </span>
                </p>
                {selectedStep.description && (
                  <p
                    className={`mt-1 text-[11px] whitespace-pre-wrap ${
                      isWhiteMode ? 'text-slate-800' : 'text-slate-200'
                    }`}
                  >
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
