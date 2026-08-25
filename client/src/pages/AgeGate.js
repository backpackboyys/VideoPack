import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import "../App.css";

function AgeGate() {
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const destination =
    new URLSearchParams(location.search).get(
      "next"
    ) || "/login";

  const handleVerifyAge = async () => {
    setLoading(true);

    try {
      await axios.post("/api/auth/age-gate", {
        confirmed: true
      });

      sessionStorage.setItem(
        "age_gate_passed",
        "true"
      );

      navigate(destination, {
        replace: true
      });
    } catch (error) {
      alert(
        error.response?.data?.error ||
          "Age verification failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRejectAge = () => {
    sessionStorage.removeItem(
      "age_gate_passed"
    );

    alert(
      "You must be 18 or older to use this platform."
    );

    window.location.href =
      "about:blank";
  };

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
          By continuing, you confirm that you are
          at least 18 years old and agree to follow
          the site's terms and applicable laws.
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
