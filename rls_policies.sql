CREATE POLICY "Admin can delete comments" ON public.comments FOR DELETE TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'captain-pavlos@outlook.com'::text));


--
-- Name: project_step_comments Admin can delete comments; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY "Admin can delete comments" ON public.project_step_comments FOR DELETE TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'captain-pavlos@outlook.com'::text));


--
-- Name: properties Admins can delete properties; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY "Admins can delete properties" ON public.properties FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
--
CREATE POLICY "Admins can insert properties" ON public.properties FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
--
CREATE POLICY "Admins can manage all commissions" ON public.commissions TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
--
CREATE POLICY "Admins can manage market stats" ON public.market_stats TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
--
CREATE POLICY "Admins can update properties" ON public.properties FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
--
CREATE POLICY "Admins can view all analytics" ON public.link_analytics FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
--
CREATE POLICY "Admins can view all client links" ON public.client_links FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
--
CREATE POLICY "Admins can view all clients" ON public.clients FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::public.user_role)))));


--
--
CREATE POLICY "Anyone can insert analytics (for tracking)" ON public.link_analytics FOR INSERT TO authenticated, anon WITH CHECK (true);


--
-- Name: market_stats Anyone can view active market stats; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY "Anyone can view active market stats" ON public.market_stats FOR SELECT TO authenticated, anon USING ((is_active = true));


--
-- Name: properties Approved brokers can view available properties; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY "Approved brokers can view available properties" ON public.properties FOR SELECT TO authenticated USING (((status = 'available'::public.property_status) AND (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.approval_status = 'approved'::public.approval_status))))));


--
--
CREATE POLICY "Authenticated can insert project step comments" ON public.project_step_comments FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: project_step_comments Authenticated can read project step comments; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY "Authenticated can read project step comments" ON public.project_step_comments FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: project_step_comments Authors can update their comments; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY "Authors can update their comments" ON public.project_step_comments FOR UPDATE USING (((auth.role() = 'authenticated'::text) AND (created_by = auth.uid()))) WITH CHECK (((auth.role() = 'authenticated'::text) AND (created_by = auth.uid())));


--
-- Name: client_links Brokers can create own client links; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY "Brokers can create own client links" ON public.client_links FOR INSERT TO authenticated WITH CHECK ((broker_id = auth.uid()));


--
-- Name: clients Brokers can insert own clients; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY "Brokers can insert own clients" ON public.clients FOR INSERT TO authenticated WITH CHECK ((broker_id = auth.uid()));


--
-- Name: property_favorites Brokers can manage own favorites; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY "Brokers can manage own favorites" ON public.property_favorites TO authenticated USING ((broker_id = auth.uid()));


--
-- Name: client_links Brokers can update own client links; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY "Brokers can update own client links" ON public.client_links FOR UPDATE TO authenticated USING ((broker_id = auth.uid()));


--
-- Name: clients Brokers can update own clients; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY "Brokers can update own clients" ON public.clients FOR UPDATE TO authenticated USING ((broker_id = auth.uid()));


--
-- Name: link_analytics Brokers can view analytics for own links; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY "Brokers can view analytics for own links" ON public.link_analytics FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.client_links
  WHERE ((client_links.id = link_analytics.link_id) AND (client_links.broker_id = auth.uid())))));


--
--
CREATE POLICY "Brokers can view own client links" ON public.client_links FOR SELECT TO authenticated USING ((broker_id = auth.uid()));


--
-- Name: clients Brokers can view own clients; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY "Brokers can view own clients" ON public.clients FOR SELECT TO authenticated USING ((broker_id = auth.uid()));


--
-- Name: commissions Brokers can view own commissions; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY "Brokers can view own commissions" ON public.commissions FOR SELECT TO authenticated USING ((broker_id = auth.uid()));


--
-- Name: profiles Public profiles are viewable by authenticated users; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY "Public profiles are viewable by authenticated users" ON public.profiles FOR SELECT TO authenticated USING (true);


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));


--
-- Name: projects admin can delete projects; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY "admin can delete projects" ON public.projects FOR DELETE TO authenticated USING (((auth.jwt() ->> 'email'::text) = 'captain-pavlos@outlook.com'::text));


--
-- Name: projects any user can move project steps; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY "any user can move project steps" ON public.projects FOR UPDATE TO authenticated USING (true) WITH CHECK (true);


--
-- Name: client_links; Type: ROW SECURITY; Schema: public; Owner: postgres
--
--
CREATE POLICY comments_admin_update ON public.comments FOR UPDATE TO authenticated USING ((auth.email() = 'captain-pavlos@outlook.com'::text)) WITH CHECK ((auth.email() = 'captain-pavlos@outlook.com'::text));


--
-- Name: comments comments_anon_insert; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY comments_anon_insert ON public.comments FOR INSERT TO anon WITH CHECK (true);


--
-- Name: comments comments_anon_select; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY comments_anon_select ON public.comments FOR SELECT TO anon USING (true);


--
-- Name: comments comments_auth_insert; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY comments_auth_insert ON public.comments FOR INSERT TO authenticated WITH CHECK (true);


--
-- Name: comments comments_auth_select; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY comments_auth_select ON public.comments FOR SELECT TO authenticated USING (true);


--
-- Name: commissions; Type: ROW SECURITY; Schema: public; Owner: postgres
--
--
CREATE POLICY company_wiki_admin_insert ON public.company_wiki FOR INSERT TO authenticated WITH CHECK ((auth.email() = 'captain-pavlos@outlook.com'::text));


--
-- Name: company_wiki company_wiki_admin_update; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY company_wiki_admin_update ON public.company_wiki FOR UPDATE TO authenticated USING ((auth.email() = 'captain-pavlos@outlook.com'::text)) WITH CHECK ((auth.email() = 'captain-pavlos@outlook.com'::text));


--
-- Name: company_wiki company_wiki_select_all; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY company_wiki_select_all ON public.company_wiki FOR SELECT USING (true);


--
-- Name: link_analytics; Type: ROW SECURITY; Schema: public; Owner: postgres
--
--
CREATE POLICY process_steps_admin_all ON public.process_steps TO authenticated USING ((auth.email() = 'captain-pavlos@outlook.com'::text)) WITH CHECK ((auth.email() = 'captain-pavlos@outlook.com'::text));


--
-- Name: process_steps process_steps_anon_read; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY process_steps_anon_read ON public.process_steps FOR SELECT TO anon USING (true);


--
-- Name: process_transitions; Type: ROW SECURITY; Schema: public; Owner: postgres
--
--
CREATE POLICY process_transitions_admin_all ON public.process_transitions TO authenticated USING ((auth.email() = 'captain-pavlos@outlook.com'::text)) WITH CHECK ((auth.email() = 'captain-pavlos@outlook.com'::text));


--
-- Name: process_transitions process_transitions_anon_read; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY process_transitions_anon_read ON public.process_transitions FOR SELECT TO anon USING (true);


--
-- Name: processes; Type: ROW SECURITY; Schema: public; Owner: postgres
--
--
CREATE POLICY processes_admin_all ON public.processes TO authenticated USING ((auth.email() = 'captain-pavlos@outlook.com'::text)) WITH CHECK ((auth.email() = 'captain-pavlos@outlook.com'::text));


--
-- Name: processes processes_anon_read; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY processes_anon_read ON public.processes FOR SELECT TO anon USING (true);


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: postgres
--
--
CREATE POLICY profiles_self ON public.profiles TO authenticated USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: project_invoices; Type: ROW SECURITY; Schema: public; Owner: postgres
--
--
CREATE POLICY project_invoices_delete_admin ON public.project_invoices FOR DELETE USING (((auth.jwt() ->> 'email'::text) = 'captain-pavlos@outlook.com'::text));


--
-- Name: project_invoices project_invoices_insert_authenticated; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY project_invoices_insert_authenticated ON public.project_invoices FOR INSERT WITH CHECK ((auth.role() = 'authenticated'::text));


--
-- Name: project_invoices project_invoices_select_authenticated; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY project_invoices_select_authenticated ON public.project_invoices FOR SELECT USING ((auth.role() = 'authenticated'::text));


--
-- Name: project_invoices project_invoices_update_admin; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY project_invoices_update_admin ON public.project_invoices FOR UPDATE USING (((auth.jwt() ->> 'email'::text) = 'captain-pavlos@outlook.com'::text)) WITH CHECK (((auth.jwt() ->> 'email'::text) = 'captain-pavlos@outlook.com'::text));


--
-- Name: project_step_comments; Type: ROW SECURITY; Schema: public; Owner: postgres
--
--
CREATE POLICY projects_admin_insert ON public.projects FOR INSERT TO authenticated WITH CHECK ((auth.email() = 'captain-pavlos@outlook.com'::text));


--
-- Name: projects projects_admin_update; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY projects_admin_update ON public.projects FOR UPDATE TO authenticated USING ((auth.email() = 'captain-pavlos@outlook.com'::text)) WITH CHECK ((auth.email() = 'captain-pavlos@outlook.com'::text));


--
-- Name: projects projects_select_all; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY projects_select_all ON public.projects FOR SELECT USING (true);


--
-- Name: properties; Type: ROW SECURITY; Schema: public; Owner: postgres
--
--
CREATE POLICY public_can_view_process_steps ON public.process_steps FOR SELECT USING (true);


--
-- Name: process_transitions public_can_view_process_transitions; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY public_can_view_process_transitions ON public.process_transitions FOR SELECT USING (true);


--
-- Name: processes public_can_view_processes; Type: POLICY; Schema: public; Owner: postgres
--
--
CREATE POLICY public_can_view_processes ON public.processes FOR SELECT USING (true);


--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: supabase_realtime_admin
--
--
CREATE POLICY project_files_delete_admin ON storage.objects FOR DELETE USING (((bucket_id = 'project-files'::text) AND ((auth.jwt() ->> 'email'::text) = 'captain-pavlos@outlook.com'::text)));


--
-- Name: objects project_files_insert_authenticated; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--
--
CREATE POLICY project_files_insert_authenticated ON storage.objects FOR INSERT WITH CHECK (((bucket_id = 'project-files'::text) AND (auth.role() = 'authenticated'::text) AND (name ~~ 'projects/%'::text)));


--
-- Name: objects project_files_select_authenticated; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--
--
CREATE POLICY project_files_select_authenticated ON storage.objects FOR SELECT USING (((bucket_id = 'project-files'::text) AND (auth.role() = 'authenticated'::text) AND (name ~~ 'projects/%'::text)));


--
-- Name: objects project_files_update_authenticated; Type: POLICY; Schema: storage; Owner: supabase_storage_admin
--
--
CREATE POLICY project_files_update_authenticated ON storage.objects FOR UPDATE USING (((bucket_id = 'project-files'::text) AND (auth.role() = 'authenticated'::text) AND (name ~~ 'projects/%'::text))) WITH CHECK (((bucket_id = 'project-files'::text) AND (auth.role() = 'authenticated'::text) AND (name ~~ 'projects/%'::text)));


--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: supabase_storage_admin
--
