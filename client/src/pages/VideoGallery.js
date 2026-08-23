import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import '../App.css';

function VideoGallery({ user }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchVideos();
  }, []);

  const fetchVideos = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const response = await axios.get('/api/videos', config);
      setVideos(response.data || []);
    } catch (err) {
      setError('Failed to load videos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <nav className="navbar">
        <h1>Video Platform</h1>
        <div className="navbar-links">
          {user ? (
            <>
              <Link to="/dashboard">Dashboard</Link>
              <Link to="/upload">Upload</Link>
              <Link to="/profile">Profile</Link>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
        </div>
      </nav>

      <div className="container">
        <h2>📺 Video Gallery</h2>
        {error && <div className="error">{error}</div>}
        {loading && <p>Loading videos...</p>}

        {videos.length > 0 ? (
          <div className="video-grid">
            {videos.map((video) => (
              <div key={video.id} className="video-card">
                <div className="video-thumbnail">
                  🎬
                </div>
                <div className="video-info">
                  <h3>{video.title}</h3>
                  <p>By: {video.username}</p>
                  <p>👁️ {video.view_count} views</p>
                  {video.video_type !== 'free' && (
                    <p style={{ color: '#d32f2f', fontWeight: 'bold' }}>
                      💰 ${video.price}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No videos available yet.</p>
        )}
      </div>
    </>
  );
}

export default VideoGallery;
