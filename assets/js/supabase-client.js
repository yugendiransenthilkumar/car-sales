/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SUPABASE CLIENT & DATA ACCESS LAYER
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { CONFIG, isSupabaseConfigured } from './config.js';

let supabaseClient = null;

try {
  supabaseClient = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      fetch: (...args) => window.fetch(...args)
    }
  });
} catch (err) {
  console.error('Failed to initialize Supabase client:', err);
}

export const supabase = supabaseClient;

export async function testSupabaseConnection() {
  if (!isSupabaseConfigured()) {
    return {
      connected: false,
      message: 'Supabase credentials are not configured. Enter your Project URL and Anon Key in assets/js/config.js or via System Setup.'
    };
  }

  try {
    const { data, error } = await supabase.from('cars').select('id', { count: 'exact', head: true });
    if (error) return { connected: false, message: error.message };
    return { connected: true };
  } catch (err) {
    return { connected: false, message: err.message || 'Network error connecting to Supabase.' };
  }
}

export async function fetchFeaturedCars(limit = 6) {
  if (!supabase) return { data: [], error: new Error('Supabase client not initialized') };

  const { data, error } = await supabase
    .from('cars')
    .select(`
      *,
      car_images (
        id,
        appwrite_file_id,
        image_url,
        alt_text,
        display_order
      )
    `)
    .eq('featured', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  return { data, error };
}

export async function fetchRecentCars(limit = 6) {
  if (!supabase) return { data: [], error: new Error('Supabase client not initialized') };

  const { data, error } = await supabase
    .from('cars')
    .select(`
      *,
      car_images (
        id,
        appwrite_file_id,
        image_url,
        alt_text,
        display_order
      )
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  return { data, error };
}

export async function fetchCars(options = {}) {
  if (!supabase) return { data: [], count: 0, error: new Error('Supabase client not initialized') };

  const {
    brand = '',
    search = '',
    minPrice,
    maxPrice,
    year,
    fuelType,
    transmission,
    maxKm,
    status = '',
    sortBy = 'created_at',
    sortOrder = 'desc',
    page = 1,
    pageSize = 12
  } = options;

  let query = supabase
    .from('cars')
    .select(`
      *,
      car_images (
        id,
        appwrite_file_id,
        image_url,
        alt_text,
        display_order
      )
    `, { count: 'exact' });

  if (brand && brand !== 'All') {
    query = query.ilike('brand', `%${brand}%`);
  }

  if (search) {
    query = query.or(`brand.ilike.%${search}%,model.ilike.%${search}%,variant.ilike.%${search}%`);
  }

  if (minPrice) {
    query = query.gte('price', Number(minPrice));
  }

  if (maxPrice) {
    query = query.lte('price', Number(maxPrice));
  }

  if (year) {
    query = query.eq('manufacturing_year', Number(year));
  }

  if (fuelType && fuelType !== 'All') {
    query = query.eq('fuel_type', fuelType);
  }

  if (transmission && transmission !== 'All') {
    query = query.eq('transmission', transmission);
  }

  if (maxKm) {
    query = query.lte('kilometres_driven', Number(maxKm));
  }

  if (status && status !== 'All') {
    query = query.eq('status', status);
  }

  const ascending = sortOrder === 'asc';
  query = query.order(sortBy, { ascending });

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  return { data, count, error };
}

export async function fetchCarById(id) {
  if (!supabase) return { data: null, error: new Error('Supabase client not initialized') };

  const { data, error } = await supabase
    .from('cars')
    .select(`
      *,
      car_images (
        id,
        appwrite_file_id,
        image_url,
        alt_text,
        display_order
      )
    `)
    .eq('id', id)
    .single();

  if (data && data.car_images) {
    data.car_images.sort((a, b) => a.display_order - b.display_order);
  }

  return { data, error };
}

export async function fetchRelatedCars(currentCarId, brand, price, limit = 3) {
  if (!supabase) return { data: [], error: null };

  const minPrice = Math.max(0, price * 0.7);
  const { data, error } = await supabase
    .from('cars')
    .select(`
      *,
      car_images (
        id,
        appwrite_file_id,
        image_url,
        alt_text,
        display_order
      )
    `)
    .neq('id', currentCarId)
    .eq('status', 'available')
    .or(`brand.eq.${brand},price.gte.${minPrice}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  return { data, error };
}

export async function fetchAdminStats() {
  if (!supabase) return { total: 0, available: 0, reserved: 0, sold: 0, totalValuation: 0, error: null };

  const { data, error } = await supabase
    .from('cars')
    .select('id, price, status');

  if (error) {
    return { total: 0, available: 0, reserved: 0, sold: 0, totalValuation: 0, error };
  }

  let total = data.length;
  let available = 0;
  let reserved = 0;
  let sold = 0;
  let totalValuation = 0;

  data.forEach(car => {
    if (car.status === 'available') available++;
    else if (car.status === 'reserved') reserved++;
    else if (car.status === 'sold') sold++;
    totalValuation += Number(car.price || 0);
  });

  return { total, available, reserved, sold, totalValuation, error: null };
}

export async function insertCar(carPayload) {
  if (!supabase) throw new Error('Supabase client not initialized');
  
  const { data, error } = await supabase
    .from('cars')
    .insert([carPayload])
    .select();

  if (error) return { data: null, error };

  if (!data || data.length === 0) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        data: null,
        error: new Error('You must be logged in as an administrator to add new vehicles.')
      };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || profile.role !== 'admin') {
      return {
        data: null,
        error: new Error(`Permission Denied: Your profile role is "${profile?.role || 'customer'}". To elevate, run in Supabase SQL Editor: UPDATE public.profiles SET role = 'admin' WHERE id = '${user.id}';`)
      };
    }

    return { data: null, error: new Error('Failed to insert car record.') };
  }

  return { data: data[0], error: null };
}

export async function updateCar(id, carPayload) {
  if (!supabase) throw new Error('Supabase client not initialized');

  const payload = { ...carPayload };
  delete payload.id;
  delete payload.listing_number;
  delete payload.created_at;
  delete payload.updated_at;

  const { data, error } = await supabase
    .from('cars')
    .update(payload)
    .eq('id', id)
    .select();

  if (error) return { data: null, error };

  if (!data || data.length === 0) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return {
        data: null,
        error: new Error('You must be signed in as an administrator to edit vehicles.')
      };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    const roleLower = (profile?.role || '').toLowerCase();
    if (roleLower !== 'admin') {
      return {
        data: null,
        error: new Error(`Permission Denied: Your account role is "${profile?.role || 'customer'}", but only "admin" accounts can edit vehicles. Please run in Supabase SQL Editor: UPDATE public.profiles SET role = 'admin' WHERE id = '${user.id}';`)
      };
    }

    const { data: existingCar } = await supabase
      .from('cars')
      .select('id, brand, model')
      .eq('id', id)
      .maybeSingle();

    if (!existingCar) {
      return {
        data: null,
        error: new Error(`Vehicle record #${id} was not found in the database.`)
      };
    }

    return {
      data: null,
      error: new Error('Supabase RLS Policy Blocked: The update was blocked by your PostgreSQL row security rules. Please execute the non-recursive RLS fix script (database/fix-rls.sql) in your Supabase SQL Editor.')
    };
  }

  return { data: data[0], error: null };
}

export async function updateCarStatus(id, newStatus) {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase.from('cars').update({ status: newStatus }).eq('id', id).select();
  if (error) return { data: null, error };
  return { data: data && data.length > 0 ? data[0] : null, error: null };
}

export async function deleteCar(id) {
  if (!supabase) throw new Error('Supabase client not initialized');
  return await supabase.from('cars').delete().eq('id', id);
}

export async function insertCarImages(images) {
  if (!supabase) throw new Error('Supabase client not initialized');
  if (!images || images.length === 0) return { data: [], error: null };
  const { data, error } = await supabase.from('car_images').insert(images).select();
  return { data, error };
}

export async function deleteCarImages(carId) {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase.from('car_images').delete().eq('car_id', carId);
  return { data, error };
}

