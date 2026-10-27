-- ============================================================================
-- AUTOSPHERE USED CAR DEALERSHIP - ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Execute this script in your Supabase Project -> SQL Editor after schema.sql
-- Strictly protects inventory, roles, and media against unauthorized access.

-- ----------------------------------------------------------------------------
-- 1. HELPER FUNCTION: CHECK IF CURRENT REQUESTER IS AN ADMINISTRATOR
-- Cached security definer function to avoid infinite recursion in RLS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check JWT metadata claims first (instant, zero table query)
    IF (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin') OR 
       (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin') THEN
        RETURN TRUE;
    END IF;

    -- Query public.profiles directly
    SELECT role INTO user_role
    FROM public.profiles
    WHERE id = auth.uid();

    RETURN (lower(COALESCE(user_role, '')) = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

-- ----------------------------------------------------------------------------
-- 2. ENABLE ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_images ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. PROFILES POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile non-role fields" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

-- Allow users to view their own profile (NO recursion)
CREATE POLICY "Users can read own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Allow admins to view all user profiles
CREATE POLICY "Admins can read all profiles"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
        OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
        OR (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
    );

-- Allow users to update their own profile (name, phone), but NOT alter their role
CREATE POLICY "Users can update own profile non-role fields"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid() 
        AND lower(role) = (SELECT lower(p.role) FROM public.profiles p WHERE p.id = auth.uid())
    );

-- ----------------------------------------------------------------------------
-- 4. CARS POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view all published cars" ON public.cars;
DROP POLICY IF EXISTS "Admins can insert cars" ON public.cars;
DROP POLICY IF EXISTS "Admins can update cars" ON public.cars;
DROP POLICY IF EXISTS "Admins can delete cars" ON public.cars;

-- Anyone (unauthenticated and authenticated customers) can view cars
CREATE POLICY "Public can view all published cars"
    ON public.cars
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Only admins can add new cars to the inventory
CREATE POLICY "Admins can insert cars"
    ON public.cars
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin')
    );

-- Only admins can modify car details, change status, or update pricing
CREATE POLICY "Admins can update cars"
    ON public.cars
    FOR UPDATE
    TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin')
    )
    WITH CHECK (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin')
    );

-- Only admins can delete cars
CREATE POLICY "Admins can delete cars"
    ON public.cars
    FOR DELETE
    TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin')
    );

-- ----------------------------------------------------------------------------
-- 5. CAR IMAGES POLICIES
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Public can view all car images" ON public.car_images;
DROP POLICY IF EXISTS "Admins can insert car images" ON public.car_images;
DROP POLICY IF EXISTS "Admins can update car images" ON public.car_images;
DROP POLICY IF EXISTS "Admins can delete car images" ON public.car_images;

CREATE POLICY "Public can view all car images"
    ON public.car_images
    FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Admins can insert car images"
    ON public.car_images
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin')
    );

CREATE POLICY "Admins can update car images"
    ON public.car_images
    FOR UPDATE
    TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin')
    )
    WITH CHECK (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin')
    );

CREATE POLICY "Admins can delete car images"
    ON public.car_images
    FOR DELETE
    TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin')
    );

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
