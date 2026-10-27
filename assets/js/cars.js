/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * CARS INVENTORY PAGE LOGIC (cars.html)
 */

import { fetchCars } from './supabase-client.js';
import { renderCarCard, initCommonUI } from './common.js';
import { isSupabaseConfigured } from './config.js';

let state = {
  page: 1,
  pageSize: 9,
  brand: '',
  search: '',
  minPrice: '',
  maxPrice: '',
  year: '',
  fuelType: '',
  transmission: '',
  maxKm: '',
  sortBy: 'created_at',
  sortOrder: 'desc',
  totalCount: 0
};

document.addEventListener('DOMContentLoaded', async () => {
  initCommonUI();
  parseURLParams();
  bindFilterInputs();
  await loadCars();
});

function parseURLParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('brand')) state.brand = params.get('brand');
  if (params.get('search')) state.search = params.get('search');
  if (params.get('minPrice')) state.minPrice = params.get('minPrice');
  if (params.get('maxPrice')) state.maxPrice = params.get('maxPrice');
  if (params.get('year')) state.year = params.get('year');
  if (params.get('fuelType')) state.fuelType = params.get('fuelType');
  if (params.get('transmission')) state.transmission = params.get('transmission');
  if (params.get('maxKm')) state.maxKm = params.get('maxKm');
  if (params.get('sort')) {
    const [by, order] = params.get('sort').split('-');
    state.sortBy = by || 'created_at';
    state.sortOrder = order || 'desc';
  }
  syncFormInputs();
}

function syncFormInputs() {
  setInputValue('filter-brand', state.brand);
  setInputValue('filter-search', state.search);
  setInputValue('filter-min-price', state.minPrice);
  setInputValue('filter-max-price', state.maxPrice);
  setInputValue('filter-year', state.year);
  setInputValue('filter-fuel', state.fuelType);
  setInputValue('filter-transmission', state.transmission);
  setInputValue('filter-max-km', state.maxKm);

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.value = `${state.sortBy}-${state.sortOrder}`;
  }
}

function setInputValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || '';
}

function bindFilterInputs() {
  const filterForm = document.getElementById('inventory-filter-form');
  if (filterForm) {
    filterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      applyFilters();
    });
  }

  let searchTimer;
  const searchInput = document.getElementById('filter-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.search = e.target.value.trim();
        state.page = 1;
        loadCars();
      }, 400);
    });
  }

  ['filter-brand', 'filter-year', 'filter-fuel', 'filter-transmission'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => applyFilters());
  });

  const sortSelect = document.getElementById('sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      const [by, order] = e.target.value.split('-');
      state.sortBy = by;
      state.sortOrder = order;
      state.page = 1;
      loadCars();
    });
  }

  document.getElementById('clear-filters-btn')?.addEventListener('click', () => resetFilters());
}

function applyFilters() {
  state.brand = document.getElementById('filter-brand')?.value || '';
  state.search = document.getElementById('filter-search')?.value.trim() || '';
  state.minPrice = document.getElementById('filter-min-price')?.value || '';
  state.maxPrice = document.getElementById('filter-max-price')?.value || '';
  state.year = document.getElementById('filter-year')?.value || '';
  state.fuelType = document.getElementById('filter-fuel')?.value || '';
  state.transmission = document.getElementById('filter-transmission')?.value || '';
  state.maxKm = document.getElementById('filter-max-km')?.value || '';
  state.page = 1;

  updateURL();
  loadCars();
}

function resetFilters() {
  state.brand = '';
  state.search = '';
  state.minPrice = '';
  state.maxPrice = '';
  state.year = '';
  state.fuelType = '';
  state.transmission = '';
  state.maxKm = '';
  state.page = 1;

  syncFormInputs();
  updateURL();
  loadCars();
}

function updateURL() {
  const params = new URLSearchParams();
  if (state.brand) params.set('brand', state.brand);
  if (state.search) params.set('search', state.search);
  if (state.minPrice) params.set('minPrice', state.minPrice);
  if (state.maxPrice) params.set('maxPrice', state.maxPrice);
  if (state.year) params.set('year', state.year);
  if (state.fuelType) params.set('fuelType', state.fuelType);
  if (state.transmission) params.set('transmission', state.transmission);
  if (state.maxKm) params.set('maxKm', state.maxKm);
  params.set('sort', `${state.sortBy}-${state.sortOrder}`);

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', newUrl);
}

async function loadCars() {
  const grid = document.getElementById('cars-grid');
  const countEl = document.getElementById('cars-count');
  const paginationEl = document.getElementById('cars-pagination');
  if (!grid) return;

  grid.innerHTML = `
    <div class="loading-indicator" style="grid-column: 1 / -1;">
      <div class="spinner"></div>
      <p>Searching certified vehicles...</p>
    </div>
  `;

  if (!isSupabaseConfigured()) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <h3>No Vehicles Listed Yet</h3>
        <p>Our pre-owned inventory is being updated. Please check back shortly or contact our team.</p>
        <a href="/contact.html" class="btn btn-secondary btn-sm">Contact Dealership</a>
      </div>
    `;
    if (countEl) countEl.innerHTML = `Showing <strong>0</strong> cars`;
    if (paginationEl) paginationEl.innerHTML = '';
    return;
  }

  try {
    const { data: cars, count, error } = await fetchCars({
      brand: state.brand,
      search: state.search,
      minPrice: state.minPrice,
      maxPrice: state.maxPrice,
      year: state.year,
      fuelType: state.fuelType,
      transmission: state.transmission,
      maxKm: state.maxKm,
      sortBy: state.sortBy,
      sortOrder: state.sortOrder,
      page: state.page,
      pageSize: state.pageSize
    });

    if (error) {
      grid.innerHTML = `
        <div class="error-callout" style="grid-column: 1 / -1;">
          <h4>Error Querying Cars</h4>
          <p>${escapeHTML(error.message)}</p>
        </div>
      `;
      return;
    }

    state.totalCount = count || 0;

    if (countEl) {
      const from = state.totalCount === 0 ? 0 : (state.page - 1) * state.pageSize + 1;
      const to = Math.min(state.page * state.pageSize, state.totalCount);
      countEl.innerHTML = `Showing <strong>${from}-${to}</strong> of <strong>${state.totalCount}</strong> cars`;
    }

    if (!cars || cars.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <h3>No Vehicles Match Your Criteria</h3>
          <p>Try widening your budget or clearing some filters.</p>
          <button type="button" class="btn btn-secondary btn-sm" id="empty-clear-filters-btn">
            Clear All Filters
          </button>
        </div>
      `;
      document.getElementById('empty-clear-filters-btn')?.addEventListener('click', resetFilters);
      if (paginationEl) paginationEl.innerHTML = '';
      return;
    }

    grid.innerHTML = cars.map(renderCarCard).join('');
    renderPagination(paginationEl);
  } catch (err) {
    grid.innerHTML = `
      <div class="error-callout" style="grid-column: 1 / -1;">
        <h4>Failed to connect to database</h4>
        <p>${escapeHTML(err.message)}</p>
      </div>
    `;
  }
}

function renderPagination(container) {
  if (!container) return;
  const totalPages = Math.ceil(state.totalCount / state.pageSize);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `<div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-top: 3rem;">`;
  html += `<button type="button" class="btn btn-secondary btn-sm" ${state.page === 1 ? 'disabled' : ''} id="page-prev-btn">← Previous</button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= state.page - 1 && i <= state.page + 1)) {
      html += `<button type="button" class="btn btn-sm ${i === state.page ? 'btn-primary' : 'btn-secondary'} page-number-btn" data-page="${i}">${i}</button>`;
    } else if (i === state.page - 2 || i === state.page + 2) {
      html += `<span style="padding: 0 0.25rem; color: var(--text-light);">...</span>`;
    }
  }

  html += `<button type="button" class="btn btn-secondary btn-sm" ${state.page === totalPages ? 'disabled' : ''} id="page-next-btn">Next →</button>`;
  html += `</div>`;
  container.innerHTML = html;

  container.querySelector('#page-prev-btn')?.addEventListener('click', () => {
    if (state.page > 1) {
      state.page--;
      loadCars();
      window.scrollTo({ top: 300, behavior: 'smooth' });
    }
  });

  container.querySelector('#page-next-btn')?.addEventListener('click', () => {
    if (state.page < totalPages) {
      state.page++;
      loadCars();
      window.scrollTo({ top: 300, behavior: 'smooth' });
    }
  });

  container.querySelectorAll('.page-number-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = Number(btn.getAttribute('data-page'));
      if (p !== state.page) {
        state.page = p;
        loadCars();
        window.scrollTo({ top: 300, behavior: 'smooth' });
      }
    });
  });
}

function escapeHTML(str) {
  if (typeof str !== 'string') return String(str || '');
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
