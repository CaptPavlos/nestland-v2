-- Update existing processes and add steps

-- First, let's check and update the processes if they exist
UPDATE public.processes 
SET 
  name = CASE 
    WHEN slug = 'golden-visa-application' THEN 'Golden Visa Application'
    WHEN slug = 'property-management' THEN 'Property Management'
    WHEN slug = 'rent-new-listing' THEN 'Rent - New Listing'
    ELSE name
  END,
  description = CASE 
    WHEN slug = 'golden-visa-application' THEN 'Complete workflow for obtaining Greek Golden Visa through property investment'
    WHEN slug = 'property-management' THEN 'Long-term rental property management workflow'
    WHEN slug = 'rent-new-listing' THEN 'Complete workflow for renting out a new property listing'
    ELSE description
  END,
  owner_role = 'PM',
  category = CASE 
    WHEN slug = 'golden-visa-application' THEN 'immigration'
    WHEN slug = 'property-management' THEN 'property'
    WHEN slug = 'rent-new-listing' THEN 'rental'
    ELSE category
  END
WHERE slug IN ('golden-visa-application', 'property-management', 'rent-new-listing');

-- Insert processes if they don't exist
INSERT INTO public.processes (id, slug, name, description, owner_role, category, created_at) 
VALUES 
  (gen_random_uuid(), 'golden-visa-application', 'Golden Visa Application', 'Complete workflow for obtaining Greek Golden Visa through property investment', 'PM', 'immigration', NOW()),
  (gen_random_uuid(), 'property-management', 'Property Management', 'Long-term rental property management workflow', 'PM', 'property', NOW()),
  (gen_random_uuid(), 'rent-new-listing', 'Rent - New Listing', 'Complete workflow for renting out a new property listing', 'PM', 'rental', NOW())
ON CONFLICT (slug) DO NOTHING;

-- Clear existing steps to avoid duplicates
DELETE FROM public.process_steps WHERE process_id IN (
  SELECT id FROM public.processes WHERE slug IN ('golden-visa-application', 'property-management', 'rent-new-listing')
);

-- Clear existing transitions
DELETE FROM public.process_transitions WHERE process_id IN (
  SELECT id FROM public.processes WHERE slug IN ('golden-visa-application', 'property-management', 'rent-new-listing')
);

-- Insert Golden Visa Steps
DO $$
DECLARE
  golden_visa_process_id UUID;
BEGIN
  SELECT id INTO golden_visa_process_id FROM public.processes WHERE slug = 'golden-visa-application';
  
  IF golden_visa_process_id IS NOT NULL THEN
    INSERT INTO public.process_steps (id, process_id, title, description, role, order_index, duration_days, created_at) VALUES
    (gen_random_uuid(), golden_visa_process_id, 'Power of Attorney Preparation', 'Prepare POA with trusted lawyer in Greece or remotely with apostille', 'Lawyer', 1, 7, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Tax ID & Bank Account', 'Obtain Greek TAX ID and open bank account', 'Lawyer', 2, 7, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Private Purchase Agreement', 'Draft and sign private agreement with deposit terms', 'Lawyer', 3, 2, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Initial Deposit Payment', 'Pay €5,000 reservation deposit', 'Client', 4, 1, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Property Purchase Agreement', 'Sign private agreement, pay 10% of purchase price', 'Lawyer', 5, 2, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Second Payment', 'Pay 10% of purchase price', 'Client', 6, 1, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Document Preparation', 'Prepare all required documents for Golden Visa', 'Lawyer', 7, 21, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Final Payment & Contract', 'Pay remaining balance and sign final contract', 'Client', 8, 5, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Visa Application Submission', 'Submit complete application to authorities', 'Lawyer', 9, 7, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Biometric Appointment', 'Attend fingerprint and photo appointment', 'Client', 10, 1, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Visa Issuance', 'Receive Golden Visa approval and card', 'Lawyer', 11, 90, NOW());
  END IF;
END $$;

-- Insert Property Management Steps
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
    (gen_random_uuid(), property_mgmt_process_id, 'Building Relations', 'Attend community meetings', 'PM', 10, 1, NOW());
  END IF;
END $$;

-- Insert Rent - New Listing Steps
DO $$
DECLARE
  rent_listing_process_id UUID;
BEGIN
  SELECT id INTO rent_listing_process_id FROM public.processes WHERE slug = 'rent-new-listing';
  
  IF rent_listing_process_id IS NOT NULL THEN
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
    (gen_random_uuid(), rent_listing_process_id, 'Listing Closure', 'Mark property as rented', 'OPS', 12, 1, NOW());
  END IF;
END $$;

-- Insert transitions for all processes
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
