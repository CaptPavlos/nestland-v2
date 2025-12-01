-- ============================================
-- Neon Auth Functions Setup (in public schema)
-- ============================================

-- Drop existing auth schema functions if any (we'll use public schema instead)
DROP FUNCTION IF EXISTS public.current_user_id();
DROP FUNCTION IF EXISTS public.current_user_email();
DROP FUNCTION IF EXISTS public.current_user_role();
DROP FUNCTION IF EXISTS public.current_user_jwt();

-- Create helper functions in public schema
-- Your app will set these via: SET LOCAL app.current_user_id = 'uuid';

-- current_user_id() - Returns current user's UUID
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;

-- current_user_email() - Returns current user's email
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_email', true), '');
$$;

-- current_user_role() - Returns current user's role (authenticated/anon)
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.current_user_role', true), ''), 'anon');
$$;

-- current_user_jwt() - Returns JWT claims as JSON (for backward compatibility)
CREATE OR REPLACE FUNCTION public.current_user_jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'sub', NULLIF(current_setting('app.current_user_id', true), ''),
    'email', NULLIF(current_setting('app.current_user_email', true), ''),
    'role', COALESCE(NULLIF(current_setting('app.current_user_role', true), ''), 'anon')
  );
$$;

-- ============================================
-- Drop ALL existing policies first
-- ============================================

-- profiles
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self" ON public.profiles;

-- properties
DROP POLICY IF EXISTS "Admins can delete properties" ON public.properties;
DROP POLICY IF EXISTS "Admins can insert properties" ON public.properties;
DROP POLICY IF EXISTS "Admins can update properties" ON public.properties;
DROP POLICY IF EXISTS "Approved brokers can view available properties" ON public.properties;

-- clients
DROP POLICY IF EXISTS "Admins can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Brokers can insert own clients" ON public.clients;
DROP POLICY IF EXISTS "Brokers can update own clients" ON public.clients;
DROP POLICY IF EXISTS "Brokers can view own clients" ON public.clients;

-- client_links
DROP POLICY IF EXISTS "Admins can view all client links" ON public.client_links;
DROP POLICY IF EXISTS "Brokers can create own client links" ON public.client_links;
DROP POLICY IF EXISTS "Brokers can update own client links" ON public.client_links;
DROP POLICY IF EXISTS "Brokers can view own client links" ON public.client_links;

-- link_analytics
DROP POLICY IF EXISTS "Admins can view all analytics" ON public.link_analytics;
DROP POLICY IF EXISTS "Anyone can insert analytics (for tracking)" ON public.link_analytics;
DROP POLICY IF EXISTS "Brokers can view analytics for own links" ON public.link_analytics;

-- commissions
DROP POLICY IF EXISTS "Admins can manage all commissions" ON public.commissions;
DROP POLICY IF EXISTS "Brokers can view own commissions" ON public.commissions;

-- market_stats
DROP POLICY IF EXISTS "Admins can manage market stats" ON public.market_stats;
DROP POLICY IF EXISTS "Anyone can view active market stats" ON public.market_stats;

-- property_favorites
DROP POLICY IF EXISTS "Brokers can manage own favorites" ON public.property_favorites;

-- comments
DROP POLICY IF EXISTS "comments_anon_select" ON public.comments;
DROP POLICY IF EXISTS "comments_anon_insert" ON public.comments;
DROP POLICY IF EXISTS "comments_auth_select" ON public.comments;
DROP POLICY IF EXISTS "comments_auth_insert" ON public.comments;
DROP POLICY IF EXISTS "comments_admin_update" ON public.comments;
DROP POLICY IF EXISTS "Admin can delete comments" ON public.comments;

-- company_wiki
DROP POLICY IF EXISTS "company_wiki_select_all" ON public.company_wiki;
DROP POLICY IF EXISTS "company_wiki_admin_insert" ON public.company_wiki;
DROP POLICY IF EXISTS "company_wiki_admin_update" ON public.company_wiki;

-- processes
DROP POLICY IF EXISTS "public_can_view_processes" ON public.processes;
DROP POLICY IF EXISTS "processes_anon_read" ON public.processes;
DROP POLICY IF EXISTS "processes_admin_all" ON public.processes;

-- process_steps
DROP POLICY IF EXISTS "public_can_view_process_steps" ON public.process_steps;
DROP POLICY IF EXISTS "process_steps_anon_read" ON public.process_steps;
DROP POLICY IF EXISTS "process_steps_admin_all" ON public.process_steps;

-- process_transitions
DROP POLICY IF EXISTS "public_can_view_process_transitions" ON public.process_transitions;
DROP POLICY IF EXISTS "process_transitions_anon_read" ON public.process_transitions;
DROP POLICY IF EXISTS "process_transitions_admin_all" ON public.process_transitions;

-- projects
DROP POLICY IF EXISTS "projects_select_all" ON public.projects;
DROP POLICY IF EXISTS "projects_admin_insert" ON public.projects;
DROP POLICY IF EXISTS "projects_admin_update" ON public.projects;
DROP POLICY IF EXISTS "admin can delete projects" ON public.projects;
DROP POLICY IF EXISTS "any user can move project steps" ON public.projects;

-- project_step_comments
DROP POLICY IF EXISTS "Authenticated can read project step comments" ON public.project_step_comments;
DROP POLICY IF EXISTS "Authenticated can insert project step comments" ON public.project_step_comments;
DROP POLICY IF EXISTS "Authors can update their comments" ON public.project_step_comments;
DROP POLICY IF EXISTS "Admin can delete project step comments" ON public.project_step_comments;

-- project_invoices
DROP POLICY IF EXISTS "project_invoices_select_authenticated" ON public.project_invoices;
DROP POLICY IF EXISTS "project_invoices_insert_authenticated" ON public.project_invoices;
DROP POLICY IF EXISTS "project_invoices_update_admin" ON public.project_invoices;
DROP POLICY IF EXISTS "project_invoices_delete_admin" ON public.project_invoices;

-- ============================================
-- RLS Policies for profiles
-- ============================================

CREATE POLICY "Public profiles are viewable by authenticated users"
ON public.profiles FOR SELECT
USING (current_user_role() = 'authenticated');

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (current_user_id() = id);

-- ============================================
-- RLS Policies for properties
-- ============================================

CREATE POLICY "Admins can delete properties"
ON public.properties FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = current_user_id() AND profiles.role = 'admin'::public.user_role
));

CREATE POLICY "Admins can insert properties"
ON public.properties FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = current_user_id() AND profiles.role = 'admin'::public.user_role
));

CREATE POLICY "Admins can update properties"
ON public.properties FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = current_user_id() AND profiles.role = 'admin'::public.user_role
));

CREATE POLICY "Approved brokers can view available properties"
ON public.properties FOR SELECT
USING (
  (status = 'available'::public.property_status)
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = current_user_id() AND profiles.approval_status = 'approved'::public.approval_status
  )
);

-- ============================================
-- RLS Policies for clients
-- ============================================

CREATE POLICY "Admins can view all clients"
ON public.clients FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = current_user_id() AND profiles.role = 'admin'::public.user_role
));

CREATE POLICY "Brokers can insert own clients"
ON public.clients FOR INSERT
WITH CHECK (broker_id = current_user_id());

CREATE POLICY "Brokers can update own clients"
ON public.clients FOR UPDATE
USING (broker_id = current_user_id());

CREATE POLICY "Brokers can view own clients"
ON public.clients FOR SELECT
USING (broker_id = current_user_id());

-- ============================================
-- RLS Policies for client_links
-- ============================================

CREATE POLICY "Admins can view all client links"
ON public.client_links FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = current_user_id() AND profiles.role = 'admin'::public.user_role
));

CREATE POLICY "Brokers can create own client links"
ON public.client_links FOR INSERT
WITH CHECK (broker_id = current_user_id());

CREATE POLICY "Brokers can update own client links"
ON public.client_links FOR UPDATE
USING (broker_id = current_user_id());

CREATE POLICY "Brokers can view own client links"
ON public.client_links FOR SELECT
USING (broker_id = current_user_id());

-- ============================================
-- RLS Policies for link_analytics
-- ============================================

CREATE POLICY "Admins can view all analytics"
ON public.link_analytics FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = current_user_id() AND profiles.role = 'admin'::public.user_role
));

CREATE POLICY "Anyone can insert analytics (for tracking)"
ON public.link_analytics FOR INSERT
WITH CHECK (true);

CREATE POLICY "Brokers can view analytics for own links"
ON public.link_analytics FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.client_links
  WHERE client_links.id = link_analytics.link_id AND client_links.broker_id = current_user_id()
));

-- ============================================
-- RLS Policies for commissions
-- ============================================

CREATE POLICY "Admins can manage all commissions"
ON public.commissions
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = current_user_id() AND profiles.role = 'admin'::public.user_role
));

CREATE POLICY "Brokers can view own commissions"
ON public.commissions FOR SELECT
USING (broker_id = current_user_id());

-- ============================================
-- RLS Policies for market_stats
-- ============================================

CREATE POLICY "Admins can manage market stats"
ON public.market_stats
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = current_user_id() AND profiles.role = 'admin'::public.user_role
));

CREATE POLICY "Anyone can view active market stats"
ON public.market_stats FOR SELECT
USING (is_active = true);

-- ============================================
-- RLS Policies for property_favorites
-- ============================================

CREATE POLICY "Brokers can manage own favorites"
ON public.property_favorites
USING (broker_id = current_user_id());

-- ============================================
-- RLS Policies for comments
-- ============================================

CREATE POLICY "comments_select_all"
ON public.comments FOR SELECT
USING (true);

CREATE POLICY "comments_insert_all"
ON public.comments FOR INSERT
WITH CHECK (true);

CREATE POLICY "comments_admin_update"
ON public.comments FOR UPDATE
USING (current_user_email() = 'captain-pavlos@outlook.com')
WITH CHECK (current_user_email() = 'captain-pavlos@outlook.com');

CREATE POLICY "Admin can delete comments"
ON public.comments FOR DELETE
USING ((current_user_jwt() ->> 'email') = 'captain-pavlos@outlook.com');

-- ============================================
-- RLS Policies for company_wiki
-- ============================================

CREATE POLICY "company_wiki_select_all"
ON public.company_wiki FOR SELECT
USING (true);

CREATE POLICY "company_wiki_admin_insert"
ON public.company_wiki FOR INSERT
WITH CHECK (current_user_email() = 'captain-pavlos@outlook.com');

CREATE POLICY "company_wiki_admin_update"
ON public.company_wiki FOR UPDATE
USING (current_user_email() = 'captain-pavlos@outlook.com')
WITH CHECK (current_user_email() = 'captain-pavlos@outlook.com');

-- ============================================
-- RLS Policies for processes
-- ============================================

CREATE POLICY "public_can_view_processes"
ON public.processes FOR SELECT
USING (true);

CREATE POLICY "processes_admin_all"
ON public.processes
USING (current_user_email() = 'captain-pavlos@outlook.com')
WITH CHECK (current_user_email() = 'captain-pavlos@outlook.com');

-- ============================================
-- RLS Policies for process_steps
-- ============================================

CREATE POLICY "public_can_view_process_steps"
ON public.process_steps FOR SELECT
USING (true);

CREATE POLICY "process_steps_admin_all"
ON public.process_steps
USING (current_user_email() = 'captain-pavlos@outlook.com')
WITH CHECK (current_user_email() = 'captain-pavlos@outlook.com');

-- ============================================
-- RLS Policies for process_transitions
-- ============================================

CREATE POLICY "public_can_view_process_transitions"
ON public.process_transitions FOR SELECT
USING (true);

CREATE POLICY "process_transitions_admin_all"
ON public.process_transitions
USING (current_user_email() = 'captain-pavlos@outlook.com')
WITH CHECK (current_user_email() = 'captain-pavlos@outlook.com');

-- ============================================
-- RLS Policies for projects
-- ============================================

CREATE POLICY "projects_select_all"
ON public.projects FOR SELECT
USING (true);

CREATE POLICY "projects_admin_insert"
ON public.projects FOR INSERT
WITH CHECK (current_user_email() = 'captain-pavlos@outlook.com');

CREATE POLICY "projects_admin_update"
ON public.projects FOR UPDATE
USING (current_user_email() = 'captain-pavlos@outlook.com')
WITH CHECK (current_user_email() = 'captain-pavlos@outlook.com');

CREATE POLICY "admin can delete projects"
ON public.projects FOR DELETE
USING ((current_user_jwt() ->> 'email') = 'captain-pavlos@outlook.com');

CREATE POLICY "any user can move project steps"
ON public.projects FOR UPDATE
USING (current_user_role() = 'authenticated')
WITH CHECK (current_user_role() = 'authenticated');

-- ============================================
-- RLS Policies for project_step_comments
-- ============================================

CREATE POLICY "Authenticated can read project step comments"
ON public.project_step_comments FOR SELECT
USING (current_user_role() = 'authenticated');

CREATE POLICY "Authenticated can insert project step comments"
ON public.project_step_comments FOR INSERT
WITH CHECK (current_user_role() = 'authenticated');

CREATE POLICY "Authors can update their comments"
ON public.project_step_comments FOR UPDATE
USING (current_user_role() = 'authenticated' AND created_by = current_user_id())
WITH CHECK (current_user_role() = 'authenticated' AND created_by = current_user_id());

CREATE POLICY "Admin can delete project step comments"
ON public.project_step_comments FOR DELETE
USING ((current_user_jwt() ->> 'email') = 'captain-pavlos@outlook.com');

-- ============================================
-- RLS Policies for project_invoices
-- ============================================

CREATE POLICY "project_invoices_select_authenticated"
ON public.project_invoices FOR SELECT
USING (current_user_role() = 'authenticated');

CREATE POLICY "project_invoices_insert_authenticated"
ON public.project_invoices FOR INSERT
WITH CHECK (current_user_role() = 'authenticated');

CREATE POLICY "project_invoices_update_admin"
ON public.project_invoices FOR UPDATE
USING ((current_user_jwt() ->> 'email') = 'captain-pavlos@outlook.com')
WITH CHECK ((current_user_jwt() ->> 'email') = 'captain-pavlos@outlook.com');

CREATE POLICY "project_invoices_delete_admin"
ON public.project_invoices FOR DELETE
USING ((current_user_jwt() ->> 'email') = 'captain-pavlos@outlook.com');

-- ============================================
-- Done! 
-- ============================================
