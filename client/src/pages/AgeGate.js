import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../App.css';

function AgeGate({ user }) {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleVerifyAge = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        '/api/users/verify-age',
        { method: 'manual', verification_id: null },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate('/dashboard');
    } catch (err) {
      alert('Age verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectAge = () => {
    alert('You must be 18 or older to use this platform.');
    navigate('/gallery');
  };

  return (
    <div className="age-gate-container">
      <div className="age-gate-card">
        <h1>⚠️ Age Verification Required</h1>
        <p>
          This platform contains content that is only suitable for users 18 years of age and older.
          <br /><br />
          By clicking "I'm 18 or Older", you confirm that you are at least 18 years old and agree to our terms.
        </p>
        <div className="age-gate-buttons">
          <button 
            className="btn-no" 
            onClick={handleRejectAge}
            disabled={loading}
          >
            I'm Under 18
          </button>
          <button 
            className="btn-yes" 
            onClick={handleVerifyAge}
            disabled={loading}
          >
            {loading ? 'Verifying...' : "I'm 18 or Older"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AgeGate;
