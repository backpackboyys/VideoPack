import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import '../App.css';

function VideoUpload({ user }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoType, setVideoType] = useState('free');
  const [price, setPrice] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 5000000000) {
        setError('File size must be less than 5GB');
        return;
      }
      setFile(selectedFile);
      setError('');
    }
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
    if (droppedFile) {
      handleFileChange({ target: { files: [droppedFile] } });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!title || !file) {
      setError('Title and video file are required');
      return;
    }

    if (videoType !== 'free' && !price) {
      setError('Price is required for paid videos');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('title', title);
    formData.append('description', description);
    formData.append('videoType', videoType);
    formData.append('price', price || 0);
    formData.append('video', file);

    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/videos/upload', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setProgress(percentCompleted);
        }
      });

      setSuccess('Video uploaded successfully! Awaiting moderation approval.');
      setTimeout(() => {
        navigate('/dashboard');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

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
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter video title"
                required
                disabled={uploading}
              />
            </div>

            <div className="form-group">
              <label>Description:</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter video description (optional)"
                rows="4"
                disabled={uploading}
              />
            </div>

            <div className="form-group">
              <label>Video Type:</label>
              <select
                value={videoType}
                onChange={(e) => setVideoType(e.target.value)}
                disabled={uploading}
              >
                <option value="free">Free</option>
                <option value="premium">Premium</option>
                <option value="pay-per-view">Pay-Per-View</option>
              </select>
            </div>

            {videoType !== 'free' && (
              <div className="form-group">
                <label>Price ($):</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Enter price"
                  step="0.01"
                  min="0.99"
                  disabled={uploading}
                />
              </div>
            )}

            <div
              className="upload-area"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('fileInput').click()}
            >
              <div className="icon">📹</div>
              <p>Click to upload or drag and drop</p>
              <p style={{ fontSize: '12px' }}>MP4, WebM, or MOV (Max 5GB)</p>
              {file && <p style={{ color: '#4CAF50', marginTop: '10px' }}>📁 {file.name}</p>}
            </div>
            <input
              id="fileInput"
              type="file"
              accept="video/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              disabled={uploading}
            />

            {uploading && (
              <div>
                <p>Uploading: {progress}%</p>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
              </div>
            )}

            <button type="submit" className="btn" disabled={uploading || !file}>
              {uploading ? `Uploading... ${progress}%` : 'Upload Video'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export default VideoUpload;
