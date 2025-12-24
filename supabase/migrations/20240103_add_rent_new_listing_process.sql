-- Insert Rent - New Listing Process
INSERT INTO public.processes (id, slug, name, description, owner_role, category, created_at) 
VALUES (
  gen_random_uuid(),
  'rent-new-listing',
  'Rent - New Listing',
  'Complete workflow for renting out a new property listing',
  'PM',
  'rental',
  NOW()
) ON CONFLICT (slug) DO NOTHING;

-- Get the process ID
DO $$
DECLARE
  rent_listing_process_id UUID;
BEGIN
  SELECT id INTO rent_listing_process_id FROM public.processes WHERE slug = 'rent-new-listing';
  
  -- Insert Process Steps
  INSERT INTO public.process_steps (id, process_id, title, description, role, order_index, duration_days, created_at) VALUES
  (gen_random_uuid(), rent_listing_process_id, 'Client Inquiry', 'Homeowner contacts agency to rent property', 'PM', 1, 1, NOW()),
  (gen_random_uuid(), rent_listing_process_id, 'Pre-Listing Requirements', 'Send requirements and listing agreement', 'PM', 2, 2, NOW()),
  (gen_random_uuid(), rent_listing_process_id, 'Property Visit', 'Assess property and take photos', 'OPS', 3, 3, NOW()),
  (gen_random_uuid(), rent_listing_process_id, 'Photography & Marketing', 'Professional photos and listing creation', 'OPS', 4, 2, NOW()),
  (gen_random_uuid(), rent_listing_process_id, 'Publish Listings', 'Post on all advertising channels', 'OPS', 5, 1, NOW()),
  (gen_random_uuid(), rent_listing_process_id, 'Tenant Inquiries', 'Handle incoming tenant requests', 'PM', 6, 7, NOW()),
  (gen_random_uuid(), rent_listing_process_id, 'Property Viewings', 'Schedule and conduct viewings', 'OPS', 7, 7, NOW()),
  (gen_random_uuid(), rent_listing_process_id, 'Tenant Selection', 'Choose qualified tenant', 'PM', 8, 2, NOW()),
  (gen_random_uuid(), rent_listing_process_id, 'Rental Agreement', 'Draft and sign rental contract', 'Lawyer', 9, 3, NOW()),
  (gen_random_uuid(), rent_listing_process_id, 'Payment Collection', 'Collect deposit, rent, and fees', 'PM', 10, 2, NOW()),
  (gen_random_uuid(), rent_listing_process_id, 'Property Handover', 'Give keys to tenant', 'OPS', 11, 1, NOW()),
  (gen_random_uuid(), rent_listing_process_id, 'Listing Closure', 'Mark property as rented', 'OPS', 12, 1, NOW())
  ON CONFLICT DO NOTHING;
  
  -- Insert Process Transitions
  INSERT INTO public.process_transitions (id, process_id, from_step_id, to_step_id, label, created_at, updated_at)
  SELECT 
    gen_random_uuid(),
    rent_listing_process_id,
    s1.id,
    s2.id,
    CASE 
      WHEN s1.order_index = 1 THEN 'Contact Made'
      WHEN s1.order_index = 2 THEN 'Requirements Sent'
      WHEN s1.order_index = 3 THEN 'Property Approved'
      WHEN s1.order_index = 4 THEN 'Marketing Ready'
      WHEN s1.order_index = 5 THEN 'Listed Online'
      WHEN s1.order_index = 6 THEN 'Inquiries Received'
      WHEN s1.order_index = 7 THEN 'Viewings Done'
      WHEN s1.order_index = 8 THEN 'Tenant Selected'
      WHEN s1.order_index = 9 THEN 'Contract Signed'
      WHEN s1.order_index = 10 THEN 'Payments Collected'
      WHEN s1.order_index = 11 THEN 'Keys Handed'
      ELSE 'Complete'
    END,
    NOW()
  FROM public.process_steps s1
  JOIN public.process_steps s2 ON s1.process_id = s2.process_id AND s1.order_index = s2.order_index - 1
  WHERE s1.process_id = rent_listing_process_id
  ON CONFLICT DO NOTHING;
END $$;
