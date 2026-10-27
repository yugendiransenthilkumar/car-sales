-- ============================================================================
-- AUTOSPHERE - 1-CLICK SUPABASE RLS RECURSION FIX SCRIPT
-- ============================================================================
-- Run this script in your Supabase Project -> SQL Editor.
-- It eliminates the recursive RLS loop on public.profiles that blocked UPDATE/INSERT/DELETE.
-- ============================================================================

-- 1. Helper function: is_admin() (Non-recursive and case-insensitive)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check JWT claims first (zero table queries)
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

-- 2. PROFILES POLICIES (Remove recursive policy)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile non-role fields" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

-- Allow each authenticated user to read their own profile row (NO recursion)
CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT TO authenticated
    USING (id = auth.uid());

-- Allow admins to read all profiles via JWT or direct ID
CREATE POLICY "Admins can read all profiles"
    ON public.profiles FOR SELECT TO authenticated
    USING (
        id = auth.uid()
        OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
        OR (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
    );

-- Allow users to update their own non-role fields
CREATE POLICY "Users can update own profile non-role fields"
    ON public.profiles FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid() 
        AND lower(role) = (SELECT lower(p.role) FROM public.profiles p WHERE p.id = auth.uid())
    );

-- 3. CARS POLICIES (Fully permitted for admins)
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view all published cars" ON public.cars;
DROP POLICY IF EXISTS "Admins can insert cars" ON public.cars;
DROP POLICY IF EXISTS "Admins can update cars" ON public.cars;
DROP POLICY IF EXISTS "Admins can delete cars" ON public.cars;

-- Everyone can browse cars
CREATE POLICY "Public can view all published cars"
    ON public.cars FOR SELECT TO anon, authenticated
    USING (true);

-- Admins can insert cars
CREATE POLICY "Admins can insert cars"
    ON public.cars FOR INSERT TO authenticated
    WITH CHECK (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin')
    );

-- Admins can update cars
CREATE POLICY "Admins can update cars"
    ON public.cars FOR UPDATE TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin')
    )
    WITH CHECK (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin')
    );

-- Admins can delete cars
CREATE POLICY "Admins can delete cars"
    ON public.cars FOR DELETE TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin')
    );

-- 4. CAR IMAGES POLICIES
ALTER TABLE public.car_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view all car images" ON public.car_images;
DROP POLICY IF EXISTS "Admins can insert car images" ON public.car_images;
DROP POLICY IF EXISTS "Admins can update car images" ON public.car_images;
DROP POLICY IF EXISTS "Admins can delete car images" ON public.car_images;

CREATE POLICY "Public can view all car images"
    ON public.car_images FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "Admins can insert car images"
    ON public.car_images FOR INSERT TO authenticated
    WITH CHECK (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin')
    );

CREATE POLICY "Admins can update car images"
    ON public.car_images FOR UPDATE TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin')
    )
    WITH CHECK (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin')
    );

CREATE POLICY "Admins can delete car images"
    ON public.car_images FOR DELETE TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin')
    );

-- 5. RELOAD POSTGREST SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
