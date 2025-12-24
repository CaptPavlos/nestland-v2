-- Update roles in all three processes to use correct system roles

-- Clear existing steps and transitions for all three processes
DELETE FROM public.process_transitions WHERE process_id IN (
  SELECT id FROM public.processes WHERE slug IN ('golden-visa-application', 'property-management', 'rent-new-listing')
);

DELETE FROM public.process_steps WHERE process_id IN (
  SELECT id FROM public.processes WHERE slug IN ('golden-visa-application', 'property-management', 'rent-new-listing')
);

-- Insert Golden Visa Steps with correct roles
DO $$
DECLARE
  golden_visa_process_id UUID;
BEGIN
  SELECT id INTO golden_visa_process_id FROM public.processes WHERE slug = 'golden-visa-application';
  
  IF golden_visa_process_id IS NOT NULL THEN
    INSERT INTO public.process_steps (id, process_id, title, description, role, order_index, duration_days, created_at) VALUES
    (gen_random_uuid(), golden_visa_process_id, 'Power of Attorney Preparation', 'Prepare POA with in-house lawyer or remotely with apostille', 'OPS', 1, 7, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Tax ID & Bank Account', 'Obtain Greek TAX ID and open bank account through OPS', 'OPS', 2, 7, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Private Purchase Agreement', 'Draft and sign private agreement with deposit terms (in-house lawyer)', 'OPS', 3, 2, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Initial Deposit Payment', 'Pay €5,000 reservation deposit', 'Client', 4, 1, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Property Purchase Agreement', 'Sign private agreement, pay 10% of purchase price', 'Client', 5, 2, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Second Payment', 'Pay 10% of purchase price', 'Client', 6, 1, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Document Preparation', 'Prepare all required documents for Golden Visa (OPS coordinates)', 'OPS', 7, 21, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Final Payment & Contract', 'Pay remaining balance and sign final contract with notary', 'Client', 8, 5, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Visa Application Submission', 'Submit complete application to authorities (OPS handles)', 'OPS', 9, 7, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Biometric Appointment', 'Attend fingerprint and photo appointment', 'Client', 10, 1, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Visa Issuance', 'Receive Golden Visa approval and card (OPS collects)', 'OPS', 11, 90, NOW());
  END IF;
END $$;

-- Insert Property Management Steps with correct roles
DO $$
DECLARE
  property_mgmt_process_id UUID;
BEGIN
  SELECT id INTO property_mgmt_process_id FROM public.processes WHERE slug = 'property-management';
  
  IF property_mgmt_process_id IS NOT NULL THEN
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
    (gen_random_uuid(), property_mgmt_process_id, 'Building Relations', 'Attend community meetings', 'OPS', 10, 1, NOW());
  END IF;
END $$;

-- Insert Rent - New Listing Steps with correct roles
DO $$
DECLARE
  rent_listing_process_id UUID;
BEGIN
  SELECT id INTO rent_listing_process_id FROM public.processes WHERE slug = 'rent-new-listing';
  
  IF rent_listing_process_id IS NOT NULL THEN
    INSERT INTO public.process_steps (id, process_id, title, description, role, order_index, duration_days, created_at) VALUES
    (gen_random_uuid(), rent_listing_process_id, 'Client Inquiry', 'Homeowner contacts agency to rent property', 'Broker', 1, 1, NOW()),
    (gen_random_uuid(), rent_listing_process_id, 'Pre-Listing Requirements', 'Send requirements and listing agreement', 'Broker', 2, 2, NOW()),
    (gen_random_uuid(), rent_listing_process_id, 'Property Visit', 'Assess property and take photos', 'Broker', 3, 3, NOW()),
    (gen_random_uuid(), rent_listing_process_id, 'Photography & Marketing', 'Professional photos and listing creation', 'OPS', 4, 2, NOW()),
    (gen_random_uuid(), rent_listing_process_id, 'Publish Listings', 'Post on all advertising channels', 'OPS', 5, 1, NOW()),
    (gen_random_uuid(), rent_listing_process_id, 'Tenant Inquiries', 'Handle incoming tenant requests', 'Broker', 6, 7, NOW()),
    (gen_random_uuid(), rent_listing_process_id, 'Property Viewings', 'Schedule and conduct viewings', 'Broker', 7, 7, NOW()),
    (gen_random_uuid(), rent_listing_process_id, 'Tenant Selection', 'Choose qualified tenant', 'Broker', 8, 2, NOW()),
    (gen_random_uuid(), rent_listing_process_id, 'Rental Agreement', 'Draft and sign rental contract (in-house lawyer)', 'OPS', 9, 3, NOW()),
    (gen_random_uuid(), rent_listing_process_id, 'Payment Collection', 'Collect deposit, rent, and fees', 'PM', 10, 2, NOW()),
    (gen_random_uuid(), rent_listing_process_id, 'Property Handover', 'Give keys to tenant', 'OPS', 11, 1, NOW()),
    (gen_random_uuid(), rent_listing_process_id, 'Listing Closure', 'Mark property as rented', 'OPS', 12, 1, NOW());
  END IF;
END $$;

-- Re-insert transitions for all processes (same as before but without updated_at)
INSERT INTO public.process_transitions (id, process_id, from_step_id, to_step_id, label, created_at)
SELECT 
  gen_random_uuid(),
  s1.process_id,
  s1.id,
  s2.id,
  CASE 
    WHEN s1.order_index = 1 THEN 'POA Ready'
    WHEN s1.order_index = 2 THEN 'Bank Ready'
    WHEN s1.order_index = 3 THEN 'Agreement Ready'
    WHEN s1.order_index = 4 THEN 'Deposit Paid'
    WHEN s1.order_index = 5 THEN 'Agreement Signed'
    WHEN s1.order_index = 6 THEN 'Second Payment'
    WHEN s1.order_index = 7 THEN 'Documents Ready'
    WHEN s1.order_index = 8 THEN 'Contract Complete'
    WHEN s1.order_index = 9 THEN 'Application Submitted'
    WHEN s1.order_index = 10 THEN 'Biometrics Done'
    ELSE 'Complete'
  END,
  NOW()
FROM public.process_steps s1
JOIN public.process_steps s2 ON s1.process_id = s2.process_id AND s1.order_index = s2.order_index - 1
WHERE s1.process_id IN (SELECT id FROM public.processes WHERE slug = 'golden-visa-application')
ON CONFLICT DO NOTHING;

INSERT INTO public.process_transitions (id, process_id, from_step_id, to_step_id, label, created_at)
SELECT 
  gen_random_uuid(),
  s1.process_id,
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
WHERE s1.process_id IN (SELECT id FROM public.processes WHERE slug = 'property-management')
ON CONFLICT DO NOTHING;

INSERT INTO public.process_transitions (id, process_id, from_step_id, to_step_id, label, created_at)
SELECT 
  gen_random_uuid(),
  s1.process_id,
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
WHERE s1.process_id IN (SELECT id FROM public.processes WHERE slug = 'rent-new-listing')
ON CONFLICT DO NOTHING;
