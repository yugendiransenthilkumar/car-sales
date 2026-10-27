/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * REUSABLE VEHICLE FORM CONTROLLER (admin/add-car.html & admin/edit-car.html)
 */

import { insertCar, updateCar, fetchCarById, insertCarImages, deleteCarImages } from './supabase-client.js';
import { uploadVehicleImage, validateImageFile } from './appwrite-client.js';
import { getCurrentUser } from './auth.js';
import { showToast, openRlsFixModal } from './common.js';

let isEditMode = false;
let editingCarId = null;
let existingImages = [];
let newImageFiles = [];
let initialCarSpecs = null;

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('car-form');
  if (!form) return;

  const urlParams = new URLSearchParams(window.location.search);
  editingCarId = urlParams.get('id');
  isEditMode = Boolean(editingCarId);

  initImageDropzone();
  initFormSubmission();

  if (isEditMode) {
    document.title = 'Edit Vehicle | AutoSphere Admin';
    const heading = document.getElementById('form-page-title');
    if (heading) heading.textContent = 'Edit Vehicle Listing';
    await populateExistingCarData(editingCarId);
  }
});

function initImageDropzone() {
  const dropzone = document.getElementById('image-dropzone');
  const fileInput = document.getElementById('image-file-input');

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  ['dragleave', 'dragend'].forEach(type => {
    dropzone.addEventListener(type, () => dropzone.classList.remove('dragover'));
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFilesSelected(e.target.files);
      fileInput.value = '';
    }
  });
}

function handleFilesSelected(fileList) {
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const validation = validateImageFile(file);
    if (!validation.valid) {
      showToast(validation.error, 'danger');
      continue;
    }

    const previewUrl = URL.createObjectURL(file);
    const isFirst = existingImages.length === 0 && newImageFiles.length === 0;

    newImageFiles.push({
      file,
      previewUrl,
      isMain: isFirst
    });
  }

  renderImagePreviews();
}

function renderImagePreviews() {
  const grid = document.getElementById('image-preview-grid');
  if (!grid) return;

  grid.innerHTML = '';

  const totalCount = existingImages.length + newImageFiles.length;

  // RULE: If total number of images is exactly 1, default/automatically make that image as main.
  // Do NOT let the user select it as main manually.
  if (totalCount === 1) {
    if (existingImages.length === 1) {
      existingImages[0].display_order = 0;
    } else if (newImageFiles.length === 1) {
      newImageFiles[0].isMain = true;
    }
  } else if (totalCount > 1) {
    // If there are multiple images, ensure at least one is designated as main
    const hasMainExisting = existingImages.some(img => img.display_order === 0);
    const hasMainNew = newImageFiles.some(item => item.isMain);
    if (!hasMainExisting && !hasMainNew) {
      if (existingImages.length > 0) {
        existingImages[0].display_order = 0;
      } else if (newImageFiles.length > 0) {
        newImageFiles[0].isMain = true;
      }
    }
  }

  // Allow manual selection of main image ONLY when there are 2 or more images
  const allowManualMainSelection = totalCount > 1;

  existingImages.forEach((img, idx) => {
    const isMain = img.display_order === 0;
    const card = document.createElement('div');
    card.className = `preview-card ${isMain ? 'is-main' : ''}`;
    card.innerHTML = `
      <img src="${escapeHTML(img.image_url)}" alt="Existing photo" onerror="this.src='/assets/images/car-placeholder.svg'"/>
      ${isMain ? `<span class="preview-badge-main">${totalCount === 1 ? 'Main Photo' : 'Main'}</span>` : ''}
      <div class="preview-actions">
        ${allowManualMainSelection && !isMain ? `
          <button type="button" class="btn-preview-action set-main-existing-btn" title="Set as Main Photo" data-idx="${idx}">★</button>
        ` : ''}
        <button type="button" class="btn-preview-action remove-existing-btn" title="Delete Photo" data-idx="${idx}">✕</button>
      </div>
    `;
    grid.appendChild(card);
  });

  newImageFiles.forEach((item, idx) => {
    const isMain = Boolean(item.isMain);
    const card = document.createElement('div');
    card.className = `preview-card ${isMain ? 'is-main' : ''}`;
    card.innerHTML = `
      <img src="${escapeHTML(item.previewUrl)}" alt="New photo preview"/>
      ${isMain ? `<span class="preview-badge-main">${totalCount === 1 ? 'Main Photo' : 'Main'}</span>` : ''}
      <div class="preview-actions">
        ${allowManualMainSelection && !isMain ? `
          <button type="button" class="btn-preview-action set-main-new-btn" title="Set as Main Photo" data-idx="${idx}">★</button>
        ` : ''}
        <button type="button" class="btn-preview-action remove-new-btn" title="Remove" data-idx="${idx}">✕</button>
      </div>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('.remove-existing-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.getAttribute('data-idx'));
      existingImages.splice(idx, 1);
      renderImagePreviews();
    });
  });

  grid.querySelectorAll('.set-main-existing-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.getAttribute('data-idx'));
      existingImages.forEach((img, i) => img.display_order = (i === idx ? 0 : i + 1));
      newImageFiles.forEach(item => item.isMain = false);
      renderImagePreviews();
    });
  });

  grid.querySelectorAll('.remove-new-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.getAttribute('data-idx'));
      URL.revokeObjectURL(newImageFiles[idx].previewUrl);
      newImageFiles.splice(idx, 1);
      renderImagePreviews();
    });
  });

  grid.querySelectorAll('.set-main-new-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.getAttribute('data-idx'));
      existingImages.forEach((img, i) => img.display_order = i + 1);
      newImageFiles.forEach((item, i) => item.isMain = (i === idx));
      renderImagePreviews();
    });
  });
}

async function populateExistingCarData(id) {
  try {
    showToast('Loading vehicle details...', 'info', 2000);
    const { data: car, error } = await fetchCarById(id);

    if (error || !car) {
      showToast('Could not find vehicle listing: ' + (error ? error.message : 'Not found'), 'danger');
      return;
    }

    setVal('car-brand', car.brand);
    setVal('car-model', car.model);
    setVal('car-variant', car.variant);
    setVal('car-year', car.manufacturing_year);
    setVal('car-reg-year', car.registration_year);
    setVal('car-price', car.price);
    setVal('car-km', car.kilometres_driven);
    setVal('car-fuel', car.fuel_type);
    setVal('car-transmission', car.transmission);
    setVal('car-ownership', car.ownership_count);
    setVal('car-condition', car.condition);
    setVal('car-status', car.status);
    setVal('car-body-type', car.body_type);
    setVal('car-exterior-color', car.exterior_color);
    setVal('car-seating', car.seating_capacity);
    setVal('car-engine', car.engine_capacity);
    setVal('car-reg-state', car.registration_state);
    setVal('car-insurance-status', car.insurance_status);
    setVal('car-insurance-expiry', car.insurance_expiry);
    setVal('car-service-history', car.service_history);
    setVal('car-accident-history', car.accident_history);
    setVal('car-description', car.description);

    const featCheckbox = document.getElementById('car-featured');
    if (featCheckbox) featCheckbox.checked = Boolean(car.featured);

    initialCarSpecs = {
      brand: car.brand,
      model: car.model,
      variant: car.variant || null,
      manufacturing_year: car.manufacturing_year,
      registration_year: car.registration_year || null,
      price: Number(car.price),
      kilometres_driven: Number(car.kilometres_driven),
      fuel_type: car.fuel_type,
      transmission: car.transmission,
      ownership_count: Number(car.ownership_count),
      condition: car.condition,
      status: car.status,
      body_type: car.body_type || null,
      exterior_color: car.exterior_color || null,
      seating_capacity: car.seating_capacity ? Number(car.seating_capacity) : null,
      engine_capacity: car.engine_capacity || null,
      registration_state: car.registration_state || null,
      insurance_status: car.insurance_status || null,
      insurance_expiry: car.insurance_expiry || null,
      service_history: car.service_history || null,
      accident_history: car.accident_history || null,
      description: car.description,
      featured: Boolean(car.featured)
    };

    if (car.car_images && car.car_images.length > 0) {
      existingImages = [...car.car_images];
      renderImagePreviews();
    }
  } catch (err) {
    showToast('Failed to load vehicle data: ' + err.message, 'danger');
  }
}

function haveSpecsChanged(initial, current) {
  if (!initial) return true;
  for (const key of Object.keys(initial)) {
    const initVal = initial[key] ?? null;
    const currVal = current[key] ?? null;
    if (String(initVal) !== String(currVal)) {
      return true;
    }
  }
  return false;
}


function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = (val !== null && val !== undefined) ? val : '';
}

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function initFormSubmission() {
  const form = document.getElementById('car-form');
  const submitBtn = document.getElementById('submit-car-btn');

  if (!form || !submitBtn) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const brand = getVal('car-brand');
    const model = getVal('car-model');
    const variant = getVal('car-variant') || null;
    const year = Number(getVal('car-year'));
    const regYear = getVal('car-reg-year') ? Number(getVal('car-reg-year')) : null;
    const price = Number(getVal('car-price'));
    const kilometres = Number(getVal('car-km'));
    const fuelType = getVal('car-fuel');
    const transmission = getVal('car-transmission');
    const ownership = Number(getVal('car-ownership')) || 1;
    const condition = getVal('car-condition');
    const status = getVal('car-status') || 'available';
    const bodyType = getVal('car-body-type') || null;
    const exteriorColor = getVal('car-exterior-color') || null;
    const seatingCapacity = getVal('car-seating') ? Number(getVal('car-seating')) : null;
    const engineCapacity = getVal('car-engine') || null;
    const regState = getVal('car-reg-state') || null;
    const insuranceStatus = getVal('car-insurance-status') || null;
    const insuranceExpiry = getVal('car-insurance-expiry') || null;
    const serviceHistory = getVal('car-service-history') || null;
    const accidentHistory = getVal('car-accident-history') || null;
    const description = getVal('car-description');
    const featured = document.getElementById('car-featured')?.checked || false;

    if (!brand || !model || !year || !price || isNaN(kilometres) || !fuelType || !transmission || !condition || !description) {
      showToast('Please fill in all required fields indicated with *', 'danger');
      return;
    }

    if (price <= 0) {
      showToast('Price must be greater than zero.', 'danger');
      return;
    }

    const user = await getCurrentUser();

    const carPayload = {
      brand,
      model,
      variant,
      manufacturing_year: year,
      registration_year: regYear,
      price,
      kilometres_driven: kilometres,
      fuel_type: fuelType,
      transmission,
      ownership_count: ownership,
      condition,
      status,
      body_type: bodyType,
      exterior_color: exteriorColor,
      seating_capacity: seatingCapacity,
      engine_capacity: engineCapacity,
      registration_state: regState,
      insurance_status: insuranceStatus,
      insurance_expiry: insuranceExpiry,
      service_history: serviceHistory,
      accident_history: accidentHistory,
      description,
      featured,
      ...(!isEditMode && user ? { created_by: user.id } : {})
    };

    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <div class="spinner" style="width: 18px; height: 18px; border-width: 2px; border-color: rgba(255,255,255,0.3); border-top-color: #fff;"></div>
      Saving Vehicle & Photos...
    `;

    try {
      let targetCarId = editingCarId;

      if (isEditMode) {
        const specsChanged = haveSpecsChanged(initialCarSpecs, carPayload);
        if (specsChanged) {
          const { data: updated, error: updateErr } = await updateCar(editingCarId, carPayload);
          if (updateErr) {
            if (updateErr.message && (updateErr.message.includes('RLS') || updateErr.message.includes('permitted') || updateErr.message.includes('role'))) {
              setTimeout(() => openRlsFixModal(), 600);
            }
            throw new Error(updateErr.message || 'Database update failed');
          }
          if (updated && updated.id) {
            targetCarId = updated.id;
          }
        }
      } else {
        const { data: inserted, error: insertErr } = await insertCar(carPayload);
        if (insertErr) {
          if (insertErr.message && (insertErr.message.includes('RLS') || insertErr.message.includes('permission') || insertErr.message.includes('role'))) {
            setTimeout(() => openRlsFixModal(), 600);
          }
          throw new Error(insertErr.message || 'Database insert failed');
        }
        targetCarId = inserted.id;
      }

      const uploadedImagesMeta = [];
      let uploadFailures = 0;

      for (let i = 0; i < newImageFiles.length; i++) {
        const item = newImageFiles[i];
        try {
          const uploadRes = await uploadVehicleImage(item.file);
          uploadedImagesMeta.push({
            car_id: targetCarId,
            appwrite_file_id: uploadRes.fileId,
            image_url: uploadRes.imageUrl,
            alt_text: `${year} ${brand} ${model} Photo`,
            display_order: item.isMain ? 0 : (existingImages.length + i + 1)
          });
        } catch (uploadErr) {
          uploadFailures++;
          console.error('Failed to upload image:', uploadErr);
        }
      }

      if (isEditMode) {
        const { error: delErr } = await deleteCarImages(targetCarId);
        if (delErr) {
          console.warn('Could not delete old car images from database:', delErr);
        }
      }

      const allImagesToInsert = [
        ...existingImages.map((img, idx) => ({
          car_id: targetCarId,
          appwrite_file_id: img.appwrite_file_id,
          image_url: img.image_url,
          alt_text: img.alt_text || `${year} ${brand} ${model}`,
          display_order: img.display_order !== undefined ? img.display_order : idx
        })),
        ...uploadedImagesMeta
      ];

      // RULE: If total count of images is 1, strictly enforce display_order = 0 (main)
      if (allImagesToInsert.length === 1) {
        allImagesToInsert[0].display_order = 0;
      }

      if (allImagesToInsert.length > 0) {
        const { error: imgInsertErr } = await insertCarImages(allImagesToInsert);
        if (imgInsertErr) {
          if (imgInsertErr.message && (imgInsertErr.message.includes('RLS') || imgInsertErr.message.includes('policy') || imgInsertErr.message.includes('permission'))) {
            setTimeout(() => openRlsFixModal(), 600);
          }
          throw new Error('Images uploaded to Appwrite, but failed saving to database: ' + imgInsertErr.message);
        }
      }

      if (uploadFailures > 0) {
        showToast(`Vehicle saved! ${uploadFailures} photo(s) failed to upload to Appwrite.`, 'warning', 6000);
      } else {
        showToast(isEditMode ? 'Vehicle updated successfully!' : 'New vehicle listed successfully!', 'success');
      }

      setTimeout(() => {
        window.location.href = '/admin/cars.html';
      }, 1200);

    } catch (err) {
      showToast(err.message || 'Operation failed.', 'danger', 6000);
      submitBtn.disabled = false;
      submitBtn.innerHTML = isEditMode ? 'Save Changes' : 'Publish Vehicle Listing';
    }
  });
}

function escapeHTML(str) {
  if (typeof str !== 'string') return String(str || '');
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
