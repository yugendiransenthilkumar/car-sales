/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * USER & ADMIN LOGIN CONTROLLER (login.html)
 */

import { loginUser, getCurrentProfile } from './auth.js';
import { showToast, initCommonUI } from './common.js';
import { isSupabaseConfigured } from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
  initCommonUI();
  initLoginForm();
  initPasswordToggle();

  const profile = await getCurrentProfile();
  if (profile) {
    if (profile.role === 'admin') {
      window.location.href = '/admin/dashboard.html';
    } else {
      window.location.href = '/cars.html';
    }
  }
});

function initPasswordToggle() {
  const toggleBtn = document.getElementById('toggle-password-btn');
  const passwordInput = document.getElementById('login-password');
  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener('click', () => {
      const isPassword = passwordInput.type === 'password';
      passwordInput.type = isPassword ? 'text' : 'password';
      toggleBtn.innerHTML = isPassword
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });
  }
}

function initLoginForm() {
  const form = document.getElementById('login-form');
  const submitBtn = document.getElementById('login-submit-btn');
  const errorBox = document.getElementById('login-error-box');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!isSupabaseConfigured()) {
      showError(errorBox, 'Supabase credentials are not configured. Configure credentials in assets/js/config.js or via System Setup.');
      return;
    }

    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    if (!email || !password) {
      showError(errorBox, 'Please enter both your email address and password.');
      return;
    }

    hideError(errorBox);
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <div class="spinner" style="width: 18px; height: 18px; border-width: 2px; border-color: rgba(255,255,255,0.3); border-top-color: #fff;"></div>
      Signing In...
    `;

    try {
      const { user, profile } = await loginUser(email, password);
      showToast('Signed in successfully!', 'success');

      if (profile && profile.role === 'admin') {
        window.location.href = '/admin/dashboard.html';
      } else {
        window.location.href = '/cars.html';
      }
    } catch (err) {
      showError(errorBox, err.message || 'Login failed. Please verify your credentials.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Sign In to Account';
    }
  });
}

function showError(box, message) {
  if (!box) return;
  box.style.display = 'block';
  box.innerHTML = `<p>${escapeHTML(message)}</p>`;
}

function hideError(box) {
  if (!box) return;
  box.style.display = 'none';
  box.innerHTML = '';
}

function escapeHTML(str) {
  if (typeof str !== 'string') return String(str || '');
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
