-- Comprehensive update of all three processes with detailed information

-- Clear existing steps and transitions
DELETE FROM public.process_transitions WHERE process_id IN (
  SELECT id FROM public.processes WHERE slug IN ('golden-visa-application', 'property-management', 'rent-new-listing')
);

DELETE FROM public.process_steps WHERE process_id IN (
  SELECT id FROM public.processes WHERE slug IN ('golden-visa-application', 'property-management', 'rent-new-listing')
);

-- Insert Golden Visa Steps with complete details
DO $$
DECLARE
  golden_visa_process_id UUID;
BEGIN
  SELECT id INTO golden_visa_process_id FROM public.processes WHERE slug = 'golden-visa-application';
  
  IF golden_visa_process_id IS NOT NULL THEN
    INSERT INTO public.process_steps (id, process_id, title, description, role, order_index, duration_days, created_at) VALUES
    (gen_random_uuid(), golden_visa_process_id, 'Power of Attorney Preparation', 'If client travels to Greece: POA drafted and signed at Greek Notary in 1 day. If remote: Draft POA locally, authenticate with Apostille, translate to English with Apostille, send originals to Athens, translate to Greek (up to 4 days). POA grants authority for TAX ID, bank account, property purchase, and Golden Visa submission.', 'OPS', 1, 7, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Tax ID & Bank Account', 'Obtain Greek TAX ID Number (mandatory for property purchases, requires POA & Passport) in 5-7 business days. Open Greek Bank Account for remote banking operations (up to 7 business days). Both handled by appointed lawyer through POA.', 'OPS', 2, 7, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Private Purchase Agreement', 'Private Agreement drafted detailing purchase terms and deposit requirements. Signed by lawyer under POA authority to protect client interests. Takes 1-2 days to prepare.', 'OPS', 3, 2, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Initial Deposit Payment', 'Pay €5,000 deposit to demonstrate commitment and reserve the apartment. Property taken off the market after this payment.', 'Client', 4, 1, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Property Purchase Agreement', 'Upon private agreement signature: Pay 10% of purchase price. Agreement signed by lawyer under POA. Second payment of 10% due by end of February as construction progresses.', 'Client', 5, 2, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Second Payment', 'Pay 10% of purchase price by end of February as construction progresses.', 'Client', 6, 1, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Document Preparation', 'Prepare required documents: Main applicant needs POA, passport, agreements, proofs, certifications, €2,060 fee, life insurance, birth certificate. Spouse needs additional documents. Minor children need specific documentation. Parents and in-laws have separate requirements. Takes 2-3 weeks.', 'OPS', 7, 21, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Final Payment & Contract', 'Transfer remaining balance to seller. Sign final contract. Receive essential documents from notary in 5-7 business days for Golden Visa application.', 'Client', 8, 5, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Visa Application Submission', 'Lawyer submits complete application for main investor and family members within 5-7 business days after receiving all documents.', 'OPS', 9, 7, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Biometric Appointment', 'Around 2-3 weeks after submission, receive invitation for biometric data collection. Client must provide fingerprints and photos for visa card issuance.', 'Client', 10, 1, NOW()),
    (gen_random_uuid(), golden_visa_process_id, 'Visa Issuance', 'After biometrics, visa processing takes 3-12 months. Lawyer monitors progress. Once issued, lawyer can collect visa or client can pick up in person. Client enjoys visa-free travel in Europe.', 'OPS', 11, 90, NOW());
  END IF;
END $$;

-- Insert Property Management Steps with correct roles and details
DO $$
DECLARE
  property_mgmt_process_id UUID;
BEGIN
  SELECT id INTO property_mgmt_process_id FROM public.processes WHERE slug = 'property-management';
  
  IF property_mgmt_process_id IS NOT NULL THEN
    INSERT INTO public.process_steps (id, process_id, title, description, role, order_index, duration_days, created_at) VALUES
    (gen_random_uuid(), property_mgmt_process_id, 'Client Request', 'Client shares request to take on property for management. Contact methods: direct to Johan (existing GV clients), email, phone, or website. Provide property address and photos if available.', 'Client', 1, 1, NOW()),
    (gen_random_uuid(), property_mgmt_process_id, 'Property Evaluation', 'Arrange visit to see property and decide if we want to take it on. Assess condition, rental potential, and suitability.', 'OPS', 2, 2, NOW()),
    (gen_random_uuid(), property_mgmt_process_id, 'Agreement Preparation', 'Send property management agreement draft showing terms, conditions, and service cost (15% of annual rents plus VAT). Detail all included services.', 'OPS', 3, 1, NOW()),
    (gen_random_uuid(), property_mgmt_process_id, 'Contract Signing', 'Both parties sign agreement. Client pays initial management fee at signing. Invoice sent with bank details. Client brings keys to office or we send someone to collect them.', 'OPS', 4, 2, NOW()),
    (gen_random_uuid(), property_mgmt_process_id, 'Key Handover', 'Collect property keys from client. Keys either delivered to office or collected by team member.', 'OPS', 5, 1, NOW()),
    (gen_random_uuid(), property_mgmt_process_id, 'Management Activation - Rented Property', 'If apartment already rented to tenant, begin property management immediately.', 'OPS', 6, 1, NOW()),
    (gen_random_uuid(), property_mgmt_process_id, 'Management Activation - Empty Property', 'If apartment is empty, go through step-by-step process of renting an apartment as agents/finding tenant process.', 'OPS', 7, 1, NOW()),
    (gen_random_uuid(), property_mgmt_process_id, 'Ongoing Management', 'Handle all property management duties: maintenance, tenant relations, rent collection, financial reporting, building relations, legal compliance. This is a continuous service.', 'OPS', 8, 30, NOW());
  END IF;
END $$;

-- Insert Rent - New Listing Steps with optional steps and complete details
DO $$
DECLARE
  rent_listing_process_id UUID;
BEGIN
  SELECT id INTO rent_listing_process_id FROM public.processes WHERE slug = 'rent-new-listing';
  
  IF rent_listing_process_id IS NOT NULL THEN
    INSERT INTO public.process_steps (id, process_id, title, description, role, order_index, duration_days, created_at) VALUES
    (gen_random_uuid(), rent_listing_process_id, 'Client Inquiry', 'Homeowner reaches out via website, phone, email, or reference to inquire about renting out property through agency.', 'Broker', 1, 1, NOW()),
    (gen_random_uuid(), rent_listing_process_id, 'Pre-Listing Requirements', 'Send email with pre-listing requirements including floor plan, location, pictures. Inform about agency fee (one month rent + VAT). Send listing agreement for legal authorization.', 'Broker', 2, 2, NOW()),
    (gen_random_uuid(), rent_listing_process_id, 'Initial Meeting', 'If interested in property, arrange meeting with client. Sales team creates photo record or offers paid professional photoshoot.', 'Broker', 3, 3, NOW()),
    (gen_random_uuid(), rent_listing_process_id, '(Optional) Professional Photoshoot', 'Arrange professional photoshoot for property if needed. Create online listing on website, Spitogatos, Xrysi Eukeria, and other channels.', 'OPS', 4, 2, NOW()),
    (gen_random_uuid(), rent_listing_process_id, 'Receiving Tenant Inquiries', 'Start receiving inquiries from potential tenants. Sales team or agent arranges viewings with interested parties.', 'Broker', 5, 7, NOW()),
    (gen_random_uuid(), rent_listing_process_id, 'Property Viewings', 'Agent attends property viewings, shares listing agreement with interested tenants. Viewers fill information and agree to pay agency commission (one month rent + VAT).', 'Broker', 6, 7, NOW()),
    (gen_random_uuid(), rent_listing_process_id, 'Rental Agreement Drafting', 'Once tenant confirms interest, draft rental agreement. Send to both homeowner and tenant for signatures.', 'OPS', 7, 3, NOW()),
    (gen_random_uuid(), rent_listing_process_id, 'Payment and Confirmation', 'Upon signing, tenant pays security deposit, first month rent, and agency fee. Send invoices to both homeowner and tenant after all payments completed.', 'Broker', 8, 2, NOW()),
    (gen_random_uuid(), rent_listing_process_id, 'Listing Removal', 'Once property is rented, delete listing or mark as "rented"/"not available" on advertising channels.', 'OPS', 9, 1, NOW()),
    (gen_random_uuid(), rent_listing_process_id, 'Handover', 'Coordinate property handover to tenant, document condition, provide keys, establish communication channels.', 'OPS', 10, 1, NOW());
  END IF;
END $$;

-- Re-insert transitions for all processes
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
    WHEN s1.order_index = 7 THEN 'Tenant Search'
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
    WHEN s1.order_index = 8 THEN 'Contract Signed'
    WHEN s1.order_index = 9 THEN 'Payments Collected'
    ELSE 'Complete'
  END,
  NOW()
FROM public.process_steps s1
JOIN public.process_steps s2 ON s1.process_id = s2.process_id AND s1.order_index = s2.order_index - 1
WHERE s1.process_id IN (SELECT id FROM public.processes WHERE slug = 'rent-new-listing')
ON CONFLICT DO NOTHING;
