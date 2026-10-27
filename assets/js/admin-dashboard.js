/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ADMIN DASHBOARD OVERVIEW CONTROLLER (admin/dashboard.html)
 */

import { fetchAdminStats, fetchRecentCars } from './supabase-client.js';
import { formatINR, formatKM, showToast } from './common.js';
import { isSupabaseConfigured } from './config.js';

document.addEventListener('DOMContentLoaded', async () => {
  await loadDashboardMetrics();
  await loadRecentInventoryTable();
});

async function loadDashboardMetrics() {
  if (!isSupabaseConfigured()) {
    updateMetric('metric-total', '0');
    updateMetric('metric-available', '0');
    updateMetric('metric-reserved', '0');
    updateMetric('metric-sold', '0');
    updateMetric('metric-valuation', '₹0');
    return;
  }

  try {
    const stats = await fetchAdminStats();
    if (stats.error) {
      showToast('Error loading stats: ' + stats.error.message, 'danger');
      return;
    }

    updateMetric('metric-total', stats.total);
    updateMetric('metric-available', stats.available);
    updateMetric('metric-reserved', stats.reserved);
    updateMetric('metric-sold', stats.sold);
    updateMetric('metric-valuation', formatINR(stats.totalValuation));
  } catch (err) {
    console.error('Failed to load admin stats:', err);
  }
}

function updateMetric(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = String(value);
}

async function loadRecentInventoryTable() {
  const tbody = document.getElementById('recent-cars-tbody');
  if (!tbody) return;

  if (!isSupabaseConfigured()) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
          Supabase is not configured yet. Configure credentials to load live inventory.
        </td>
      </tr>
    `;
    return;
  }

  try {
    const { data: cars, error } = await fetchRecentCars(5);

    if (error) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem; color: var(--danger);">
            Error loading recent cars: ${escapeHTML(error.message)}
          </td>
        </tr>
      `;
      return;
    }

    if (!cars || cars.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">
            No vehicles listed in inventory yet. Click "Add New Car" to create your first listing.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = cars.map(car => {
      const thumb = (car.car_images && car.car_images.length > 0)
        ? car.car_images[0].image_url
        : '/assets/images/car-placeholder.svg';

      const statusBadge = car.status === 'available'
        ? `<span class="badge badge-available">Available</span>`
        : car.status === 'reserved'
        ? `<span class="badge badge-reserved">Reserved</span>`
        : `<span class="badge badge-sold">Sold</span>`;

      return `
        <tr>
          <td>
            <img src="${escapeHTML(thumb)}" alt="Thumb" class="table-thumb" onerror="this.src='/assets/images/car-placeholder.svg'"/>
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
          <td>${statusBadge}</td>
          <td>
            <div class="table-actions">
              <a href="/car-details.html?id=${car.id}" target="_blank" class="btn-icon" title="View Public Page">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </a>
              <a href="/admin/edit-car.html?id=${car.id}" class="btn-icon" title="Edit Vehicle">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </a>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load recent table:', err);
  }
}

function escapeHTML(str) {
  if (typeof str !== 'string') return String(str || '');
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
