/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SHARED COMPONENTS, UTILITIES, AND NOTIFICATIONS
 */

import { CONFIG, isWhatsAppConfigured, isSupabaseConfigured, saveRuntimeConfig, clearRuntimeConfig } from './config.js';
import { getCurrentProfile, logoutUser } from './auth.js';

export function formatINR(amount) {
  const num = Number(amount);
  if (isNaN(num)) return '₹0';
  return '₹' + num.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function formatKM(km) {
  const num = Number(km);
  if (isNaN(num)) return '0 km';
  return num.toLocaleString('en-IN') + ' km';
}

export function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  let iconSvg = '';
  if (type === 'success') {
    iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
  } else if (type === 'danger') {
    iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  } else if (type === 'warning') {
    iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  } else {
    iconSvg = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
  }

  toast.innerHTML = `${iconSvg}<div style="flex: 1; word-break: break-word;">${escapeHTML(message)}</div>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export function showConfirmModal({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', isDanger = false }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';

    backdrop.innerHTML = `
      <div class="modal-content" role="dialog" aria-modal="true">
        <h3 class="modal-title">${escapeHTML(title)}</h3>
        <p class="modal-desc">${escapeHTML(message)}</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" id="modal-cancel-btn">${escapeHTML(cancelText)}</button>
          <button type="button" class="btn ${isDanger ? 'btn-accent' : 'btn-primary'}" id="modal-confirm-btn">${escapeHTML(confirmText)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const cancelBtn = backdrop.querySelector('#modal-cancel-btn');
    const confirmBtn = backdrop.querySelector('#modal-confirm-btn');

    const cleanup = (result) => {
      backdrop.remove();
      resolve(result);
    };

    cancelBtn.addEventListener('click', () => cleanup(false));
    confirmBtn.addEventListener('click', () => cleanup(true));
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) cleanup(false);
    });
  });
}

export function initiateWhatsAppEnquiry(car) {
  if (!car) {
    showToast('Invalid vehicle selected.', 'danger');
    return;
  }

  if (car.status === 'sold') {
    showToast('This vehicle has already been sold.', 'warning');
    return;
  }

  const phone = CONFIG.whatsappNumber || '919876543210';
  const carUrl = `${window.location.origin}/car-details.html?id=${car.id}`;
  const variantText = car.variant ? ` (${car.variant})` : '';
  const ownershipText = car.ownership_count ? ` | ${car.ownership_count} Owner(s)` : '';

  const messageLines = [
    `Hello AutoSphere Cars,`,
    ``,
    `I am interested in purchasing the following vehicle listed on your website:`,
    `----------------------------------------`,
    `Listing ID: ${car.listing_number || 'N/A'}`,
    `Vehicle: ${car.manufacturing_year} ${car.brand} ${car.model}${variantText}`,
    `Asking Price: ${formatINR(car.price)}`,
    `Kilometres: ${formatKM(car.kilometres_driven)}`,
    `Fuel: ${car.fuel_type} | Transmission: ${car.transmission}${ownershipText}`,
    `Status: ${car.status.toUpperCase()}`,
    `----------------------------------------`,
    `Listing URL: ${carUrl}`,
    ``,
    `Could you please confirm its current availability, inspection schedule, and final on-road pricing details?`
  ];

  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(messageLines.join('\n'))}`;
  window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
}

export function renderCarCard(car) {
  const mainImage = (car.car_images && car.car_images.length > 0)
    ? car.car_images[0].image_url
    : '/assets/images/car-placeholder.svg';

  const statusBadge = car.status === 'available'
    ? `<span class="badge badge-available">Available</span>`
    : car.status === 'reserved'
    ? `<span class="badge badge-reserved">Reserved</span>`
    : `<span class="badge badge-sold">Sold</span>`;

  const featuredBadge = car.featured
    ? `<span class="badge badge-featured">★ Featured</span>`
    : '';

  const isSold = car.status === 'sold';

  return `
    <article class="car-card" data-id="${car.id}">
      <div class="car-card-media">
        <img 
          src="${escapeHTML(mainImage)}" 
          alt="${escapeHTML(car.brand)} ${escapeHTML(car.model)}" 
          loading="lazy" 
          onerror="this.src='/assets/images/car-placeholder.svg'"
        />
        <div class="car-card-badges">
          ${statusBadge}
          ${featuredBadge}
        </div>
        <div class="car-card-year">${car.manufacturing_year}</div>
      </div>
      <div class="car-card-body">
        <div class="car-card-header">
          <h3 class="car-card-title">${escapeHTML(car.brand)} ${escapeHTML(car.model)}</h3>
          <div class="car-card-variant">${escapeHTML(car.variant || car.body_type || 'Verified Edition')}</div>
        </div>

        <div class="car-card-price-container">
          <span class="car-card-price">${formatINR(car.price)}</span>
        </div>

        <div class="car-card-specs">
          <div class="car-spec-item" title="Kilometres Driven">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            <span>${formatKM(car.kilometres_driven)}</span>
          </div>
          <div class="car-spec-item" title="Fuel Type">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 22v-8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v8"/><path d="M14 13h2a2 2 0 0 1 2 2v7"/><path d="M7 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><rect x="5" y="6" width="10" height="6" rx="1"/></svg>
            <span>${escapeHTML(car.fuel_type)}</span>
          </div>
          <div class="car-spec-item" title="Transmission">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span>${escapeHTML(car.transmission)}</span>
          </div>
          <div class="car-spec-item" title="Ownership Count">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>
            <span>${car.ownership_count || 1} Owner</span>
          </div>
        </div>

        <div class="car-card-actions">
          <a href="/car-details.html?id=${car.id}" class="btn btn-secondary btn-sm">
            View Details
          </a>
          <button 
            type="button" 
            class="btn ${isSold ? 'btn-secondary btn-disabled' : 'btn-whatsapp'} btn-sm btn-buy-now" 
            data-car-json='${JSON.stringify(car).replace(/'/g, "&#39;")}'
            ${isSold ? 'disabled' : ''}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.711 1.456h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            ${isSold ? 'Sold' : 'Buy Now'}
          </button>
        </div>
      </div>
    </article>
  `;
}

export function initCommonUI() {
  document.addEventListener('click', (e) => {
    const buyBtn = e.target.closest('.btn-buy-now');
    if (buyBtn && !buyBtn.disabled) {
      const carJson = buyBtn.getAttribute('data-car-json');
      if (carJson) {
        try {
          const car = JSON.parse(carJson);
          initiateWhatsAppEnquiry(car);
        } catch (err) {
          console.error('Failed to parse car JSON:', err);
        }
      }
    }
  });

  const mobileToggle = document.querySelector('.mobile-menu-toggle');
  const navMenu = document.querySelector('.nav-menu');
  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      navMenu.classList.toggle('is-open');
    });
  }

  renderNavAuth();
  // Remove any setup notice banners so public visitors never see setup warnings
  const existingBanner = document.getElementById('config-warning-banner');
  if (existingBanner) existingBanner.remove();
}

async function renderNavAuth() {
  const authContainer = document.getElementById('nav-auth-slot');
  if (!authContainer) return;

  const profile = await getCurrentProfile();

  if (profile) {
    const isAdmin = profile.role === 'admin';
    authContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        ${isAdmin ? `<a href="/admin/dashboard.html" class="btn btn-secondary btn-sm" style="font-weight:700;">Admin Console</a>` : ''}
        <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">Hi, ${escapeHTML(profile.full_name || 'Member')}</span>
        <button type="button" id="nav-logout-btn" class="btn btn-secondary btn-sm" title="Log Out">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    `;

    document.getElementById('nav-logout-btn')?.addEventListener('click', async () => {
      await logoutUser();
      showToast('Logged out successfully', 'info');
      setTimeout(() => window.location.reload(), 500);
    });
  } else {
    authContainer.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <a href="/login.html" class="btn btn-secondary btn-sm">Log In</a>
        <a href="/register.html" class="btn btn-primary btn-sm">Register</a>
      </div>
    `;
  }
}

export async function openConfigModal() {
  // STRICT ACCESS CONTROL: Only admins in Admin Console can open System Setup
  const profile = await getCurrentProfile();
  const isAdmin = profile && (profile.role === 'admin' || profile.role === 'superadmin');
  const isAdminPage = window.location.pathname.startsWith('/admin');

  if (!isAdmin && !isAdminPage) {
    console.warn('System Setup is strictly restricted to administrators in the Admin Console.');
    return;
  }

  // Remove any existing modal if already open
  const existingModal = document.querySelector('.modal-backdrop');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 540px;">
      <h3 class="modal-title">⚙️ System Configuration & Credentials</h3>
      <p class="modal-desc" style="margin-bottom: 1rem;">
        Enter your real Supabase and Appwrite credentials below, or edit <code>assets/js/config.js</code> directly.
      </p>
      
      <form id="runtime-config-form" style="display: flex; flex-direction: column; gap: 0.85rem;">
        <div class="form-group">
          <label class="form-label">Supabase Project URL</label>
          <input type="url" id="cfg-supabase-url" class="form-control" value="${escapeHTML(CONFIG.supabaseUrl)}" placeholder="https://your-project.supabase.co" required />
        </div>

        <div class="form-group">
          <label class="form-label">Supabase Anon Key</label>
          <input type="text" id="cfg-supabase-key" class="form-control" value="${escapeHTML(CONFIG.supabaseAnonKey)}" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..." required />
        </div>

        <div class="form-group">
          <label class="form-label">Appwrite Project ID</label>
          <input type="text" id="cfg-appwrite-project" class="form-control" value="${escapeHTML(CONFIG.appwriteProjectId)}" placeholder="autosphere-used-cars" />
        </div>

        <div class="form-group">
          <label class="form-label">Appwrite Bucket ID</label>
          <input type="text" id="cfg-appwrite-bucket" class="form-control" value="${escapeHTML(CONFIG.appwriteBucketId)}" placeholder="car-photos" />
        </div>

        <div class="form-group">
          <label class="form-label">Dealership WhatsApp Number (without +)</label>
          <input type="text" id="cfg-whatsapp" class="form-control" value="${escapeHTML(CONFIG.whatsappNumber)}" placeholder="919876543210" required />
        </div>

        <div style="margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
          <div style="font-size: 0.85rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--text-dark);">Database Security & Permissions</div>
          <button type="button" class="btn btn-secondary btn-sm" id="cfg-rls-fix-btn" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            <span>🛡️ Fix Supabase RLS Permissions (SQL)</span>
          </button>
        </div>

        <div class="modal-actions" style="margin-top: 1rem;">
          <button type="button" class="btn btn-secondary" id="cfg-cancel-btn">Cancel</button>
          <button type="button" class="btn btn-secondary" id="cfg-reset-btn" title="Reset to defaults">Reset</button>
          <button type="submit" class="btn btn-primary">Save & Apply</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#cfg-cancel-btn').addEventListener('click', () => modal.remove());
  modal.querySelector('#cfg-reset-btn').addEventListener('click', () => clearRuntimeConfig());
  modal.querySelector('#cfg-rls-fix-btn')?.addEventListener('click', () => {
    modal.remove();
    openRlsFixModal();
  });

  modal.querySelector('#runtime-config-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const newConfig = {
      supabaseUrl: document.getElementById('cfg-supabase-url').value.trim(),
      supabaseAnonKey: document.getElementById('cfg-supabase-key').value.trim(),
      appwriteProjectId: document.getElementById('cfg-appwrite-project').value.trim(),
      appwriteBucketId: document.getElementById('cfg-appwrite-bucket').value.trim(),
      whatsappNumber: document.getElementById('cfg-whatsapp').value.trim()
    };
    saveRuntimeConfig(newConfig);
  });
}

export const SUPABASE_RLS_FIX_SQL = `-- 1. Helper function: is_admin() (Non-recursive and case-insensitive)
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

-- 2. Clean up recursive policies on public.profiles
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

-- 4. CAR IMAGES POLICIES
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

-- 5. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';`;

export async function openRlsFixModal() {
  const profile = await getCurrentProfile();
  const isAdmin = profile && (profile.role === 'admin' || profile.role === 'superadmin');
  const isAdminPage = window.location.pathname.startsWith('/admin');
  if (!isAdmin && !isAdminPage) return;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 640px;">
      <h3 class="modal-title">🛡️ Fix Supabase RLS Permission Rules</h3>
      <p class="modal-desc" style="margin-bottom: 0.75rem;">
        If you see <em>"Vehicle record not found or no changes were permitted"</em>, Supabase's row security policy had a recursive evaluation on <code>public.profiles</code>.
      </p>
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1rem;">
        <strong>How to fix (takes 10 seconds):</strong><br/>
        1. Click <strong>"Copy SQL Fix Script"</strong> below.<br/>
        2. In your <strong>Supabase Project Dashboard</strong>, go to <strong>SQL Editor</strong> -> <strong>New Query</strong>.<br/>
        3. Paste and click <strong>Run</strong>.
      </p>

      <textarea id="rls-sql-box" readonly style="width: 100%; height: 180px; font-family: monospace; font-size: 0.75rem; background: #0f172a; color: #38bdf8; padding: 0.75rem; border-radius: var(--radius-sm); border: 1px solid #334155; margin-bottom: 1rem; resize: vertical;">${SUPABASE_RLS_FIX_SQL}</textarea>

      <div class="modal-actions" style="display: flex; gap: 0.5rem; justify-content: flex-end;">
        <button type="button" class="btn btn-secondary" id="rls-modal-close-btn">Close</button>
        <button type="button" class="btn btn-primary" id="rls-modal-copy-btn">📋 Copy SQL Fix Script</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  modal.querySelector('#rls-modal-close-btn').addEventListener('click', () => modal.remove());
  modal.querySelector('#rls-modal-copy-btn').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_RLS_FIX_SQL);
      showToast('SQL Fix Script copied to clipboard! Paste and run it in Supabase SQL Editor.', 'success', 5000);
      modal.remove();
    } catch {
      showToast('Please select and copy the text manually from the box.', 'warning');
    }
  });
}

// Make globally available
window.openConfigModal = openConfigModal;
window.openRlsFixModal = openRlsFixModal;

function escapeHTML(str) {
  if (typeof str !== 'string') return String(str || '');
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

