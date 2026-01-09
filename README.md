# Mobile Web Video Recorder – Feasibility Spike (React)

## Overview

This project is a feasibility spike demonstrating a React (Vite) mobile web app that:

- Records video via device camera
- Persists recordings in IndexedDB so they survive refreshes and tab closes
- Attempts uploads to Cloudinary (direct browser upload)
- Keeps local copies when uploads fail so recordings are never lost

This is a proof-of-concept (POC) intended to validate feasibility; it is not production-ready out of the box.

---

## What's implemented

- Camera access with `getUserMedia`
- Recording using `MediaRecorder` (webm)
- Local persistence using IndexedDB via the `idb` helper (`src/db.js`)
- Cloud uploads to Cloudinary with robust client-side handling (`src/cloudinary.js`):
  - Progress tracking
  - Retry with exponential backoff
  - Timeout handling
  - File size validation (100MB client-side limit)
- Responsive, polished UI (`src/App.jsx`, `src/App.css`) optimized for mobile/tablet/desktop

---

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file (or use `.env.example`) and set Cloudinary values:

```env
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_preset
VITE_CLOUDINARY_API_KEY=your_api_key_optional
```

3. Run dev server:

```bash
npm run dev
```

4. Open the app on your device or emulator: `http://localhost:3000` (or the network URL shown by Vite)

---

## Deploying to Vercel

This project is ready to be deployed to Vercel as a static Vite app. A `vercel.json` file has been added to configure the build and a SPA rewrite.

Steps:

1. Push your repository to GitHub (or connect your Git provider to Vercel):

```bash
git add .
git commit -m "prepare for vercel"
git push
```

2. Create a new project in Vercel and connect your repository.

3. Vercel should auto-detect the Vite build; if not, set:

- Build command: `npm run build`
- Output directory: `dist`

4. Add environment variables in Vercel Project Settings → Environment Variables:

- `VITE_CLOUDINARY_CLOUD_NAME` = your cloud name
- `VITE_CLOUDINARY_UPLOAD_PRESET` = your unsigned preset

Note: do NOT add your Cloudinary API secret as a `VITE_` variable — keep secrets server-side only if you add serverless functions.

5. Deploy — Vercel will build and publish your app. Use the generated URL for demos.

Optional: If you later add signed uploads, create a serverless function under `api/` and store your `CLOUDINARY_API_SECRET` in Vercel environment variables (no `VITE_` prefix).


## Cloudinary setup (unsigned preset for POC)

This spike uses direct browser uploads to Cloudinary via an unsigned upload preset for speed of implementation.

1. Create a Cloudinary account and go to **Settings → Upload → Upload presets**
2. Create a new preset (e.g. `mobile_video_uploads`) and set **Signing Mode** to **Unsigned** for POC
3. Put the preset name and cloud name into your `.env`

Security note: unsigned uploads are convenient for POC but expose the upload preset to clients. For production, implement signed uploads (backend generates a short-lived signature using your API secret). See the "Signed uploads" section below.

---

## Data model

IndexedDB database: `video-recorder-db` (version 1)

Object store: `videos`

Each video object:

```json
{
  "id": "video-1610000000000",
  "blob": "<Blob>",
  "createdAt": 1610000000000,
  "uploaded": false
}
```

Persistence is implemented in `src/db.js` using `idb` helpers: `saveVideo`, `getVideos`, `deleteVideo`, `updateVideo`.

---

## How upload works in this project

- The app saves the recorded video blob to IndexedDB immediately after stopping the recorder.
- Upload attempts use `src/cloudinary.js` which sends video blobs directly to Cloudinary and updates the local record on success.
- Upload edge cases handled on the client:
  - Offline detection (prevents upload attempts while offline)
  - Network interruption retries (3 attempts with exponential backoff)
  - Upload timeout (5 minutes)
  - Progress tracking (XHR upload progress)

---

## Signed vs Unsigned uploads

- Unsigned (current POC): quick to implement, no backend required, but upload preset is public and anyone can upload to your Cloudinary account.
- Signed (recommended for production): requires a backend endpoint that signs upload requests using your Cloudinary API secret. This keeps secrets off the client and allows authenticated, validated uploads.

If you want, I can scaffold a minimal Node.js endpoint to provide signed upload parameters.

---

## UI / UX

- Responsive layout with a compact recording card on wide screens and full-width layout on mobile
- Polished visuals and micro-interactions in `src/App.css`
- File size and status information visible in the Videos list

---

## Testing checklist (to validate success criteria)

1. Open the app on mobile (Chrome or Safari) or desktop
2. Click "Start Recording" and allow camera/microphone access
3. Record a short clip and click "Stop"
4. Confirm the clip appears in "Saved Videos" (local copy)
5. Attempt upload → inspect progress and behavior
6. Simulate failure: disable network, attempt upload → verify the UI warns and the video stays in local storage
7. Refresh page or close the tab → reopen app and verify the video is still present

---

## Files of interest

- `src/App.jsx` — main UI and app flow
- `src/App.css` — styling (responsive, polished)
- `src/db.js` — IndexedDB helpers
- `src/cloudinary.js` — Cloudinary upload utility (retries, progress, validation)



## Video Preview

Preview the recorded demo on Tella:

- **Link:** https://www.tella.tv/video/irfans-video-at88


