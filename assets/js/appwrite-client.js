/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * APPWRITE STORAGE CLIENT & IMAGE MANAGEMENT LAYER
 * Uses native browser multipart streaming and REST API for maximum reliability across browsers.
 */

import { CONFIG, isAppwriteConfigured } from './config.js';
import { client } from './appwrite.js';
export { client };

// Browser Buffer polyfill to protect against third-party modules expecting Buffer
if (typeof window !== 'undefined' && typeof window.Buffer === 'undefined') {
  window.Buffer = {
    isBuffer: () => false,
    from: (data) => new Uint8Array(typeof data === 'string' ? new TextEncoder().encode(data) : data),
    alloc: (size) => new Uint8Array(size)
  };
}

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateImageFile(file) {
  if (!file) return { valid: false, error: 'No file selected.' };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, error: `Invalid format "${file.type}". JPEG, PNG, or WebP only.` };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return { valid: false, error: `Image (${sizeMb} MB) exceeds maximum allowed size of 5 MB.` };
  }
  return { valid: true };
}

export function getAppwriteImageUrl(fileId, width, height) {
  if (!fileId) return '/assets/images/car-placeholder.svg';
  if (fileId.startsWith('http://') || fileId.startsWith('https://')) return fileId;
  if (!isAppwriteConfigured()) return '/assets/images/car-placeholder.svg';

  const endpoint = CONFIG.appwriteEndpoint.replace(/\/+$/, '');
  const base = `${endpoint}/storage/buckets/${CONFIG.appwriteBucketId}/files/${fileId}`;
  if (width && height) {
    return `${base}/preview?project=${CONFIG.appwriteProjectId}&width=${width}&height=${height}`;
  }
  return `${base}/view?project=${CONFIG.appwriteProjectId}`;
}

function getAppwriteApiBase() {
  const isDevOrRunApp = window.location.hostname.includes('run.app') || 
                        window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1';
  if (isDevOrRunApp) {
    return '/api/appwrite';
  }
  return CONFIG.appwriteEndpoint.replace(/\/+$/, '');
}

export async function uploadVehicleImage(file, onProgress) {
  const validation = validateImageFile(file);
  if (!validation.valid) throw new Error(validation.error);

  if (!isAppwriteConfigured()) {
    throw new Error('Appwrite Storage is not configured. Configure credentials in assets/js/config.js or via System Setup.');
  }

  const proxyBase = getAppwriteApiBase();
  const directEndpoint = CONFIG.appwriteEndpoint.replace(/\/+$/, '');
  const bucketId = CONFIG.appwriteBucketId;
  const projectId = CONFIG.appwriteProjectId;

  // Try both proxy and direct endpoint in case one is blocked by CORS or host restrictions
  const candidateBases = [proxyBase, directEndpoint].filter((u, i, a) => a.indexOf(u) === i);

  let lastError = null;
  for (const base of candidateBases) {
    // Generate clean unique ID for this upload attempt
    const fileId = 'img_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

    try {
      const uploadUrl = `${base}/storage/buckets/${bucketId}/files`;

      const responseData = await new Promise((resolve, reject) => {
        const formData = new FormData();
        formData.append('fileId', fileId);
        formData.append('file', file);
        formData.append('permissions[]', 'read("any")');

        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl, true);
        xhr.setRequestHeader('X-Appwrite-Project', projectId);

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              onProgress({ progress: percent });
            }
          };
        }

        xhr.onload = () => {
          let json = null;
          try {
            json = JSON.parse(xhr.responseText);
          } catch {
            json = { message: xhr.responseText };
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(json);
          } else {
            const errMsg = json?.message || `Appwrite upload error (HTTP ${xhr.status})`;
            reject(new Error(errMsg));
          }
        };

        xhr.onerror = () => {
          reject(new Error(`Network error connecting to ${uploadUrl}`));
        };

        xhr.send(formData);
      });

      const uploadedId = responseData?.$id || fileId;
      const publicUrl = `${directEndpoint}/storage/buckets/${bucketId}/files/${uploadedId}/view?project=${projectId}`;
      return { fileId: uploadedId, imageUrl: publicUrl };

    } catch (err) {
      lastError = err;
      console.warn(`Appwrite upload attempt to ${base} failed:`, err.message);
      // Try next endpoint candidate
    }
  }

  console.error('All Appwrite upload endpoints failed:', lastError);
  throw new Error(lastError?.message || 'Failed to upload photo to Appwrite Storage.');
}

export async function deleteVehicleImage(fileId) {
  if (!fileId || fileId.startsWith('http://') || fileId.startsWith('https://')) return true;
  if (!isAppwriteConfigured()) return true;

  try {
    const apiBase = getAppwriteApiBase();
    const res = await fetch(`${apiBase}/storage/buckets/${CONFIG.appwriteBucketId}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'X-Appwrite-Project': CONFIG.appwriteProjectId
      }
    });
    return res.ok;
  } catch (err) {
    console.warn(`Failed to delete Appwrite file ${fileId}:`, err);
    return false;
  }
}
