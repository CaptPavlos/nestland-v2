-- Insert Property Management Process
INSERT INTO public.processes (id, slug, name, description, owner_role, category, created_at) 
VALUES (
  gen_random_uuid(),
  'property-management',
  'Property Management',
  'Long-term rental property management workflow',
  'PM',
  'property',
  NOW()
) ON CONFLICT (slug) DO NOTHING;

-- Get the process ID
DO $$
DECLARE
  property_mgmt_process_id UUID;
BEGIN
  SELECT id INTO property_mgmt_process_id FROM public.processes WHERE slug = 'property-management';
  
  -- Insert Process Steps
  INSERT INTO public.process_steps (id, process_id, title, description, role, order_index, duration_days, created_at) VALUES
  (gen_random_uuid(), property_mgmt_process_id, 'Client Request', 'Client submits property management request', 'PM', 1, 1, NOW()),
  (gen_random_uuid(), property_mgmt_process_id, 'Property Evaluation', 'Visit and assess property condition', 'OPS', 2, 2, NOW()),
  (gen_random_uuid(), property_mgmt_process_id, 'Agreement Preparation', 'Send management agreement draft', 'PM', 3, 1, NOW()),
  (gen_random_uuid(), property_mgmt_process_id, 'Contract Signing', 'Sign agreement and collect initial fee', 'PM', 4, 2, NOW()),
  (gen_random_uuid(), property_mgmt_process_id, 'Key Handover', 'Collect property keys', 'OPS', 5, 1, NOW()),
  (gen_random_uuid(), property_mgmt_process_id, 'Management Activation', 'Begin active property management', 'OPS', 6, 1, NOW()),
  (gen_random_uuid(), property_mgmt_process_id, 'Tenant Management', 'Handle tenant relations and issues', 'OPS', 7, 30, NOW()),
  (gen_random_uuid(), property_mgmt_process_id, 'Maintenance Coordination', 'Coordinate repairs and maintenance', 'OPS', 8, 7, NOW()),
  (gen_random_uuid(), property_mgmt_process_id, 'Financial Reporting', 'Monthly reports to owner', 'PM', 9, 1, NOW()),
  (gen_random_uuid(), property_mgmt_process_id, 'Building Relations', 'Attend community meetings', 'PM', 10, 1, NOW())
  ON CONFLICT DO NOTHING;
  
  -- Insert Process Transitions
  INSERT INTO public.process_transitions (id, process_id, from_step_id, to_step_id, label, created_at, updated_at)
  SELECT 
    gen_random_uuid(),
    property_mgmt_process_id,
    s1.id,
    s2.id,
    CASE 
      WHEN s1.order_index = 1 THEN 'Request Received'
      WHEN s1.order_index = 2 THEN 'Property Approved'
      WHEN s1.order_index = 3 THEN 'Terms Sent'
      WHEN s1.order_index = 4 THEN 'Contract Active'
      WHEN s1.order_index = 5 THEN 'Keys Received'
      WHEN s1.order_index = 6 THEN 'Management Started'
      WHEN s1.order_index = 7 THEN 'Tenants Managed'
      WHEN s1.order_index = 8 THEN 'Maintenance Done'
      WHEN s1.order_index = 9 THEN 'Report Sent'
      ELSE 'Ongoing'
    END,
    NOW()
  FROM public.process_steps s1
  JOIN public.process_steps s2 ON s1.process_id = s2.process_id AND s1.order_index = s2.order_index - 1
  WHERE s1.process_id = property_mgmt_process_id
  ON CONFLICT DO NOTHING;
END $$;
