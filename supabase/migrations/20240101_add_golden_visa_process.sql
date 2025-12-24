-- Insert Golden Visa Application Process
INSERT INTO public.processes (id, slug, name, description, owner_role, category, created_at) 
VALUES (
  gen_random_uuid(),
  'golden-visa-application',
  'Golden Visa Application',
  'Complete workflow for obtaining Greek Golden Visa through property investment',
  'PM',
  'immigration',
  NOW()
) ON CONFLICT (slug) DO NOTHING;

-- Get the process ID
DO $$
DECLARE
  golden_visa_process_id UUID;
BEGIN
  SELECT id INTO golden_visa_process_id FROM public.processes WHERE slug = 'golden-visa-application';
  
  -- Insert Process Steps
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
  (gen_random_uuid(), golden_visa_process_id, 'Visa Issuance', 'Receive Golden Visa approval and card', 'Lawyer', 11, 90, NOW())
  ON CONFLICT DO NOTHING;
  
  -- Insert Process Transitions
  INSERT INTO public.process_transitions (id, process_id, from_step_id, to_step_id, label, created_at, updated_at)
  SELECT 
    gen_random_uuid(),
    golden_visa_process_id,
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
  WHERE s1.process_id = golden_visa_process_id
  ON CONFLICT DO NOTHING;
END $$;
