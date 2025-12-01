-- ============================================
-- Neon Database Functions
-- Run this after the initial migration
-- ============================================

-- Add password_hash column to profiles if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'password_hash'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN password_hash text;
  END IF;
END
$$;

-- Function: get_project_overview
-- Returns all projects with their steps and comments
CREATE OR REPLACE FUNCTION public.get_project_overview() 
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'project', to_jsonb(p),
        'steps', (
          SELECT COALESCE(
            jsonb_agg(to_jsonb(s) ORDER BY s.order_index),
            '[]'::jsonb
          )
          FROM public.process_steps s
          WHERE s.process_id = p.process_id
        ),
        'comments', (
          SELECT COALESCE(
            jsonb_agg(to_jsonb(c) ORDER BY c.created_at DESC),
            '[]'::jsonb
          )
          FROM public.project_step_comments c
          WHERE c.project_id = p.id
        )
      )
      ORDER BY p.created_at DESC
    ),
    '[]'::jsonb
  )
  FROM public.projects p;
$$;

-- Function: insert_process_step_with_shift
-- Atomically inserts a step and shifts existing steps
CREATE OR REPLACE FUNCTION public.insert_process_step_with_shift(
  p_process_id uuid,
  p_title text,
  p_role text,
  p_order_index integer,
  p_description text,
  p_duration_days numeric,
  p_expected_step_count integer
) 
RETURNS public.process_steps
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_count integer;
  v_step public.process_steps%rowtype;
BEGIN
  -- Optimistic lock: check that the caller saw the same number of steps
  SELECT COUNT(*) INTO v_current_count
  FROM public.process_steps
  WHERE process_id = p_process_id;
  
  IF v_current_count <> p_expected_step_count THEN
    RAISE EXCEPTION 'Concurrent modification detected while inserting step for process %', p_process_id
    USING ERRCODE = 'P0004';
  END IF;

  -- Shift existing steps down by 1 at or after the desired order_index
  UPDATE public.process_steps
  SET order_index = order_index + 1
  WHERE process_id = p_process_id
    AND order_index >= p_order_index;
  
  -- Insert the new step
  INSERT INTO public.process_steps (
    process_id,
    title,
    role,
    order_index,
    description,
    duration_days
  )
  VALUES (
    p_process_id,
    p_title,
    p_role,
    p_order_index,
    p_description,
    p_duration_days
  )
  RETURNING * INTO v_step;

  RETURN v_step;
END;
$$;

-- Function: update_updated_at_column
-- Trigger function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column() 
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Function: generate_client_link_token
-- Generates a unique token for client links
CREATE OR REPLACE FUNCTION public.generate_client_link_token() 
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN encode(gen_random_bytes(16), 'hex');
END;
$$;

-- ============================================
-- Done!
-- ============================================
