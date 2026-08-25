import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import "../App.css";

function AgeGate() {
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [rejected, setRejected] = useState(false);

  const searchParams = new URLSearchParams(
    location.search
  );

  const nextPath =
    searchParams.get("next") || "/login";

  const handleVerifyAge = async () => {
    setLoading(true);

    try {
      await axios.post(
        "/api/auth/age-gate",
        {
          confirmed: true
        },
        {
          withCredentials: true
        }
      );

      sessionStorage.setItem(
        "age_gate_passed",
        "true"
      );

      navigate(nextPath, {
        replace: true
      });
    } catch (error) {
      console.error("Age verification error:", error);

      alert(
        error.response?.data?.error ||
          "Age verification failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRejectAge = () => {
    sessionStorage.removeItem(
      "age_gate_passed"
    );

    setRejected(true);
  };

  if (rejected) {
    return (
      <div className="age-gate-container">
        <div className="age-gate-card">
          <h1>Access Denied</h1>

          <p>
            You must be at least 18 years old to
            access this platform.
          </p>

          <p>
            Please close this browser tab.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="age-gate-container">
      <div className="age-gate-card">
        <h1>Age Verification Required</h1>

        <p>
          This platform contains adult content and
          is intended only for people who are at
          least 18 years old.
        </p>

        <p>
          By selecting “I’m 18 or Older,” you confirm
          that you are at least 18 years old and agree
          to follow the platform rules and applicable
          laws.
        </p>

        <div className="age-gate-buttons">
          <button
            type="button"
            className="btn-no"
            onClick={handleRejectAge}
            disabled={loading}
          >
            I'm Under 18
          </button>

          <button
            type="button"
            className="btn-yes"
            onClick={handleVerifyAge}
            disabled={loading}
          >
            {loading
              ? "Verifying..."
              : "I'm 18 or Older"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AgeGate;
