/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * CAR DETAILS PAGE LOGIC (car-details.html)
 */

import { fetchCarById, fetchRelatedCars } from './supabase-client.js';
import { formatINR, formatKM, renderCarCard, initiateWhatsAppEnquiry, initCommonUI } from './common.js';
import { isSupabaseConfigured } from './config.js';

let currentCar = null;

document.addEventListener('DOMContentLoaded', async () => {
  initCommonUI();
  
  const params = new URLSearchParams(window.location.search);
  const carId = params.get('id');

  if (!carId) {
    renderError('No vehicle specified. Please select a car from our inventory.');
    return;
  }

  await loadCarDetails(carId);
});

async function loadCarDetails(id) {
  const container = document.getElementById('car-details-container');
  if (!container) return;

  if (!isSupabaseConfigured()) {
    renderError('Supabase is not configured yet. Configure credentials to view vehicle details.');
    return;
  }

  try {
    const { data: car, error } = await fetchCarById(id);

    if (error || !car) {
      renderError(error ? error.message : 'This vehicle listing does not exist or has been removed.');
      return;
    }

    currentCar = car;
    document.title = `${car.manufacturing_year} ${car.brand} ${car.model} | AutoSphere`;

    renderVehicleView(car);
    loadRelatedInventory(car);
  } catch (err) {
    renderError(err.message || 'Error connecting to database.');
  }
}

function renderVehicleView(car) {
  const container = document.getElementById('car-details-container');
  if (!container) return;

  const images = (car.car_images && car.car_images.length > 0)
    ? car.car_images
    : [{ image_url: '/assets/images/car-placeholder.svg', alt_text: 'Vehicle Photo' }];

  const primaryImage = images[0].image_url;
  const isSold = car.status === 'sold';
  const isReserved = car.status === 'reserved';

  const statusBadge = car.status === 'available'
    ? `<span class="badge badge-available">Available in Showroom</span>`
    : isReserved
    ? `<span class="badge badge-reserved">Reserved by Customer</span>`
    : `<span class="badge badge-sold">Sold Out</span>`;

  const specs = [];
  if (car.manufacturing_year) specs.push({ label: 'Manufacturing Year', value: car.manufacturing_year });
  if (car.registration_year) specs.push({ label: 'Registration Year', value: car.registration_year });
  if (car.kilometres_driven !== null && car.kilometres_driven !== undefined) specs.push({ label: 'Kilometres Driven', value: formatKM(car.kilometres_driven) });
  if (car.fuel_type) specs.push({ label: 'Fuel Type', value: car.fuel_type });
  if (car.transmission) specs.push({ label: 'Transmission', value: car.transmission });
  if (car.ownership_count) specs.push({ label: 'Ownership', value: `${car.ownership_count} Owner${car.ownership_count > 1 ? 's' : ''}` });
  if (car.condition) specs.push({ label: 'Overall Condition', value: car.condition });
  if (car.body_type) specs.push({ label: 'Body Style', value: car.body_type });
  if (car.exterior_color) specs.push({ label: 'Exterior Color', value: car.exterior_color });
  if (car.seating_capacity) specs.push({ label: 'Seating Capacity', value: `${car.seating_capacity} Seats` });
  if (car.engine_capacity) specs.push({ label: 'Engine Capacity', value: car.engine_capacity });
  if (car.registration_state) specs.push({ label: 'Registration State', value: car.registration_state });
  if (car.insurance_status) specs.push({ label: 'Insurance Type', value: car.insurance_status });
  if (car.insurance_expiry) specs.push({ label: 'Insurance Expiry', value: new Date(car.insurance_expiry).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) });
  if (car.service_history) specs.push({ label: 'Service Record', value: car.service_history });
  if (car.accident_history) specs.push({ label: 'Accident History', value: car.accident_history });

  container.innerHTML = `
    <div class="car-details-grid">
      <div class="gallery-container">
        <div class="main-image-viewport">
          <img 
            id="detail-main-img" 
            src="${escapeHTML(primaryImage)}" 
            alt="${escapeHTML(car.brand)} ${escapeHTML(car.model)}" 
            onerror="this.src='/assets/images/car-placeholder.svg'"
          />
        </div>

        ${images.length > 1 ? `
          <div class="gallery-thumbnails">
            ${images.map((img, idx) => `
              <button type="button" class="thumbnail-btn ${idx === 0 ? 'active' : ''}" data-src="${escapeHTML(img.image_url)}">
                <img src="${escapeHTML(img.image_url)}" alt="Thumbnail ${idx + 1}" onerror="this.src='/assets/images/car-placeholder.svg'"/>
              </button>
            `).join('')}
          </div>
        ` : ''}

        <div class="specs-section" style="margin-top: 2rem;">
          <h3 style="font-size: 1.35rem; font-weight: 800; margin-bottom: 0.75rem;">Vehicle Overview & Dealer Notes</h3>
          <div style="background-color: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 1.5rem; line-height: 1.7; color: var(--text-muted); font-size: 0.95rem; white-space: pre-line;">
            ${escapeHTML(car.description || 'No detailed description provided.')}
          </div>
        </div>

        <div class="specs-section">
          <h3 style="font-size: 1.35rem; font-weight: 800; margin-bottom: 0.5rem;">Technical Specifications & Verification</h3>
          <div class="specs-grid">
            ${specs.map(spec => `
              <div class="spec-card">
                <div class="spec-card-label">${escapeHTML(spec.label)}</div>
                <div class="spec-card-value">${escapeHTML(String(spec.value))}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="detail-purchase-box">
        <div class="detail-brand-badge">${escapeHTML(car.brand)}</div>
        <h1 class="detail-title">${escapeHTML(car.brand)} ${escapeHTML(car.model)}</h1>
        <div style="font-size: 1.1rem; color: var(--text-muted); font-weight: 600; margin-bottom: 0.35rem;">
          ${escapeHTML(car.variant || car.body_type || '')}
        </div>
        <div class="detail-listing-number">Listing #${escapeHTML(car.listing_number || 'N/A')}</div>

        <div style="margin-bottom: 1.25rem;">
          ${statusBadge}
        </div>

        <div class="detail-price-box">
          <div class="detail-price-label">Dealership Fixed Price</div>
          <div class="detail-price">${formatINR(car.price)}</div>
        </div>

        <div class="detail-cta-block">
          <button 
            type="button" 
            id="detail-whatsapp-btn" 
            class="btn ${isSold ? 'btn-secondary btn-disabled' : 'btn-whatsapp'} btn-lg" 
            style="width: 100%;"
            ${isSold ? 'disabled' : ''}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.455 5.711 1.456h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            ${isSold ? 'Vehicle Sold' : 'Buy Now via WhatsApp'}
          </button>
          
          <a href="/contact.html" class="btn btn-secondary btn-md" style="width: 100%;">
            Schedule Showroom Visit
          </a>
        </div>
      </div>
    </div>
  `;

  const mainImg = document.getElementById('detail-main-img');
  const thumbs = container.querySelectorAll('.thumbnail-btn');
  thumbs.forEach(btn => {
    btn.addEventListener('click', () => {
      thumbs.forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      const src = btn.getAttribute('data-src');
      if (mainImg && src) mainImg.src = src;
    });
  });

  const waBtn = document.getElementById('detail-whatsapp-btn');
  if (waBtn && !isSold) {
    waBtn.addEventListener('click', () => initiateWhatsAppEnquiry(car));
  }
}

async function loadRelatedInventory(currentCar) {
  const container = document.getElementById('related-cars-grid');
  if (!container) return;

  try {
    const { data: related, error } = await fetchRelatedCars(currentCar.id, currentCar.brand, currentCar.price, 3);
    if (error || !related || related.length === 0) {
      container.innerHTML = `
        <p style="grid-column: 1 / -1; color: var(--text-muted); font-size: 0.95rem;">
          No related cars from ${escapeHTML(currentCar.brand)} at this time. <a href="/cars.html" style="color: var(--primary); font-weight: 700;">Explore our full inventory →</a>
        </p>
      `;
      return;
    }
    container.innerHTML = related.map(renderCarCard).join('');
  } catch (err) {
    console.warn('Could not load related cars:', err);
  }
}

function renderError(message) {
  const container = document.getElementById('car-details-container');
  if (!container) return;

  container.innerHTML = `
    <div class="empty-state">
      <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="15" y1="9" x2="9" y2="15"/>
        <line x1="9" y1="9" x2="15" y2="15"/>
      </svg>
      <h3>Vehicle Unavailable</h3>
      <p>${escapeHTML(message)}</p>
      <a href="/cars.html" class="btn btn-primary btn-md">Browse Available Cars</a>
    </div>
  `;
}

function escapeHTML(str) {
  if (typeof str !== 'string') return String(str || '');
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
