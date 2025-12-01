-- ============================================
-- Neon Auth Schema Setup
-- Recreates Supabase auth functions for RLS
-- ============================================

-- Create auth schema
CREATE SCHEMA IF NOT EXISTS auth;

-- Create helper functions that read from session variables
-- Your app will set these via: SET LOCAL app.current_user_id = 'uuid';

-- auth.uid() - Returns current user's UUID
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid;
$$;

-- auth.email() - Returns current user's email
CREATE OR REPLACE FUNCTION auth.email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_email', true), '');
$$;

-- auth.role() - Returns current user's role (authenticated/anon)
CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('app.current_user_role', true), ''), 'anon');
$$;

-- auth.jwt() - Returns JWT claims as JSON (for backward compatibility)
CREATE OR REPLACE FUNCTION auth.jwt()
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
-- Create roles for RLS (if they don't exist)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
END
$$;

-- Grant usage on public schema to roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================
-- Enable RLS on all tables
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.link_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_wiki ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_step_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_invoices ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS Policies for profiles
-- ============================================

CREATE POLICY "Public profiles are viewable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "profiles_self"
ON public.profiles
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================
-- RLS Policies for properties
-- ============================================

CREATE POLICY "Admins can delete properties"
ON public.properties FOR DELETE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::public.user_role
));

CREATE POLICY "Admins can insert properties"
ON public.properties FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::public.user_role
));

CREATE POLICY "Admins can update properties"
ON public.properties FOR UPDATE
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::public.user_role
));

CREATE POLICY "Approved brokers can view available properties"
ON public.properties FOR SELECT
TO authenticated
USING (
  (status = 'available'::public.property_status)
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.approval_status = 'approved'::public.approval_status
  )
);

-- ============================================
-- RLS Policies for clients
-- ============================================

CREATE POLICY "Admins can view all clients"
ON public.clients FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::public.user_role
));

CREATE POLICY "Brokers can insert own clients"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (broker_id = auth.uid());

CREATE POLICY "Brokers can update own clients"
ON public.clients FOR UPDATE
TO authenticated
USING (broker_id = auth.uid());

CREATE POLICY "Brokers can view own clients"
ON public.clients FOR SELECT
TO authenticated
USING (broker_id = auth.uid());

-- ============================================
-- RLS Policies for client_links
-- ============================================

CREATE POLICY "Admins can view all client links"
ON public.client_links FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::public.user_role
));

CREATE POLICY "Brokers can create own client links"
ON public.client_links FOR INSERT
TO authenticated
WITH CHECK (broker_id = auth.uid());

CREATE POLICY "Brokers can update own client links"
ON public.client_links FOR UPDATE
TO authenticated
USING (broker_id = auth.uid());

CREATE POLICY "Brokers can view own client links"
ON public.client_links FOR SELECT
TO authenticated
USING (broker_id = auth.uid());

-- ============================================
-- RLS Policies for link_analytics
-- ============================================

CREATE POLICY "Admins can view all analytics"
ON public.link_analytics FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::public.user_role
));

CREATE POLICY "Anyone can insert analytics (for tracking)"
ON public.link_analytics FOR INSERT
TO authenticated, anon
WITH CHECK (true);

CREATE POLICY "Brokers can view analytics for own links"
ON public.link_analytics FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.client_links
  WHERE client_links.id = link_analytics.link_id AND client_links.broker_id = auth.uid()
));

-- ============================================
-- RLS Policies for commissions
-- ============================================

CREATE POLICY "Admins can manage all commissions"
ON public.commissions
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::public.user_role
));

CREATE POLICY "Brokers can view own commissions"
ON public.commissions FOR SELECT
TO authenticated
USING (broker_id = auth.uid());

-- ============================================
-- RLS Policies for market_stats
-- ============================================

CREATE POLICY "Admins can manage market stats"
ON public.market_stats
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.profiles
  WHERE profiles.id = auth.uid() AND profiles.role = 'admin'::public.user_role
));

CREATE POLICY "Anyone can view active market stats"
ON public.market_stats FOR SELECT
TO authenticated, anon
USING (is_active = true);

-- ============================================
-- RLS Policies for property_favorites
-- ============================================

CREATE POLICY "Brokers can manage own favorites"
ON public.property_favorites
TO authenticated
USING (broker_id = auth.uid());

-- ============================================
-- RLS Policies for comments
-- ============================================

CREATE POLICY "comments_anon_select"
ON public.comments FOR SELECT
TO anon
USING (true);

CREATE POLICY "comments_anon_insert"
ON public.comments FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "comments_auth_select"
ON public.comments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "comments_auth_insert"
ON public.comments FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "comments_admin_update"
ON public.comments FOR UPDATE
TO authenticated
USING (auth.email() = 'captain-pavlos@outlook.com')
WITH CHECK (auth.email() = 'captain-pavlos@outlook.com');

CREATE POLICY "Admin can delete comments"
ON public.comments FOR DELETE
TO authenticated
USING ((auth.jwt() ->> 'email') = 'captain-pavlos@outlook.com');

-- ============================================
-- RLS Policies for company_wiki
-- ============================================

CREATE POLICY "company_wiki_select_all"
ON public.company_wiki FOR SELECT
USING (true);

CREATE POLICY "company_wiki_admin_insert"
ON public.company_wiki FOR INSERT
TO authenticated
WITH CHECK (auth.email() = 'captain-pavlos@outlook.com');

CREATE POLICY "company_wiki_admin_update"
ON public.company_wiki FOR UPDATE
TO authenticated
USING (auth.email() = 'captain-pavlos@outlook.com')
WITH CHECK (auth.email() = 'captain-pavlos@outlook.com');

-- ============================================
-- RLS Policies for processes
-- ============================================

CREATE POLICY "public_can_view_processes"
ON public.processes FOR SELECT
USING (true);

CREATE POLICY "processes_anon_read"
ON public.processes FOR SELECT
TO anon
USING (true);

CREATE POLICY "processes_admin_all"
ON public.processes
TO authenticated
USING (auth.email() = 'captain-pavlos@outlook.com')
WITH CHECK (auth.email() = 'captain-pavlos@outlook.com');

-- ============================================
-- RLS Policies for process_steps
-- ============================================

CREATE POLICY "public_can_view_process_steps"
ON public.process_steps FOR SELECT
USING (true);

CREATE POLICY "process_steps_anon_read"
ON public.process_steps FOR SELECT
TO anon
USING (true);

CREATE POLICY "process_steps_admin_all"
ON public.process_steps
TO authenticated
USING (auth.email() = 'captain-pavlos@outlook.com')
WITH CHECK (auth.email() = 'captain-pavlos@outlook.com');

-- ============================================
-- RLS Policies for process_transitions
-- ============================================

CREATE POLICY "public_can_view_process_transitions"
ON public.process_transitions FOR SELECT
USING (true);

CREATE POLICY "process_transitions_anon_read"
ON public.process_transitions FOR SELECT
TO anon
USING (true);

CREATE POLICY "process_transitions_admin_all"
ON public.process_transitions
TO authenticated
USING (auth.email() = 'captain-pavlos@outlook.com')
WITH CHECK (auth.email() = 'captain-pavlos@outlook.com');

-- ============================================
-- RLS Policies for projects
-- ============================================

CREATE POLICY "projects_select_all"
ON public.projects FOR SELECT
USING (true);

CREATE POLICY "projects_admin_insert"
ON public.projects FOR INSERT
TO authenticated
WITH CHECK (auth.email() = 'captain-pavlos@outlook.com');

CREATE POLICY "projects_admin_update"
ON public.projects FOR UPDATE
TO authenticated
USING (auth.email() = 'captain-pavlos@outlook.com')
WITH CHECK (auth.email() = 'captain-pavlos@outlook.com');

CREATE POLICY "admin can delete projects"
ON public.projects FOR DELETE
TO authenticated
USING ((auth.jwt() ->> 'email') = 'captain-pavlos@outlook.com');

CREATE POLICY "any user can move project steps"
ON public.projects FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- RLS Policies for project_step_comments
-- ============================================

CREATE POLICY "Authenticated can read project step comments"
ON public.project_step_comments FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated can insert project step comments"
ON public.project_step_comments FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authors can update their comments"
ON public.project_step_comments FOR UPDATE
USING (auth.role() = 'authenticated' AND created_by = auth.uid())
WITH CHECK (auth.role() = 'authenticated' AND created_by = auth.uid());

CREATE POLICY "Admin can delete project step comments"
ON public.project_step_comments FOR DELETE
TO authenticated
USING ((auth.jwt() ->> 'email') = 'captain-pavlos@outlook.com');

-- ============================================
-- RLS Policies for project_invoices
-- ============================================

CREATE POLICY "project_invoices_select_authenticated"
ON public.project_invoices FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "project_invoices_insert_authenticated"
ON public.project_invoices FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "project_invoices_update_admin"
ON public.project_invoices FOR UPDATE
USING ((auth.jwt() ->> 'email') = 'captain-pavlos@outlook.com')
WITH CHECK ((auth.jwt() ->> 'email') = 'captain-pavlos@outlook.com');

CREATE POLICY "project_invoices_delete_admin"
ON public.project_invoices FOR DELETE
USING ((auth.jwt() ->> 'email') = 'captain-pavlos@outlook.com');

-- ============================================
-- Done! 
-- ============================================
-- To use RLS in your app, set session variables before queries:
--
-- SET LOCAL app.current_user_id = 'user-uuid-here';
-- SET LOCAL app.current_user_email = 'user@example.com';
-- SET LOCAL app.current_user_role = 'authenticated';
--
-- Then run your queries - RLS will be enforced!
