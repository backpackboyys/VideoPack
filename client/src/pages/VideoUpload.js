import React, { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import '../App.css';

const MAX_FILE_SIZE = 5000000000;
const FFMPEG_CORE_VERSION = '0.12.10';
const FFMPEG_CORE_BASE_URL = `https://unpkg.com/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/umd`;

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, unitIndex);
  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function getOutputName(fileName) {
  const nameWithoutExtension = fileName.replace(/\.[^/.]+$/, '');
  const safeName = nameWithoutExtension.replace(/[^a-zA-Z0-9_-]/g, '-');
  return `${safeName || 'video'}-compressed.mp4`;
}

function VideoUpload({ user }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoType, setVideoType] = useState('free');
  const [price, setPrice] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const ffmpegRef = useRef(null);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('video/')) {
      setError('Please select a valid video file');
      setFile(null);
      return;
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('File size must be less than 5GB');
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setError('');
    setSuccess('');
    setStatusMessage('');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('dragover');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) handleFileChange({ target: { files: [droppedFile] } });
  };

  const loadFfmpeg = async () => {
    if (ffmpegRef.current) return ffmpegRef.current;

    const ffmpeg = new FFmpeg();
    ffmpeg.on('progress', ({ progress }) => {
      setCompressionProgress(Math.min(100, Math.round(progress * 100)));
    });

    setStatusMessage('Loading browser video compressor...');

    await ffmpeg.load({
      coreURL: await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm')
    });

    ffmpegRef.current = ffmpeg;
    return ffmpeg;
  };

  const compressVideo = async (inputFile) => {
    const ffmpeg = await loadFfmpeg();
    const inputName = `input-${Date.now()}-${inputFile.name.replace(/[^a-zA-Z0-9._-]/g, '-')}`;
    const outputName = getOutputName(inputFile.name);

    setCompressionProgress(0);
    setStatusMessage('Compressing video in your browser...');

    await ffmpeg.writeFile(inputName, await fetchFile(inputFile));

    await ffmpeg.exec([
      '-i', inputName,
      '-vf', "scale=w='min(1280,iw)':h=-2:force_original_aspect_ratio=decrease",
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '31',
      '-c:a', 'aac',
      '-b:a', '64k',
      '-ac', '2',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      '-y', outputName
    ]);

    const outputData = await ffmpeg.readFile(outputName);
    const compressedFile = new File([outputData], outputName, { type: 'video/mp4' });

    await ffmpeg.deleteFile(inputName).catch(() => {});
    await ffmpeg.deleteFile(outputName).catch(() => {});

    return compressedFile;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setStatusMessage('');
    setCompressionProgress(0);
    setUploadProgress(0);

    if (!title || !file) {
      setError('Title and video file are required');
      return;
    }

    if (videoType !== 'free' && !price) {
      setError('Price is required for paid videos');
      return;
    }

    setUploading(true);

    try {
      const compressedFile = await compressVideo(file);
      const useCompressedFile = compressedFile.size < file.size;
      const fileToUpload = useCompressedFile ? compressedFile : file;
      const savedBytes = file.size - fileToUpload.size;
      const savedPercentage = Math.max(0, Math.round((savedBytes / file.size) * 100));

      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('videoType', videoType);
      formData.append('price', price || 0);
      formData.append('video', fileToUpload);

      setStatusMessage(
        useCompressedFile
          ? `Compression complete: ${formatBytes(file.size)} to ${formatBytes(fileToUpload.size)} (${savedPercentage}% smaller). Uploading...`
          : 'The original file was already smaller than the compressed version. Uploading the original file...'
      );

      const token = localStorage.getItem('token');

      await axios.post('/api/videos/upload', formData, {
        headers: { Authorization: `Bearer ${token}` },
        onUploadProgress: (progressEvent) => {
          if (!progressEvent.total) return;
          setUploadProgress(Math.round((progressEvent.loaded * 100) / progressEvent.total));
        }
      });

      setSuccess('Video uploaded successfully! Awaiting moderation approval.');
      setStatusMessage('');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      console.error('Browser compression/upload error:', err);
      setError(
        err.response?.data?.error ||
          'Video compression or upload failed. Please try a smaller video or a supported format.'
      );
      setStatusMessage('');
    } finally {
      setUploading(false);
      setCompressionProgress(0);
      setUploadProgress(0);
    }
  };

  const currentProgress = statusMessage.includes('Uploading') ? uploadProgress : compressionProgress;

  return (
    <>
      <nav className="navbar">
        <h1>Video Platform</h1>
        <div className="navbar-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/gallery">Browse Videos</Link>
          <Link to="/profile">Profile</Link>
        </div>
      </nav>

      <div className="container">
        <div className="form-container">
          <h2>Upload Video</h2>
          {error && <div className="error">{error}</div>}
          {success && <div className="success">{success}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Video Title:</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter video title" required disabled={uploading} />
            </div>

            <div className="form-group">
              <label>Description:</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Enter video description (optional)" rows="4" disabled={uploading} />
            </div>

            <div className="form-group">
              <label>Video Type:</label>
              <select value={videoType} onChange={(e) => setVideoType(e.target.value)} disabled={uploading}>
                <option value="free">Free</option>
                <option value="premium">Premium</option>
                <option value="pay-per-view">Pay-Per-View</option>
              </select>
            </div>

            {videoType !== 'free' && (
              <div className="form-group">
                <label>Price ($):</label>
                <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Enter price" step="0.01" min="0.99" disabled={uploading} />
              </div>
            )}

            <div className="upload-area" onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => document.getElementById('fileInput').click()}>
              <div className="icon">📹</div>
              <p>Click to upload or drag and drop</p>
              <p style={{ fontSize: '12px' }}>MP4, WebM, or MOV (Max 5GB)</p>
              {file && <p style={{ color: '#4CAF50', marginTop: '10px' }}>📁 {file.name} ({formatBytes(file.size)})</p>}
            </div>

            <input id="fileInput" type="file" accept="video/*" onChange={handleFileChange} style={{ display: 'none' }} disabled={uploading} />

            {uploading && (
              <div>
                <p>{statusMessage || 'Preparing video...'} {currentProgress}%</p>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${currentProgress}%` }}></div>
                </div>
              </div>
            )}

            <button type="submit" className="btn" disabled={uploading || !file}>
              {uploading ? 'Processing video...' : 'Upload Video'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default VideoUpload;
