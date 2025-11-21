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
import type { User } from '@supabase/supabase-js'
import { supabase } from './lib/supabaseClient'

type Comment = {
  id: string
  created_at: string
  process_id: string
  step_id: string | null
  project_id?: string | null
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
  duration_days: number | null
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

const ADMIN_EMAIL = 'captain-pavlos@outlook.com'
const DEFAULT_PROCESS_SLUG = 'renovation'

const ROLE_COLORS: Record<string, { border: string; background: string; badge: string }> = {
  Client: {
    border: '#38bdf8',
    background: 'rgba(15,23,42,0.9)',
    badge: 'border-sky-500 bg-sky-100 text-sky-900',
  },
  MD: {
    border: '#facc15',
    background: 'rgba(51, 37, 0, 0.9)',
    badge: 'border-yellow-500 bg-yellow-100 text-yellow-900',
  },
  OPS: {
    border: '#22c55e',
    background: 'rgba(6, 78, 59, 0.9)',
    badge: 'border-emerald-500 bg-emerald-100 text-emerald-900',
  },
  PM: {
    border: '#a855f7',
    background: 'rgba(46,16,101,0.9)',
    badge: 'border-purple-500 bg-purple-100 text-purple-900',
  },
  'PM & OPS': {
    border: '#f97316',
    background: 'rgba(30,64,175,0.9)',
    badge: 'border-orange-500 bg-orange-100 text-orange-900',
  },
}

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
  return 'border-slate-400 bg-slate-100 text-slate-800'
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
  const [newRoleName, setNewRoleName] = useState('')
  const [rolesError, setRolesError] = useState<string | null>(null)

  const [appMessage] = useState<string | null>(null)
  const [appMessageType] = useState<'success' | 'error'>('success')

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
          // eslint-disable-next-line no-console
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
          // eslint-disable-next-line no-console
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
        // eslint-disable-next-line no-console
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

      for (const item of items) {
        if (item.project) {
          nextProjects.push(item.project)
        }

        if (Array.isArray(item.steps)) {
          for (const step of item.steps) {
            if (!step || !step.id || !step.process_id || !step.title) continue
            nextSteps.push({
              id: step.id,
              process_id: step.process_id,
              title: step.title,
              order_index: step.order_index ?? 0,
              description: (step as { description?: string | null }).description ?? null,
              duration_days: (step as { duration_days?: number | null }).duration_days ?? null,
            })
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
          .select('id, process_id, title, description, role, order_index, duration_days')
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
      if (selectedStepId !== null) {
        setSelectedStepId(null)
      }
      return
    }

    const hasSelectedInCurrent = steps.some((step) => step.id === selectedStepId)
    if (!hasSelectedInCurrent && selectedStepId !== null) {
      setSelectedStepId(null)
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
        // eslint-disable-next-line no-console
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
      .upsert(
        {
          id: user.id,
          full_name: `${firstName} ${lastName}`.trim() || null,
          role: role || null,
        },
        { onConflict: 'id' },
      )
      .select('full_name, role')
      .single()

    if (error) {
      // eslint-disable-next-line no-console
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
      // eslint-disable-next-line no-console
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
      // eslint-disable-next-line no-console
      console.error('Failed to create project', error)
      setProjectFormError('Failed to create project')
    } else if (data) {
      setProjects((prev) => [data, ...prev])
      setNewProjectName('')
      setNewProjectProcessId('')
    }

    setIsCreatingProject(false)
  }

  const handleChangeProjectStep = async (projectId: string, stepId: string | null) => {
    if (!supabase) return

    if (!user) {
      setProjectsError('You must be signed in to update project progress.')
      return
    }

    const { data, error } = await supabase
      .from('projects')
      .update({ current_step_id: stepId })
      .eq('id', projectId)
      .select('id, name, process_id, current_step_id, status, created_at')
      .single()

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to update project step', error)
      setProjectsError('Failed to update project step')
      return
    }

    setProjects((prev) => prev.map((project) => (project.id === projectId ? data : project)))
    setProjectsError(null)
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
      // eslint-disable-next-line no-console
      console.error('Failed to post project step comment', error)
      setProjectCommentsError('Failed to post project step comment')
    } else if (data) {
      setProjectComments((prev) => [data, ...prev])
      setNewProjectComments((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }

    setIsSubmittingProjectCommentKey(null)
  }

  const handleDeleteProjectStepComment = async (commentId: string) => {
    if (!supabase) return
    if (!isAdmin) return

    setDeletingProjectCommentId(commentId)
    setProjectCommentsError(null)

    const { error } = await supabase
      .from('project_step_comments')
      .delete()
      .eq('id', commentId)

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete project step comment', error)
      setProjectCommentsError('Failed to delete project step comment')
    } else {
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
      // eslint-disable-next-line no-console
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

  const handleCancelEditProjectName = () => {
    setEditingProjectId(null)
    setEditingProjectName('')
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
      // eslint-disable-next-line no-console
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
      // eslint-disable-next-line no-console
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

    const { error } = await supabase.from('comments').delete().eq('id', id)

    if (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to delete comment', error)
      setCommentError('Failed to delete comment')
      return
    }

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

        // eslint-disable-next-line no-console
        console.error('insert_process_step_with_shift RPC failed, falling back', rpcError)
      } else if (rpcResult) {
        createdStep = Array.isArray(rpcResult)
          ? (rpcResult[0] as ProcessStep)
          : (rpcResult as ProcessStep)
      }
    } catch (rpcUnexpectedError) {
      // eslint-disable-next-line no-console
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
        .select('id, process_id, title, description, role, order_index, duration_days')
        .single()

      if (error) {
        // eslint-disable-next-line no-console
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
      .select('id, process_id, title, description, role, order_index, duration_days')
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
      // eslint-disable-next-line no-console
      console.error('Failed to delete connection', error)
      setTransitionFormError('Failed to delete connection between steps')
      return
    }

    setTransitions((prev) => prev.filter((transition) => transition.id !== transitionId))
    setTransitionFormError(null)
  }

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

    const openCommentStepIds = new Set(
      comments
        .filter((comment) => comment.status === 'open' && comment.step_id)
        .map((comment) => comment.step_id as string),
    )

    const dynamicNodes: Node[] = steps.map((step) => {
      const laneKey = getLaneKey(step)
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
      style: {
        stroke: isWhiteMode ? '#0f172a' : '#e5e7eb',
        strokeWidth: 2,
      },
    }))

    return { nodes: dynamicNodes, edges: dynamicEdges }
  }, [steps, transitions, comments, selectedStepId, isWhiteMode])

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

  const visibleComments = useMemo(() => {
    if (!selectedStepId) return []
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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full border shadow-soft-elevated ${
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
              <p className={`mt-0.5 text-[11px] ${
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
                  <span className={`hidden text-[10px] sm:inline ${
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
        <main className="mx-auto flex w-full max-w-7xl flex-1 gap-4 px-6 pb-6 pt-4">
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
                {steps.length > 0 &&
                  (() => {
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
                      <span className="ml-2 text-[10px] text-slate-500">
                        · {steps.length} points · {durationLabel}
                      </span>
                    )
                  })()}
              </span>
            </div>
            <div className="flex items-center gap-2">
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
                <p
                  className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${
                    isWhiteMode ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  Admin · Edit Flow
                </p>
                <p
                  className={`text-[10px] ${
                    isWhiteMode ? 'text-slate-600' : 'text-slate-500'
                  }`}
                >
                  Process:{' '}
                  {processes.find((p) => p.id === selectedProcessId)?.slug ?? 'none selected'}
                </p>
              </div>
              <div className="space-y-3">
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
                              // eslint-disable-next-line no-console
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
              </div>
            </div>
          )}
        </section>

        {/* Comments & details */}
        {isCommentsSidebarVisible && (
          <aside
            className={`hidden w-80 shrink-0 flex-col rounded-2xl border p-3 lg:flex ${
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
                      {(selectedProcess?.name ?? 'Workflow')} ·{' '}
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
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-6 pb-6 pt-4">
          <section
            className={`flex-1 rounded-2xl border p-4 text-[11px] ${
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
                  {isLoadingProjects && (
                    <span className="text-[10px] text-slate-500">Loading...</span>
                  )}
                </div>
                {projectsError && (
                  <p className="text-[10px] text-red-400">{projectsError}</p>
                )}
                {projects.length === 0 ? (
                  <p className="text-[11px] text-slate-500">
                    No projects yet. Use the New project box on the right to create your first one.
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
                                onClick={() =>
                                  setExpandedProjectHistoryId((current) =>
                                    current === project.id ? null : project.id,
                                  )
                                }
                                disabled={previousStepActivities.length === 0}
                                className={`rounded-full px-2 py-0.5 text-[9px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                                  isWhiteMode
                                    ? 'border border-black bg-black text-white hover:bg-slate-900'
                                    : 'border border-white/30 bg-black text-white hover:border-nest-gold/40'
                                }`}
                              >
                                History
                              </button>
                            </div>
                          </div>
                          <div className="mt-2 grid gap-2 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1.3fr)]">
                            <div className="space-y-1">
                              <p className="text-[10px] text-slate-400">Progress</p>
                              <p
                                className={`text-[10px] ${
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
                                <p className="text-[10px] text-slate-400">
                                  {currentStep.description}
                                </p>
                              )}
                              {currentStep && (
                                <p className="text-[9px] text-slate-500">
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
                                  <p className="text-[10px] text-slate-400">
                                    Estimated remaining duration: {remainingDurationDisplay} days
                                  </p>
                                  {estimatedFinishDate && (
                                    <p className="text-[10px] text-slate-400">
                                      Estimated finish date: {estimatedFinishDate}
                                    </p>
                                  )}
                                </>
                              )}
                              <div className="mt-1 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={stepsForProcess.length === 0 || !currentStep || !user}
                                  onClick={() => {
                                    if (stepsForProcess.length === 0 || !currentStep) return
                                    const index = stepsForProcess.findIndex(
                                      (step) => step.id === currentStep.id,
                                    )
                                    if (index <= 0) return
                                    const previous = stepsForProcess[index - 1]
                                    void handleChangeProjectStep(project.id, previous.id)
                                  }}
                                  className={`flex-1 inline-flex items-center justify-center rounded-full border px-3 py-1 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                                    isWhiteMode
                                      ? 'border-red-500 bg-red-500 text-white hover:bg-red-600 hover:border-red-600'
                                      : 'border-red-500/60 bg-red-500/15 text-red-200 hover:border-red-400 hover:bg-red-500/25'
                                  }`}
                                >
                                  &lt;- Go Back
                                </button>
                                <button
                                  type="button"
                                  disabled={stepsForProcess.length === 0 || !user}
                                  onClick={() => {
                                    if (stepsForProcess.length === 0) return
                                    if (!currentStep) {
                                      const first = stepsForProcess[0]
                                      void handleChangeProjectStep(project.id, first.id)
                                      return
                                    }
                                    const index = stepsForProcess.findIndex(
                                      (step) => step.id === currentStep.id,
                                    )
                                    if (index < 0) return
                                    if (index >= stepsForProcess.length - 1) return
                                    const next = stepsForProcess[index + 1]
                                    void handleChangeProjectStep(project.id, next.id)
                                  }}
                                  className={`flex-1 inline-flex items-center justify-center rounded-full border px-3 py-1 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${
                                    isWhiteMode
                                      ? 'border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600 hover:border-emerald-600'
                                      : 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300 hover:border-emerald-400 hover:bg-emerald-500/25'
                                  }`}
                                >
                                  Done -&gt;
                                </button>
                              </div>
                            </div>
                            <div
                              className={`space-y-1 rounded-lg border p-2 ${
                                isWhiteMode
                                  ? 'border-slate-200 bg-slate-50'
                                  : 'border-white/10 bg-black/30'
                              }`}
                            >
                              <p
                                className={`text-[10px] font-semibold ${
                                  isWhiteMode ? 'text-slate-800' : 'text-slate-300'
                                }`}
                              >
                                Step comments
                              </p>
                              {!currentStep ? (
                                <p className="text-[10px] text-slate-500">
                                  Start the project to comment on steps.
                                </p>
                              ) : stepComments.length === 0 ? (
                                <p className="text-[10px] text-slate-500">
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
                                        className={`text-[10px] whitespace-pre-wrap ${
                                          isWhiteMode ? 'text-slate-800' : 'text-slate-200'
                                        }`}
                                      >
                                        {comment.body}
                                      </p>
                                      <div className="mt-0.5 flex items-center justify-between gap-2">
                                        <p className="text-[9px] text-slate-500">
                                          {new Date(comment.created_at).toLocaleString()}
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
                                <p className="text-[10px] text-red-400">{projectCommentsError}</p>
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
                                    className={`h-12 w-full resize-none rounded border px-2 py-1 text-[10px] placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
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
              <aside
                className={`mt-2 w-full max-w-xs rounded-2xl border p-3 text-[10px] md:mt-0 md:ml-4 ${
                  isWhiteMode
                    ? 'border-slate-200 bg-white text-slate-900'
                    : 'border-white/10 bg-black/30 text-slate-100'
                }`}
              >
                <form className="space-y-2" onSubmit={handleCreateProject}>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-300">New project</p>
                    <p className="text-[10px] text-slate-500">
                      {user
                        ? 'Pick a process template and give the project a clear name (e.g. Renovation – Penthouse A).'
                        : 'Sign in to create projects from process templates.'}
                    </p>
                  </div>
                  <input
                    className={`w-full rounded-xl border px-3 py-1 text-[10px] placeholder:text-slate-500 focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
                      isWhiteMode
                        ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                        : 'border-white/10 bg-black/40 text-slate-100'
                    }`}
                    placeholder="Project name"
                    value={newProjectName}
                    onChange={(event) => setNewProjectName(event.target.value)}
                    disabled={!user}
                  />
                  <select
                    className={`w-full rounded-xl border px-2.5 py-1 text-[10px] focus:border-nest-gold/60 focus:outline-none focus:ring-1 focus:ring-nest-gold/50 ${
                      isWhiteMode
                        ? 'border-slate-300 bg-white text-slate-900 shadow-sm'
                        : 'border-white/10 bg-black/40 text-slate-100'
                    }`}
                    value={newProjectProcessId}
                    onChange={(event) => setNewProjectProcessId(event.target.value)}
                    disabled={!user}
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
                  <button
                    type="submit"
                    disabled={isCreatingProject || !user}
                    className="w-full rounded-full bg-nest-gold px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-black shadow-soft-elevated hover:bg-nest-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCreatingProject ? 'Creating...' : 'Create project'}
                  </button>
                </form>
              </aside>
            </div>
          </section>
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
