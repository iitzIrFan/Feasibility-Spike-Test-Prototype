// Cloudinary upload utility with edge case handling

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const UPLOAD_TIMEOUT = 5 * 60 * 1000; // 5 minutes
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

/**
 * Check if browser is online
 */
export function isOnline() {
  return navigator.onLine;
}

/**
 * Validate video file before upload
 */
export function validateVideo(blob) {
  const errors = [];
  
  if (!blob || blob.size === 0) {
    errors.push('Video file is empty');
  }
  
  if (blob.size > MAX_FILE_SIZE) {
    errors.push(`Video size (${formatBytes(blob.size)}) exceeds limit (${formatBytes(MAX_FILE_SIZE)})`);
  }
  
  if (!blob.type.startsWith('video/')) {
    errors.push('Invalid file type. Expected video file');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Upload video to Cloudinary with retry logic and progress tracking
 */
export async function uploadToCloudinary(blob, onProgress, retryCount = 0) {
  // Check configuration
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
    throw new Error('Cloudinary credentials not configured. Please check .env file');
  }
  
  // Validate file
  const validation = validateVideo(blob);
  if (!validation.valid) {
    throw new Error(validation.errors.join('. '));
  }
  
  // Check online status
  if (!isOnline()) {
    throw new Error('No internet connection. Video saved locally and will be uploaded when online');
  }

  const formData = new FormData();
  formData.append('file', blob);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('resource_type', 'video');
  
  const uploadUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`;

  try {
    const response = await uploadWithProgress(uploadUrl, formData, onProgress);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Upload failed with status ${response.status}`);
    }

    const result = await response.json();
    return {
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
      cloudinaryResponse: result
    };
    
  } catch (error) {
    // Retry logic for network errors
    if (retryCount < MAX_RETRIES && isRetryableError(error)) {
      console.log(`Upload failed, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
      await sleep(RETRY_DELAY * (retryCount + 1)); // Exponential backoff
      return uploadToCloudinary(blob, onProgress, retryCount + 1);
    }
    
    throw error;
  }
}

/**
 * Upload with XMLHttpRequest to track progress
 */
function uploadWithProgress(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    
    // Set timeout
    xhr.timeout = UPLOAD_TIMEOUT;
    
    // Track upload progress
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        const percentComplete = Math.round((event.loaded / event.total) * 100);
        onProgress(percentComplete);
      }
    });
    
    // Handle completion
    xhr.addEventListener('load', () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        json: async () => JSON.parse(xhr.responseText)
      });
    });
    
    // Handle errors
    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });
    
    xhr.addEventListener('timeout', () => {
      reject(new Error('Upload timeout. Please try again with a shorter video'));
    });
    
    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });
    
    xhr.open('POST', url);
    xhr.send(formData);
  });
}

/**
 * Check if error is retryable
 */
function isRetryableError(error) {
  const retryableMessages = [
    'network error',
    'failed to fetch',
    'timeout',
    'connection',
    'ECONNRESET',
    'ETIMEDOUT'
  ];
  
  const message = error.message.toLowerCase();
  return retryableMessages.some(msg => message.includes(msg));
}

/**
 * Format bytes to human readable
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
