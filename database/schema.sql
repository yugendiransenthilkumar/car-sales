-- ============================================================================
-- AUTOSPHERE USED CAR DEALERSHIP - DATABASE SCHEMA (SUPABASE POSTGRESQL)
-- ============================================================================
-- Execute this script in your Supabase Project -> SQL Editor
-- This script sets up tables, constraints, sequences, triggers, and helper functions.

-- Enable pgcrypto / uuid-ossp if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean teardown (optional, run only if you want a clean reset)
-- DROP TABLE IF EXISTS car_images CASCADE;
-- DROP TABLE IF EXISTS cars CASCADE;
-- DROP TABLE IF EXISTS profiles CASCADE;
-- DROP SEQUENCE IF EXISTS car_listing_seq;

-- ----------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- Linked to Supabase Auth (auth.users)
-- Customers are created automatically via trigger on registration.
-- Role is strictly protected: defaults to 'customer'.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for role-based authorization lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- ----------------------------------------------------------------------------
-- 2. LISTING NUMBER SEQUENCE & FUNCTION
-- Safely generates human-friendly unique listing IDs like 'AS-10001'
-- Avoids duplicate numbers during concurrent inserts
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
-- 3. CARS INVENTORY TABLE
-- Comprehensive vehicle specifications, financial, history, and status tracking
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

-- Trigger to populate listing_number if omitted
DROP TRIGGER IF EXISTS trg_cars_listing_number ON public.cars;
CREATE TRIGGER trg_cars_listing_number
    BEFORE INSERT ON public.cars
    FOR EACH ROW
    EXECUTE FUNCTION public.generate_car_listing_number();

-- Performance Indexes for search, filtering, and ordering
CREATE INDEX IF NOT EXISTS idx_cars_status ON public.cars(status);
CREATE INDEX IF NOT EXISTS idx_cars_featured ON public.cars(featured);
CREATE INDEX IF NOT EXISTS idx_cars_brand_model ON public.cars(brand, model);
CREATE INDEX IF NOT EXISTS idx_cars_price ON public.cars(price);
CREATE INDEX IF NOT EXISTS idx_cars_year ON public.cars(manufacturing_year);
CREATE INDEX IF NOT EXISTS idx_cars_fuel ON public.cars(fuel_type);
CREATE INDEX IF NOT EXISTS idx_cars_created_at ON public.cars(created_at DESC);

-- ----------------------------------------------------------------------------
-- 4. CAR IMAGES TABLE
-- Connects vehicle listings to Appwrite Storage files
-- Supports multiple photos, ordered gallery, and primary photo determination
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
-- 5. AUTOMATIC TIMESTAMP UPDATE TRIGGER
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
-- 6. AUTH.USERS TO PROFILES REGISTRATION TRIGGER
-- Whenever a user signs up via Supabase Auth, securely insert a profile record.
-- The role is HARDCODED to 'customer' to strictly prevent privilege escalation.
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
-- 7. SECURE ADMIN PROMOTION FUNCTION
-- Only callable by Supabase Service Role or directly via SQL Editor
-- Usage: SELECT public.promote_user_to_admin('user_uuid_here');
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET role = 'admin', updated_at = timezone('utc'::text, now())
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
