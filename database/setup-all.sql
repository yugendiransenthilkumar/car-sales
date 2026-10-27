-- ============================================================================
-- AUTOSPHERE USED CAR DEALERSHIP — ALL-IN-ONE SUPABASE DATABASE SETUP
-- ============================================================================
-- Run this entire script in Supabase Dashboard -> SQL Editor -> Click "Run"
-- It creates tables, constraints, triggers, RLS security policies, grants,
-- schema cache reloads, and starter vehicle inventory.
-- ============================================================================

-- 1. Enable Cryptographic & UUID Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 2. CREATE PROFILES TABLE (Linked to Supabase Auth)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ----------------------------------------------------------------------------
-- 3. CREATE LISTING NUMBER SEQUENCE & TRIGGER (e.g. AS-10001)
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.car_listing_seq START WITH 10001 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.generate_car_listing_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.listing_number IS NULL OR trim(NEW.listing_number) = '' THEN
        NEW.listing_number := 'AS-' || nextval('public.car_listing_seq')::text;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ----------------------------------------------------------------------------
-- 4. CREATE CARS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_number TEXT UNIQUE NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    variant TEXT,
    manufacturing_year INTEGER NOT NULL CHECK (manufacturing_year >= 1970 AND manufacturing_year <= (EXTRACT(YEAR FROM CURRENT_DATE) + 1)),
    registration_year INTEGER CHECK (registration_year >= 1970),
    price NUMERIC(12, 2) NOT NULL CHECK (price > 0),
    kilometres_driven INTEGER NOT NULL CHECK (kilometres_driven >= 0),
    fuel_type TEXT NOT NULL CHECK (fuel_type IN ('Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG', 'LPG')),
    transmission TEXT NOT NULL CHECK (transmission IN ('Manual', 'Automatic')),
    ownership_count INTEGER NOT NULL DEFAULT 1 CHECK (ownership_count >= 1 AND ownership_count <= 10),
    engine_capacity TEXT,
    exterior_color TEXT,
    body_type TEXT CHECK (body_type IS NULL OR body_type IN ('Sedan', 'SUV', 'Hatchback', 'Coupe', 'Convertible', 'MUV', 'Truck', 'Van')),
    seating_capacity INTEGER CHECK (seating_capacity IS NULL OR (seating_capacity >= 2 AND seating_capacity <= 12)),
    registration_state TEXT,
    insurance_status TEXT CHECK (insurance_status IS NULL OR insurance_status IN ('Comprehensive', 'Third Party', 'Zero Depreciation', 'Expired', 'None')),
    insurance_expiry DATE,
    service_history TEXT CHECK (service_history IS NULL OR service_history IN ('Full Dealer Record', 'Partial Dealer Record', 'Independent Garage', 'Not Available')),
    accident_history TEXT CHECK (accident_history IS NULL OR accident_history IN ('Clean / No Accidents', 'Minor Scratches Repaired', 'Repaired Prior Damage')),
    condition TEXT NOT NULL CHECK (condition IN ('Excellent', 'Very Good', 'Good', 'Fair')),
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'sold')),
    featured BOOLEAN NOT NULL DEFAULT false,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

DROP TRIGGER IF EXISTS trg_cars_listing_number ON public.cars;
CREATE TRIGGER trg_cars_listing_number
    BEFORE INSERT ON public.cars
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_car_listing_number();

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_cars_status ON public.cars(status);
CREATE INDEX IF NOT EXISTS idx_cars_featured ON public.cars(featured);
CREATE INDEX IF NOT EXISTS idx_cars_brand_model ON public.cars(brand, model);
CREATE INDEX IF NOT EXISTS idx_cars_price ON public.cars(price);
CREATE INDEX IF NOT EXISTS idx_cars_year ON public.cars(manufacturing_year);
CREATE INDEX IF NOT EXISTS idx_cars_fuel ON public.cars(fuel_type);
CREATE INDEX IF NOT EXISTS idx_cars_created_at ON public.cars(created_at DESC);

-- ----------------------------------------------------------------------------
-- 5. CREATE CAR IMAGES TABLE (Linked to Appwrite File IDs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.car_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    car_id UUID NOT NULL REFERENCES public.cars(id) ON DELETE CASCADE,
    appwrite_file_id TEXT NOT NULL,
    image_url TEXT NOT NULL,
    alt_text TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_car_images_car_id ON public.car_images(car_id);
CREATE INDEX IF NOT EXISTS idx_car_images_order ON public.car_images(car_id, display_order ASC);

-- ----------------------------------------------------------------------------
-- 6. AUTOMATIC UPDATED_AT TIMESTAMP TRIGGER
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_cars_updated_at ON public.cars;
CREATE TRIGGER trg_cars_updated_at
    BEFORE UPDATE ON public.cars
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ----------------------------------------------------------------------------
-- 7. NEW USER REGISTRATION TRIGGER (Enforces 'customer' role strictly)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        'customer'
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 8. HELPER SECURITY FUNCTION: IS_ADMIN()
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
-- 9. SCHEMA PERMISSIONS (Grants access to PostgREST roles)
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- ----------------------------------------------------------------------------
-- 10. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cars ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_images ENABLE ROW LEVEL SECURITY;

-- Clean existing policies
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile non-role fields" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

CREATE POLICY "Users can read own profile"
    ON public.profiles FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Admins can read all profiles"
    ON public.profiles FOR SELECT TO authenticated
    USING (
        id = auth.uid()
        OR (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
        OR (auth.jwt() -> 'user_metadata' ->> 'role' = 'admin')
    );

CREATE POLICY "Users can update own profile non-role fields"
    ON public.profiles FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (
        id = auth.uid() 
        AND lower(role) = (SELECT lower(p.role) FROM public.profiles p WHERE p.id = auth.uid())
    );

-- Cars Policies
DROP POLICY IF EXISTS "Public can view all published cars" ON public.cars;
DROP POLICY IF EXISTS "Admins can insert cars" ON public.cars;
DROP POLICY IF EXISTS "Admins can update cars" ON public.cars;
DROP POLICY IF EXISTS "Admins can delete cars" ON public.cars;

CREATE POLICY "Public can view all published cars"
    ON public.cars FOR SELECT TO anon, authenticated
    USING (true);

CREATE POLICY "Admins can insert cars"
    ON public.cars FOR INSERT TO authenticated
    WITH CHECK (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin')
    );

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

CREATE POLICY "Admins can delete cars"
    ON public.cars FOR DELETE TO authenticated
    USING (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND lower(role) = 'admin')
    );

-- Car Images Policies
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

-- ----------------------------------------------------------------------------
-- 11. REFRESH SUPABASE POSTGREST SCHEMA CACHE
-- (Instantly fixes "Could not find the table in schema cache" error)
-- ----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------------
-- 12. STARTER VEHICLE SEED DATA (6 Inspected Certified Cars)
-- ----------------------------------------------------------------------------
INSERT INTO public.cars (
    listing_number, brand, model, variant, manufacturing_year, registration_year,
    price, kilometres_driven, fuel_type, transmission, ownership_count,
    engine_capacity, exterior_color, body_type, seating_capacity, registration_state,
    insurance_status, condition, description, status, featured
) VALUES
(
    'AS-10001', 'Hyundai', 'Creta', 'SX (O) 1.5 Turbo DCT', 2023, 2023,
    1680000.00, 18500, 'Petrol', 'Automatic', 1,
    '1497 cc', 'Polar White', 'SUV', 5, 'KA',
    'Comprehensive', 'Excellent',
    'Single owner top-spec Creta with panoramic sunroof, ventilated front seats, Bose 8-speaker audio, ADAS level 2 suite, full company service record, zero insurance claims, and brand new Michelin tires.',
    'available', true
),
(
    'AS-10002', 'Honda', 'City', 'ZX 1.5 i-VTEC CVT', 2022, 2022,
    1240000.00, 29000, 'Petrol', 'Automatic', 1,
    '1498 cc', 'Golden Brown Metallic', 'Sedan', 5, 'DL',
    'Zero Depreciation', 'Excellent',
    'Flagship 5th generation Honda City ZX CVT with full leather upholstery, electric sunroof, Honda LaneWatch blind-spot camera, 6 airbags, fully documented dealer service history, and clean title guarantee.',
    'available', true
),
(
    'AS-10003', 'Tata', 'Nexon EV', 'Max XZ+ Lux 40.5kWh', 2023, 2023,
    1490000.00, 21000, 'Electric', 'Automatic', 1,
    '143 bhp Electric Motor', 'Daytona Grey', 'SUV', 5, 'MH',
    'Comprehensive', 'Excellent',
    'Long-range Nexon EV Max with 437 km ARAI range, 7.2 kW fast home charger included, Harman touch infotainment with wireless Apple CarPlay, electronic parking brake with auto-hold, and 8-year battery warranty intact.',
    'available', true
),
(
    'AS-10004', 'Mahindra', 'Thar', 'LX 4-Wheel-Drive Hard Top Diesel MT', 2021, 2021,
    1395000.00, 36000, 'Diesel', 'Manual', 1,
    '2184 cc mHawk', 'Napoli Black', 'SUV', 4, 'TN',
    'Comprehensive', 'Very Good',
    'Rugged Mahindra Thar 4x4 with low-range transfer case, mechanical locking rear differential, touchscreen infotainment with Adventure Statistics, rollover mitigation, and upgraded all-terrain BF Goodrich tires.',
    'available', false
),
(
    'AS-10005', 'Toyota', 'Innova Crysta', '2.4 ZX 7-Str Diesel AT', 2020, 2020,
    2150000.00, 54000, 'Diesel', 'Automatic', 1,
    '2393 cc D-4D', 'Silver Metallic', 'MUV', 7, 'KA',
    'Comprehensive', 'Excellent',
    'Legendary Toyota reliability. Top-line 7-seater Innova Crysta ZX automatic with middle captain seats, 7 airbags, vehicle stability control, hill start assist, and verified Toyota authorized service records.',
    'available', true
),
(
    'AS-10006', 'Maruti Suzuki', 'Baleno', 'Alpha 1.2 DualJet Smart Hybrid', 2022, 2022,
    785000.00, 26000, 'Petrol', 'Manual', 1,
    '1197 cc', 'Celestial Blue', 'Hatchback', 5, 'DL',
    'Comprehensive', 'Very Good',
    'Fuel-efficient premium hatchback delivering 22+ km/l. Equipped with Head-Up Display (HUD), 360-degree surround view camera, 9-inch SmartPlay Pro+ screen with Arkamys surround sound, and cruise control.',
    'available', false
)
ON CONFLICT (listing_number) DO NOTHING;

-- Associate starter car photos from Appwrite or placeholders
INSERT INTO public.car_images (car_id, appwrite_file_id, image_url, alt_text, display_order)
SELECT id, 'starter-placeholder', '/assets/images/car-placeholder.svg', brand || ' ' || model || ' Photo', 0
FROM public.cars
ON CONFLICT DO NOTHING;
