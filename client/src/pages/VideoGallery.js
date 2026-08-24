import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";

function getVideoUrl(filePath) {
  if (!filePath) {
    return "";
  }

  if (
    filePath.startsWith("http://") ||
    filePath.startsWith("https://")
  ) {
    return filePath;
  }

  const normalizedPath = filePath.replace(/^\/+/, "");

  if (normalizedPath.startsWith("uploads/")) {
    return `/${normalizedPath}`;
  }

  if (normalizedPath.startsWith("videos/")) {
    return `/uploads/${normalizedPath}`;
  }

  return `/uploads/videos/${normalizedPath}`;
}

function VideoGallery({ user }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const loadVideos = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");

      const response = await axios.get("/api/videos", {
        headers: token
          ? {
              Authorization: `Bearer ${token}`
            }
          : {}
      });

      const videoList = Array.isArray(response.data)
        ? response.data
        : response.data.videos || [];

      setVideos(videoList);
    } catch (err) {
      console.error("Failed to load videos:", err);

      setError(
        err.response?.data?.error ||
          "Unable to load videos. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVideos();
  }, []);

  const filteredVideos = videos.filter((video) => {
    const searchValue = searchTerm.toLowerCase();

    return (
      String(video.title || "")
        .toLowerCase()
        .includes(searchValue) ||
      String(video.description || "")
        .toLowerCase()
        .includes(searchValue) ||
      String(video.username || "")
        .toLowerCase()
        .includes(searchValue)
    );
  });

  return (
    <div className="page-container">
      <nav className="navbar">
        <h1>Video Gallery</h1>

        <div className="navbar-links">
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/upload">Upload Video</Link>
          <Link to="/profile">Profile</Link>

          {user?.role === "admin" && (
            <Link to="/admin">Admin Dashboard</Link>
          )}
        </div>
      </nav>

      <main className="container">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "15px",
            flexWrap: "wrap",
            marginBottom: "25px"
          }}
        >
          <h2>Browse Videos</h2>

          <input
            type="search"
            placeholder="Search videos..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            style={{
              padding: "10px 14px",
              borderRadius: "6px",
              border: "1px solid #ccc",
              minWidth: "240px"
            }}
          />
        </div>

        {loading && (
          <div className="loading">
            Loading videos...
          </div>
        )}

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {!loading && !error && filteredVideos.length === 0 && (
          <div className="info">
            {searchTerm
              ? "No videos match your search."
              : "No approved videos are available yet."}
          </div>
        )}

        {!loading && !error && filteredVideos.length > 0 && (
          <div className="video-grid">
            {filteredVideos.map((video) => {
              const videoUrl = getVideoUrl(video.file_path);

              return (
                <article
                  className="video-card"
                  key={video.id}
                >
                  <div className="video-thumbnail">
                    {videoUrl ? (
                      <video
                        controls
                        preload="metadata"
                        width="100%"
                        poster={
                          video.thumbnail_path
                            ? getVideoUrl(video.thumbnail_path)
                            : undefined
                        }
                      >
                        <source
                          src={videoUrl}
                          type="video/mp4"
                        />
                        Your browser does not support video playback.
                      </video>
                    ) : (
                      <div className="info">
                        Video file unavailable
                      </div>
                    )}
                  </div>

                  <div className="video-info">
                    <h3>{video.title || "Untitled video"}</h3>

                    {video.description && (
                      <p>{video.description}</p>
                    )}

                    <p>
                      Uploaded by:{" "}
                      <strong>
                        {video.username || "Unknown"}
                      </strong>
                    </p>

                    <p>
                      Views: {video.view_count || 0}
                    </p>

                    <p>
                      Type: {video.video_type || "free"}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <button
          className="btn btn-secondary"
          onClick={loadVideos}
          style={{ marginTop: "25px" }}
        >
          Refresh Videos
        </button>
      </main>
    </div>
  );
}

export default VideoGallery;
