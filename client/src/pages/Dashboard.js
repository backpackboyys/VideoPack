import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import '../App.css';

function Dashboard({ user, onLogout }) {
  const [userProfile, setUserProfile] = useState(null);
  const [stats, setStats] = useState({ videos: 0, views: 0, verified: false });
  const navigate = useNavigate();

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/users/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUserProfile(response.data);
      
      if (!response.data.age_verified) {
        navigate('/age-gate');
      }
    } catch (err) {
      console.error('Failed to fetch profile');
    }
  };

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  return (
    <>
      <nav className="navbar">
        <h1>Video Platform</h1>
        <div className="navbar-links">
          <Link to="/gallery">Browse Videos</Link>
          <Link to="/upload">Upload Video</Link>
          <Link to="/profile">Profile</Link>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </nav>

      <div className="container">
        <h2>Welcome, {user?.username}! 👋</h2>
        
        {userProfile && (
          <>
            <div className="info">
              {userProfile.age_verified ? (
                <p>✅ Age Verified - You can upload and access content</p>
              ) : (
                <p>⚠️ Age not verified - <Link to="/age-gate">Verify age</Link> to upload videos</p>
              )}
            </div>

            <div className="dashboard-stats">
              <div className="stat-card">
                <h3>Account Status</h3>
                <div className="value">{userProfile.age_verified ? '✅' : '❌'}</div>
              </div>
              <div className="stat-card">
                <h3>Username</h3>
                <div className="value" style={{ fontSize: '18px' }}>{userProfile.username}</div>
              </div>
              <div className="stat-card">
                <h3>Email</h3>
                <div className="value" style={{ fontSize: '14px' }}>{userProfile.email}</div>
              </div>
            </div>

            <div style={{ marginTop: '30px' }}>
              <h3>Quick Actions:</h3>
              <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
                <Link to="/upload" style={{ flex: 1, minWidth: '200px' }}>
                  <button className="btn" style={{ width: '100%' }}>📤 Upload Video</button>
                </Link>
                <Link to="/gallery" style={{ flex: 1, minWidth: '200px' }}>
                  <button className="btn btn-secondary" style={{ width: '100%' }}>🎬 Browse Videos</button>
                </Link>
                <Link to="/profile" style={{ flex: 1, minWidth: '200px' }}>
                  <button className="btn btn-secondary" style={{ width: '100%' }}>👤 Edit Profile</button>
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default Dashboard;
