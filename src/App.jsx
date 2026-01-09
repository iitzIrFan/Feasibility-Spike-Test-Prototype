import { useState, useRef, useEffect } from 'react';
import { saveVideo, getVideos, deleteVideo, updateVideo } from './db';
import { uploadToCloudinary, isOnline } from './cloudinary';

function App() {
  const [recording, setRecording] = useState(false);
  const [videos, setVideos] = useState([]);
  const [stream, setStream] = useState(null);
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState({});
  const [online, setOnline] = useState(navigator.onLine);
  const [cameraError, setCameraError] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  // Load videos from IndexedDB on mount
  useEffect(() => {
    loadVideos();
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Stop stream when unmounting
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  async function loadVideos() {
    const storedVideos = await getVideos();
    setVideos(storedVideos);
  }

  async function startRecording() {
    try {
      setCameraError(null);
      
      // Request camera and microphone access
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true,
      });

      setStream(mediaStream);
      
      // Show preview
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Initialize MediaRecorder
      const mediaRecorder = new MediaRecorder(mediaStream, {
        mimeType: 'video/webm',
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        setRecordingTime(0);
        
        // Combine chunks into single blob
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        
        // CRITICAL: Save to IndexedDB BEFORE upload attempt
        await saveVideo(blob);
        
        // Reload video list
        await loadVideos();
        
        // Clean up
        chunksRef.current = [];
        mediaStream.getTracks().forEach(track => track.stop());
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }
        setStream(null);
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setRecording(true);
      
      // Start timer
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing camera:', error);
      setCameraError(error.message);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  async function uploadVideo(id) {
    // Check online status first
    if (!isOnline()) {
      alert('You are offline. Video is saved locally and will be available when you reconnect.');
      return;
    }

    setUploadingId(id);
    setUploadProgress({ ...uploadProgress, [id]: 0 });
    
    try {
      // Get video from IndexedDB
      const videoList = await getVideos();
      const video = videoList.find(v => v.id === id);
      
      if (!video) {
        throw new Error('Video not found in local storage');
      }

      // Upload to Cloudinary with progress tracking
      const result = await uploadToCloudinary(
        video.blob,
        (progress) => {
          setUploadProgress({ ...uploadProgress, [id]: progress });
        }
      );

      if (result.success) {
        // Upload succeeded - mark as uploaded
        await updateVideo(id, true);
        await loadVideos();
        setUploadProgress({ ...uploadProgress, [id]: 100 });
        
        alert(`Upload successful! Video URL: ${result.url}`);
        console.log('Cloudinary response:', result.cloudinaryResponse);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      
      // User-friendly error messages
      let errorMessage = 'Upload failed: ';
      
      if (error.message.includes('not configured')) {
        errorMessage += 'Cloudinary not configured. Please check .env file';
      } else if (error.message.includes('No internet')) {
        errorMessage += 'No internet connection';
      } else if (error.message.includes('timeout')) {
        errorMessage += 'Upload took too long. Try a shorter video';
      } else if (error.message.includes('exceeds limit')) {
        errorMessage += error.message;
      } else {
        errorMessage += error.message || 'Unknown error';
      }
      
      errorMessage += '\n\nVideo is saved locally and you can retry later.';
      alert(errorMessage);
    } finally {
      setUploadingId(null);
      // Clear progress after 2 seconds
      setTimeout(() => {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[id];
          return newProgress;
        });
      }, 2000);
    }
  }

  async function handleDelete(id) {
    if (confirm('Delete this video?')) {
      await deleteVideo(id);
      await loadVideos();
    }
  }

  function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
  }

  return (
    <div className="app">
      {/* Animated Background */}
      <div className="bg-gradient"></div>
      <div className="bg-pattern"></div>
      
      <header className="header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="20" fill="url(#gradient)" />
                <path d="M16 14 L28 20 L16 26 Z" fill="white" />
                <defs>
                  <linearGradient id="gradient" x1="0" y1="0" x2="40" y2="40">
                    <stop offset="0%" stopColor="#667eea" />
                    <stop offset="100%" stopColor="#764ba2" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <div>
              <h1 className="title">VideoVault</h1>
              <p className="subtitle">Never lose a recording again</p>
            </div>
          </div>
          
          {!online && (
            <div className="status-badge offline">
              <span className="status-dot"></span>
              Offline Mode
            </div>
          )}
          {/* Connected badge removed */}

          
        </div>
      </header>

      <main className="main-content">
        {/* Recording Section */}
        <section className="recording-section glass-card">
          <div className="card-header">
            <h2 className="section-title">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <circle cx="10" cy="10" r="8" fill="currentColor" opacity="0.2"/>
                <circle cx="10" cy="10" r="4" fill="currentColor"/>
              </svg>
              Record Video
            </h2>
            {recording && (
              <div className="recording-indicator">
                <span className="rec-dot"></span>
                <span className="rec-time">{formatTime(recordingTime)}</span>
              </div>
            )}
          </div>
          
          <div className="video-container">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`preview ${recording ? 'recording' : ''}`}
            />
            {!stream && !cameraError && (
              <div className="video-placeholder">
                <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                  <circle cx="32" cy="32" r="32" fill="currentColor" opacity="0.1"/>
                  <path d="M24 20 L24 44 L44 32 Z" fill="currentColor" opacity="0.3"/>
                </svg>
                <p>Ready to record</p>
              </div>
            )}
            {cameraError && (
              <div className="error-placeholder">
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="24" fill="currentColor" opacity="0.1"/>
                  <path d="M24 16 L24 28 M24 32 L24 34" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                </svg>
                <p>Camera access denied</p>
                <span>{cameraError}</span>
              </div>
            )}
          </div>
          
          <div className="controls">
            {!recording ? (
              <button onClick={startRecording} className="btn btn-primary btn-large">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <circle cx="10" cy="10" r="8"/>
                </svg>
                Start Recording
              </button>
            ) : (
              <button onClick={stopRecording} className="btn btn-danger btn-large">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <rect x="5" y="5" width="10" height="10" rx="2"/>
                </svg>
                Stop Recording
              </button>
            )}
          </div>
        </section>

        {/* Saved Videos Section */}
        <section className="videos-section glass-card">
          <div className="card-header">
            <h2 className="section-title">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <rect x="2" y="4" width="16" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                <circle cx="7" cy="9" r="1.5" fill="currentColor"/>
              </svg>
              Saved Videos
              <span className="video-count">{videos.length}</span>
            </h2>
          </div>
          
          {videos.length === 0 ? (
            <div className="empty-state">
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                <circle cx="40" cy="40" r="40" fill="currentColor" opacity="0.05"/>
                <path d="M30 25 L30 55 L55 40 Z" fill="currentColor" opacity="0.2"/>
              </svg>
              <h3>No videos yet</h3>
              <p>Start recording to create your first video</p>
            </div>
          ) : (
            <div className="video-grid">
              {videos.map((video) => (
                <div key={video.id} className="video-card">
                  <div className="video-preview-wrapper">
                    <video
                      src={URL.createObjectURL(video.blob)}
                      controls
                      className="video-player"
                    />
                    <div className="video-overlay">
                      <div className={`status-badge-small ${video.uploaded ? 'success' : 'pending'}`}>
                        {video.uploaded ? (
                          <>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                              <path d="M2 6 L5 9 L10 3" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round"/>
                            </svg>
                            Uploaded
                          </>
                        ) : (
                          <>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                              <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                            </svg>
                            Local
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="video-details">
                    <div className="video-meta">
                      <span className="video-date">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                          <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.2"/>
                          <path d="M7 3 L7 7 L10 7" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
                        </svg>
                        {formatDate(video.createdAt)}
                      </span>
                      <span className="video-size">
                        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                          <rect x="3" y="3" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1.2"/>
                        </svg>
                        {(video.blob.size / (1024 * 1024)).toFixed(2)} MB
                      </span>
                    </div>
                    
                    {/* Upload Progress Bar */}
                    {uploadProgress[video.id] !== undefined && (
                      <div className="progress-wrapper">
                        <div className="progress-bar-modern">
                          <div 
                            className="progress-fill-modern" 
                            style={{ width: `${uploadProgress[video.id]}%` }}
                          >
                            <div className="progress-shine"></div>
                          </div>
                        </div>
                        <span className="progress-percentage">{uploadProgress[video.id]}%</span>
                      </div>
                    )}
                    
                    <div className="video-actions">
                      {!video.uploaded && (
                        <button
                          onClick={() => uploadVideo(video.id)}
                          disabled={uploadingId === video.id || !online}
                          className="btn btn-upload"
                          title={!online ? 'Cannot upload while offline' : ''}
                        >
                          {uploadingId === video.id ? (
                            <>
                              <svg className="spinner" width="16" height="16" viewBox="0 0 16 16" fill="none">
                                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.3"/>
                                <path d="M8 2 A6 6 0 0 1 14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              </svg>
                              Uploading...
                            </>
                          ) : (
                            <>
                              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 2 L8 10 M5 7 L8 2 L11 7" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                <path d="M3 12 L13 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                              </svg>
                              Upload to Cloud
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(video.id)}
                        className="btn btn-delete-icon"
                        disabled={uploadingId === video.id}
                        title="Delete video"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M3 5 L13 5 M5 5 L5 13 L11 13 L11 5 M6 2 L10 2" stroke="currentColor" fill="none" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
