/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * HOME PAGE LOGIC (index.html)
 */

import { fetchFeaturedCars, fetchRecentCars, testSupabaseConnection } from './supabase-client.js';
import { renderCarCard, initCommonUI } from './common.js';
import { isSupabaseConfigured } from './config.js';
import './appwrite.js';

document.addEventListener('DOMContentLoaded', async () => {
  initCommonUI();
  initHeroSearch();
  await loadHomeInventory();
});

function initHeroSearch() {
  const searchForm = document.getElementById('hero-search-form');
  if (!searchForm) return;

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const brand = document.getElementById('hero-brand')?.value || '';
    const maxPrice = document.getElementById('hero-max-price')?.value || '';
    const year = document.getElementById('hero-year')?.value || '';

    const params = new URLSearchParams();
    if (brand && brand !== 'All') params.set('brand', brand);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (year) params.set('year', year);

    window.location.href = `/cars.html?${params.toString()}`;
  });
}

async function loadHomeInventory() {
  const featuredContainer = document.getElementById('featured-cars-container');
  const recentContainer = document.getElementById('recent-cars-container');

  if (!isSupabaseConfigured()) {
    renderUnconfiguredState(featuredContainer, 'Featured Collection');
    renderUnconfiguredState(recentContainer, 'Recently Added Vehicles');
    return;
  }

  const connCheck = await testSupabaseConnection();
  if (!connCheck.connected) {
    renderDatabaseError(featuredContainer, connCheck.message);
    renderDatabaseError(recentContainer, connCheck.message);
    return;
  }

  try {
    const { data: featuredCars, error: featuredErr } = await fetchFeaturedCars(6);
    if (featuredErr) {
      renderDatabaseError(featuredContainer, featuredErr.message);
    } else if (!featuredCars || featuredCars.length === 0) {
      renderEmptyState(featuredContainer, 'No featured vehicles currently listed. Visit our inventory to browse all cars.');
    } else {
      featuredContainer.innerHTML = featuredCars.map(renderCarCard).join('');
    }
  } catch (err) {
    renderDatabaseError(featuredContainer, err.message);
  }

  try {
    const { data: recentCars, error: recentErr } = await fetchRecentCars(6);
    if (recentErr) {
      renderDatabaseError(recentContainer, recentErr.message);
    } else if (!recentCars || recentCars.length === 0) {
      renderEmptyState(recentContainer, 'No recently added vehicles found in the inventory.');
    } else {
      recentContainer.innerHTML = recentCars.map(renderCarCard).join('');
    }
  } catch (err) {
    renderDatabaseError(recentContainer, err.message);
  }
}

function renderUnconfiguredState(container, title) {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state" style="grid-column: 1 / -1;">
      <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
      <h3>Vehicles Coming Soon</h3>
      <p>Our certified showroom inventory is currently being updated. Please check back shortly or contact our sales team.</p>
      <a href="/contact.html" class="btn btn-secondary btn-sm">Contact Dealership</a>
    </div>
  `;
}

function renderDatabaseError(container, message) {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state" style="grid-column: 1 / -1;">
      <p style="color: var(--text-muted); font-size: 0.95rem;">Unable to load vehicles at this moment. Please refresh the page or visit our contact page.</p>
    </div>
  `;
}

function renderEmptyState(container, message) {
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state" style="grid-column: 1 / -1;">
      <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
      </svg>
      <h3>Inventory Empty</h3>
      <p>${escapeHTML(message)}</p>
      <a href="/admin/add-car.html" class="btn btn-secondary btn-sm">Add First Car in Admin Console</a>
    </div>
  `;
}

function escapeHTML(str) {
  if (typeof str !== 'string') return String(str || '');
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
