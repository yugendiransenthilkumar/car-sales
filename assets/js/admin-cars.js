/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ADMIN INVENTORY MANAGEMENT (admin/cars.html)
 */

import { fetchCars, updateCarStatus, deleteCar, fetchCarById } from './supabase-client.js';
import { deleteVehicleImage } from './appwrite-client.js';
import { formatINR, formatKM, showToast, showConfirmModal } from './common.js';
import { isSupabaseConfigured } from './config.js';

let state = {
  search: '',
  status: 'All',
  page: 1,
  pageSize: 15,
  totalCount: 0
};

document.addEventListener('DOMContentLoaded', async () => {
  initTableFilters();
  await loadAdminCarsTable();
});

function initTableFilters() {
  const searchInput = document.getElementById('admin-car-search');
  if (searchInput) {
    let timer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        state.search = e.target.value.trim();
        state.page = 1;
        loadAdminCarsTable();
      }, 350);
    });
  }

  const statusFilter = document.getElementById('admin-status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      state.status = e.target.value;
      state.page = 1;
      loadAdminCarsTable();
    });
  }
}

async function loadAdminCarsTable() {
  const tbody = document.getElementById('admin-cars-tbody');
  const countEl = document.getElementById('admin-cars-total-count');
  if (!tbody) return;

  tbody.innerHTML = `
    <tr>
      <td colspan="8" style="text-align: center; padding: 3rem;">
        <div class="spinner" style="margin: 0 auto 0.75rem;"></div>
        <p style="color: var(--text-muted);">Loading dealership inventory...</p>
      </td>
    </tr>
  `;

  if (!isSupabaseConfigured()) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">
          Supabase database is not configured. Enter credentials to manage inventory.
        </td>
      </tr>
    `;
    if (countEl) countEl.textContent = '0';
    return;
  }

  try {
    const { data: cars, count, error } = await fetchCars({
      search: state.search,
      status: state.status,
      page: state.page,
      pageSize: state.pageSize,
      sortBy: 'created_at',
      sortOrder: 'desc'
    });

    if (error) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2rem; color: var(--danger);">
            Database Error: ${escapeHTML(error.message)}
          </td>
        </tr>
      `;
      return;
    }

    state.totalCount = count || 0;
    if (countEl) countEl.textContent = String(state.totalCount);

    if (!cars || cars.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            No vehicles found matching current filter criteria.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = cars.map(car => {
      const thumb = (car.car_images && car.car_images.length > 0)
        ? car.car_images[0].image_url
        : '/assets/images/car-placeholder.svg';

      return `
        <tr data-car-id="${car.id}">
          <td>
            <img src="${escapeHTML(thumb)}" alt="Thumbnail" class="table-thumb" onerror="this.src='/assets/images/car-placeholder.svg'"/>
          </td>
          <td>
            <span style="font-family: monospace; font-weight: 700; color: var(--primary);">
              ${escapeHTML(car.listing_number || 'N/A')}
            </span>
          </td>
          <td>
            <div class="table-car-desc">
              <span class="table-car-name">${escapeHTML(car.manufacturing_year)} ${escapeHTML(car.brand)} ${escapeHTML(car.model)}</span>
              <span class="table-car-variant">${escapeHTML(car.variant || car.fuel_type)}</span>
            </div>
          </td>
          <td>
            <strong style="color: var(--text-main);">${formatINR(car.price)}</strong>
          </td>
          <td>${formatKM(car.kilometres_driven)}</td>
          <td>
            <select class="status-select quick-status-select" data-id="${car.id}">
              <option value="available" ${car.status === 'available' ? 'selected' : ''}>Available</option>
              <option value="reserved" ${car.status === 'reserved' ? 'selected' : ''}>Reserved</option>
              <option value="sold" ${car.status === 'sold' ? 'selected' : ''}>Sold</option>
            </select>
          </td>
          <td>
            <span style="font-size: 0.8rem; color: var(--text-muted);">
              ${new Date(car.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </td>
          <td>
            <div class="table-actions">
              <a href="/car-details.html?id=${car.id}" target="_blank" class="btn-icon" title="View Public Listing">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </a>
              <a href="/admin/edit-car.html?id=${car.id}" class="btn-icon" title="Edit Vehicle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </a>
              <button type="button" class="btn-icon btn-icon-danger delete-car-btn" data-id="${car.id}" data-title="${escapeHTML(car.manufacturing_year + ' ' + car.brand + ' ' + car.model)}" title="Delete Vehicle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    bindTableEvents();
  } catch (err) {
    console.error('Failed to load admin cars:', err);
  }
}

function bindTableEvents() {
  document.querySelectorAll('.quick-status-select').forEach(select => {
    select.addEventListener('change', async () => {
      const id = select.getAttribute('data-id');
      const newStatus = select.value;
      try {
        await updateCarStatus(id, newStatus);
        showToast(`Vehicle status changed to ${newStatus.toUpperCase()}`, 'success');
      } catch (err) {
        showToast('Failed to update status: ' + err.message, 'danger');
        loadAdminCarsTable();
      }
    });
  });

  document.querySelectorAll('.delete-car-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const title = btn.getAttribute('data-title');

      const confirmed = await showConfirmModal({
        title: 'Delete Vehicle Listing',
        message: `Are you sure you want to permanently delete "${title}"? This will delete the listing and remove associated photographs from storage.`,
        confirmText: 'Delete Listing',
        cancelText: 'Keep Vehicle',
        isDanger: true
      });

      if (!confirmed) return;

      try {
        btn.disabled = true;
        showToast('Deleting vehicle...', 'info');

        const { data: carData } = await fetchCarById(id);
        const imagesToDelete = (carData && carData.car_images) ? carData.car_images : [];

        const { error: dbError } = await deleteCar(id);
        if (dbError) throw new Error('Database deletion failed: ' + dbError.message);

        for (const img of imagesToDelete) {
          if (img.appwrite_file_id) {
            await deleteVehicleImage(img.appwrite_file_id);
          }
        }

        showToast('Vehicle and photos deleted successfully.', 'success');
        loadAdminCarsTable();
      } catch (err) {
        showToast(err.message || 'Failed to delete vehicle', 'danger');
        btn.disabled = false;
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
