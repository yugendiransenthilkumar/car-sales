/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * CUSTOMER REGISTRATION CONTROLLER (register.html)
 */

import { registerCustomer } from './auth.js';
import { showToast, initCommonUI } from './common.js';
import { isSupabaseConfigured } from './config.js';

document.addEventListener('DOMContentLoaded', () => {
  initCommonUI();
  initRegisterForm();
  initPasswordToggle();
});

function initPasswordToggle() {
  const toggleBtn = document.getElementById('toggle-register-password-btn');
  const passwordInput = document.getElementById('reg-password');
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

function initRegisterForm() {
  const form = document.getElementById('register-form');
  const submitBtn = document.getElementById('reg-submit-btn');
  const errorBox = document.getElementById('reg-error-box');

  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!isSupabaseConfigured()) {
      showError(errorBox, 'Supabase is not configured yet. Configure credentials in assets/js/config.js or via System Setup.');
      return;
    }

    const fullName = document.getElementById('reg-fullname').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    if (!fullName || !email || !password) {
      showError(errorBox, 'Please complete all required fields.');
      return;
    }

    if (password.length < 6) {
      showError(errorBox, 'Password must be at least 6 characters long.');
      return;
    }

    hideError(errorBox);
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <div class="spinner" style="width: 18px; height: 18px; border-width: 2px; border-color: rgba(255,255,255,0.3); border-top-color: #fff;"></div>
      Creating Account...
    `;

    try {
      await registerCustomer(email, password, fullName, phone);
      showToast('Account created successfully! Please sign in.', 'success');
      setTimeout(() => {
        window.location.href = '/login.html?registered=true';
      }, 1000);
    } catch (err) {
      showError(errorBox, err.message || 'Registration failed.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Create Customer Account';
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
