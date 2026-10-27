/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * AUTOSPHERE USED CAR DEALERSHIP - CONFIGURATION MODULE
 */

const DEFAULT_CONFIG = {
  supabaseUrl: 'https://uurnhbwkpelirhpcrenv.supabase.co',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1cm5oYndrcGVsaXJocGNyZW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwNzM2NTgsImV4cCI6MjEwODY0OTY1OH0.K2I8UGI1TlcxLGoFfR3AmIF9PbACxYir2mOBUvLFZ_c',
  appwriteEndpoint: 'https://fra.cloud.appwrite.io/v1',
  appwriteProjectId: '6adf71db000553af5573',
  appwriteBucketId: '6adf7278000b5aa5a934',
  whatsappNumber: '916381272552',
  siteUrl: window.location.origin
};

function getRuntimeOverrides() {
  try {
    const saved = localStorage.getItem('autosphere_runtime_config');
    if (saved) return JSON.parse(saved);
  } catch (err) {
    console.warn('Failed to parse runtime config overrides:', err);
  }
  return {};
}

export const CONFIG = {
  ...DEFAULT_CONFIG,
  ...getRuntimeOverrides(),
  siteUrl: window.location.origin
};

export function isSupabaseConfigured() {
  return (
    CONFIG.supabaseUrl &&
    !CONFIG.supabaseUrl.includes('xyzcompanyplaceholder') &&
    CONFIG.supabaseAnonKey &&
    !CONFIG.supabaseAnonKey.includes('placeholder_anon_key')
  );
}

export function isAppwriteConfigured() {
  return (
    CONFIG.appwriteProjectId &&
    CONFIG.appwriteProjectId !== 'autosphere-used-cars' &&
    CONFIG.appwriteBucketId &&
    CONFIG.appwriteBucketId !== 'car-photos'
  );
}

export function isWhatsAppConfigured() {
  return (
    CONFIG.whatsappNumber &&
    CONFIG.whatsappNumber !== '919876543210' &&
    /^\d{10,15}$/.test(CONFIG.whatsappNumber)
  );
}

export function saveRuntimeConfig(newConfig) {
  const merged = { ...getRuntimeOverrides(), ...newConfig };
  localStorage.setItem('autosphere_runtime_config', JSON.stringify(merged));
  window.location.reload();
}

export function clearRuntimeConfig() {
  localStorage.removeItem('autosphere_runtime_config');
  window.location.reload();
}
