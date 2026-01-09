import { openDB } from 'idb';

const DB_NAME = 'video-recorder-db';
const DB_VERSION = 1;
const STORE_NAME = 'videos';

/**
 * Initialize and open the IndexedDB database
 */
export const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains(STORE_NAME)) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    }
  },
});

/**
 * Save a video to IndexedDB
 * @param {Blob} blob - Video blob
 * @returns {Promise<string>} - Video ID
 */
export async function saveVideo(blob) {
  const db = await dbPromise;
  const id = `video-${Date.now()}`;
  
  const video = {
    id,
    blob,
    createdAt: Date.now(),
    uploaded: false,
  };

  await db.put(STORE_NAME, video);
  return id;
}

/**
 * Get all videos from IndexedDB
 * @returns {Promise<Array>} - Array of video objects
 */
export async function getVideos() {
  const db = await dbPromise;
  return db.getAll(STORE_NAME);
}

/**
 * Delete a video from IndexedDB
 * @param {string} id - Video ID
 */
export async function deleteVideo(id) {
  const db = await dbPromise;
  await db.delete(STORE_NAME, id);
}

/**
 * Update video upload status
 * @param {string} id - Video ID
 * @param {boolean} uploaded - Upload status
 */
export async function updateVideo(id, uploaded) {
  const db = await dbPromise;
  const video = await db.get(STORE_NAME, id);
  if (video) {
    video.uploaded = uploaded;
    await db.put(STORE_NAME, video);
  }
}
