/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * AUTHENTICATION & ACCESS CONTROL LAYER (SUPABASE AUTH)
 */

import { supabase } from './supabase-client.js';

export async function registerCustomer(email, password, fullName, phone) {
  if (!supabase) throw new Error('Supabase is not initialized');

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone: phone,
        role: 'customer'
      }
    }
  });

  if (error) throw new Error(translateAuthError(error.message));
  return data;
}

export async function loginUser(email, password) {
  if (!supabase) throw new Error('Supabase is not initialized');

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw new Error(translateAuthError(error.message));

  const profile = await getUserProfile(data.user.id);
  return { user: data.user, session: data.session, profile };
}

export async function logoutUser() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) console.error('Logout error:', error);
}

export async function getCurrentUser() {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  return await getUserProfile(user.id);
}

export async function getUserProfile(userId) {
  if (!supabase || !userId) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) return null;
    return data;
  } catch (err) {
    return null;
  }
}

export async function isCurrentUserAdmin() {
  const profile = await getCurrentProfile();
  return profile && profile.role === 'admin';
}

export function subscribeToAuthChanges(callback) {
  if (!supabase) return { unsubscribe: () => {} };

  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    let profile = null;
    if (session && session.user) {
      profile = await getUserProfile(session.user.id);
    }
    callback(event, session, profile);
  });

  return subscription;
}

function translateAuthError(message = '') {
  const msg = message.toLowerCase();
  if (msg.includes('invalid login credentials')) return 'Invalid email or password.';
  if (msg.includes('user already registered') || msg.includes('email already in use')) return 'An account with this email already exists.';
  if (msg.includes('password should be at least')) return 'Password must be at least 6 characters.';
  return message || 'Authentication failed.';
}
