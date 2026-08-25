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

  const loadVideos = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");

      const response = await axios.get("/api/admin/videos", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      setVideos(response.data.videos || []);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Failed to load videos"
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

    loadVideos();
  }, [user, navigate, loadVideos]);

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
        currentVideos.map((video) =>
          video.id === videoId
            ? {
                ...video,
                approval_status: "approved",
                is_approved: 1
              }
            : video
        )
      );
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Failed to approve video"
      );
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
        currentVideos.map((video) =>
          video.id === videoId
            ? {
                ...video,
                approval_status: "rejected",
                is_approved: 0
              }
            : video
        )
      );
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Failed to reject video"
      );
    }
  };

  const deleteVideo = async (videoId, videoTitle) => {
    const confirmed = window.confirm(
      `Permanently delete "${
        videoTitle || "this video"
      }"?\n\nThis removes the database record and uploaded video file. This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");

      const token = localStorage.getItem("token");

      await axios.delete(
        `/api/admin/videos/${videoId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setMessage("Video and associated files deleted successfully.");

      setVideos((currentVideos) =>
        currentVideos.filter(
          (video) => video.id !== videoId
        )
      );
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Failed to delete video"
      );
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
          <button
            onClick={() => navigate("/dashboard")}
          >
            Main Dashboard
          </button>

          <button
            onClick={() => navigate("/gallery")}
          >
            Browse Videos
          </button>
        </div>
      </nav>

      <main className="container">
        <h2>Video Management</h2>

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {message && (
          <div className="success">
            {message}
          </div>
        )}

        {loading ? (
          <div className="loading">
            Loading videos...
          </div>
        ) : videos.length === 0 ? (
          <div className="info">
            There are currently no videos.
          </div>
        ) : (
          <div className="video-grid">
            {videos.map((video) => (
              <div
                className="video-card"
                key={video.id}
              >
                <div className="video-info">
                  <h3>
                    {video.title || "Untitled video"}
                  </h3>

                  <p>
                    <strong>ID:</strong>{" "}
                    {video.id}
                  </p>

                  <p>
                    <strong>Uploader:</strong>{" "}
                    {video.username || "Unknown"}
                  </p>

                  {video.description && (
                    <p>{video.description}</p>
                  )}

                  <p>
                    <strong>Status:</strong>{" "}
                    {video.approval_status || "pending"}
                  </p>

                  <p>
                    <strong>Views:</strong>{" "}
                    {video.view_count || 0}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      marginTop: "15px",
                      flexWrap: "wrap"
                    }}
                  >
                    {video.approval_status ===
                      "pending" && (
                      <>
                        <button
                          className="btn"
                          onClick={() =>
                            approveVideo(video.id)
                          }
                        >
                          Approve
                        </button>

                        <button
                          className="btn btn-danger"
                          onClick={() =>
                            rejectVideo(video.id)
                          }
                        >
                          Reject
                        </button>
                      </>
                    )}

                    <button
                      className="btn btn-danger"
                      onClick={() =>
                        deleteVideo(
                          video.id,
                          video.title
                        )
                      }
                    >
                      Delete Permanently
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          className="btn btn-secondary"
          style={{
            marginTop: "25px",
            maxWidth: "250px"
          }}
          onClick={loadVideos}
        >
          Refresh Videos
        </button>
      </main>
    </>
  );
}

export default AdminDashboard;
