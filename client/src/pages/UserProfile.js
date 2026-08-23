import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import '../App.css';

function UserProfile({ user, setUser }) {
  const [profile, setProfile] = useState(null);
  const [bio, setBio] = useState('');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/users/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProfile(response.data);
      setBio(response.data.bio || '');
    } catch (err) {
      setError('Failed to load profile');
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      await axios.put(
        '/api/users/profile',
        { bio },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setSuccess('Profile updated successfully!');
      setEditing(false);
      fetchProfile();
    } catch (err) {
      setError(err.response?.data?.error || 'Update failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <nav className="navbar">
        <h1>Video Platform</h1>
        <div className="navbar-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/gallery">Browse Videos</Link>
          <Link to="/upload">Upload</Link>
        </div>
      </nav>

      <div className="container">
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}

        {profile && (
          <div className="profile-card">
            <div className="profile-header">
              <div className="profile-picture">👤</div>
              <div className="profile-info">
                <h2>{profile.username}</h2>
                <p>{profile.email}</p>
                <p>
                  {profile.age_verified ? (
                    <span style={{ color: '#4CAF50' }}>✅ Age Verified</span>
                  ) : (
                    <span style={{ color: '#f44336' }}>❌ Not Verified</span>
                  )}
                </p>
              </div>
            </div>

            {!editing ? (
              <>
                <div style={{ marginBottom: '20px' }}>
                  <h3>Bio</h3>
                  <p>{profile.bio || 'No bio yet'}</p>
                </div>
                <button
                  className="btn"
                  onClick={() => setEditing(true)}
                >
                  Edit Profile
                </button>
              </>
            ) : (
              <form onSubmit={handleUpdateProfile}>
                <div className="form-group">
                  <label>Bio:</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself"
                    rows="4"
                    disabled={loading}
                  />
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    type="submit"
                    className="btn"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditing(false);
                      setBio(profile.bio || '');
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </>
  );
}

export default UserProfile;
