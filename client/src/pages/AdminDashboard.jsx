import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../App.css";

function AdminDashboard({ user }) {
  const navigate = useNavigate();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPendingVideos = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");

      const response = await axios.get("/api/admin/videos/pending", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setVideos(response.data.videos || []);
    } catch (err) {
      setError(
        err.response?.data?.error || "Failed to load pending videos"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/dashboard", { replace: true });
      return;
    }

    loadPendingVideos();
  }, [user, navigate, loadPendingVideos]);

  const approveVideo = async (videoId) => {
    try {
      setError("");
      setMessage("");

      const token = localStorage.getItem("token");

      await axios.patch(
        `/api/admin/videos/${videoId}/approve`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setMessage("Video approved successfully.");
      setVideos((currentVideos) =>
        currentVideos.filter((video) => video.id !== videoId)
      );
    } catch (err) {
      setError(err.response?.data?.error || "Failed to approve video");
    }
  };

  const rejectVideo = async (videoId) => {
    const reason = window.prompt(
      "Enter a reason for rejecting this video:"
    );

    if (reason === null) {
      return;
    }

    try {
      setError("");
      setMessage("");

      const token = localStorage.getItem("token");

      await axios.patch(
        `/api/admin/videos/${videoId}/reject`,
        {
          reason: reason || "Rejected by administrator"
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setMessage("Video rejected successfully.");
      setVideos((currentVideos) =>
        currentVideos.filter((video) => video.id !== videoId)
      );
    } catch (err) {
      setError(err.response?.data?.error || "Failed to reject video");
    }
  };

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <>
      <nav className="navbar">
        <h1>Admin Dashboard</h1>

        <div className="navbar-links">
          <button onClick={() => navigate("/dashboard")}>
            Main Dashboard
          </button>

          <button onClick={() => navigate("/gallery")}>
            Browse Videos
          </button>
        </div>
      </nav>

      <main className="container">
        <h2>Pending Video Approvals</h2>

        {error && <div className="error">{error}</div>}
        {message && <div className="success">{message}</div>}

        {loading ? (
          <div className="loading">Loading pending videos...</div>
        ) : videos.length === 0 ? (
          <div className="info">
            There are currently no videos waiting for approval.
          </div>
        ) : (
          <div className="video-grid">
            {videos.map((video) => (
              <div className="video-card" key={video.id}>
                <div className="video-info">
                  <h3>{video.title || "Untitled video"}</h3>

                  <p>
                    <strong>ID:</strong> {video.id}
                  </p>

                  {video.description && (
                    <p>{video.description}</p>
                  )}

                  <p>
                    <strong>Status:</strong>{" "}
                    {video.approval_status || "pending"}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginTop: "15px"
                    }}
                  >
                    <button
                      className="btn"
                      onClick={() => approveVideo(video.id)}
                    >
                      Approve
                    </button>

                    <button
                      className="btn btn-danger"
                      onClick={() => rejectVideo(video.id)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          className="btn btn-secondary"
          style={{ marginTop: "25px", maxWidth: "250px" }}
          onClick={loadPendingVideos}
        >
          Refresh Pending Videos
        </button>
      </main>
    </>
  );
}

export default AdminDashboard;
