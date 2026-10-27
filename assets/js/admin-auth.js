/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ADMIN AUTHENTICATION GUARD & NAVIGATION CONTROLLER
 */

import { getCurrentUser, getCurrentProfile, logoutUser } from './auth.js';
import { isSupabaseConfigured } from './config.js';
import { showToast } from './common.js';

export async function requireAdminAuth() {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase not configured.');
    return null;
  }

  const user = await getCurrentUser();
  if (!user) {
    window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
    return null;
  }

  const profile = await getCurrentProfile();
  if (!profile || profile.role !== 'admin') {
    alert('Access Restricted: Administrator privileges are required to access this portal.');
    window.location.href = '/cars.html';
    return null;
  }

  renderAdminSidebarUser(profile);
  initAdminLogout();
  return profile;
}

function renderAdminSidebarUser(profile) {
  const nameEl = document.getElementById('admin-sidebar-name');
  const roleEl = document.getElementById('admin-sidebar-role');
  const avatarEl = document.getElementById('admin-sidebar-avatar');

  if (nameEl) nameEl.textContent = profile.full_name || 'Administrator';
  if (roleEl) roleEl.textContent = profile.role.toUpperCase();
  if (avatarEl) {
    const initials = (profile.full_name || 'Admin')
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    avatarEl.textContent = initials;
  }
}

function initAdminLogout() {
  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      await logoutUser();
      showToast('Logged out of Admin Portal', 'info');
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 500);
    });
  }
}


document.addEventListener('DOMContentLoaded', () => {
  requireAdminAuth();
});
