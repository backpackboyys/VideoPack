import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../App.css";

function AdminDashboard({ user }) {
  const navigate = useNavigate();

  const [videos, setVideos] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [userForm, setUserForm] = useState({
    username: "",
    email: "",
    password: "",
    role: "user",
    age_verified: false
  });

  const token = () => localStorage.getItem("token");
  const authConfig = () => ({
    headers: { Authorization: `Bearer ${token()}` }
  });

  const loadVideos = useCallback(async () => {
    try {
      setLoadingVideos(true);
      const response = await axios.get("/api/admin/videos", authConfig());
      setVideos(response.data.videos || []);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load videos");
    } finally {
      setLoadingVideos(false);
    }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const response = await axios.get("/api/admin/users", authConfig());
      setUsers(response.data.users || []);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/dashboard", { replace: true });
      return;
    }

    loadVideos();
    loadUsers();
  }, [user, navigate, loadVideos, loadUsers]);

  const approveVideo = async (videoId) => {
    try {
      setError("");
      setMessage("");
      await axios.patch(`/api/admin/videos/${videoId}/approve`, {}, authConfig());
      setMessage("Video approved successfully.");
      setVideos((current) => current.map((video) => video.id === videoId
        ? { ...video, approval_status: "approved", is_approved: 1 }
        : video));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to approve video");
    }
  };

  const rejectVideo = async (videoId) => {
    const reason = window.prompt("Enter a reason for rejecting this video:");
    if (reason === null) return;

    try {
      setError("");
      setMessage("");
      await axios.patch(
        `/api/admin/videos/${videoId}/reject`,
        { reason: reason || "Rejected by administrator" },
        authConfig()
      );
      setMessage("Video rejected successfully.");
      setVideos((current) => current.map((video) => video.id === videoId
        ? { ...video, approval_status: "rejected", is_approved: 0 }
        : video));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to reject video");
    }
  };

  const deleteVideo = async (videoId, videoTitle) => {
    const confirmed = window.confirm(
      `Permanently delete "${videoTitle || "this video"}"?\n\nThis removes the database record and uploaded video file. This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      setError("");
      setMessage("");
      await axios.delete(`/api/admin/videos/${videoId}`, authConfig());
      setMessage("Video and associated files deleted successfully.");
      setVideos((current) => current.filter((video) => video.id !== videoId));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete video");
    }
  };

  const resetUserForm = () => {
    setUserForm({
      username: "",
      email: "",
      password: "",
      role: "user",
      age_verified: false
    });
    setEditingUserId(null);
    setShowUserForm(false);
  };

  const startEditingUser = (account) => {
    setUserForm({
      username: account.username || "",
      email: account.email || "",
      password: "",
      role: account.role || "user",
      age_verified: Boolean(account.age_verified),
      active: account.active
    });
    setEditingUserId(account.id);
    setShowUserForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveUser = async (event) => {
    event.preventDefault();

    try {
      setError("");
      setMessage("");

      if (editingUserId) {
        const payload = {
          username: userForm.username,
          email: userForm.email,
          role: userForm.role,
          age_verified: userForm.age_verified
        };

        if (userForm.password) payload.password = userForm.password;

        const response = await axios.patch(
          `/api/admin/users/${editingUserId}`,
          payload,
          authConfig()
        );

        setUsers((current) => current.map((account) =>
          account.id === editingUserId ? response.data.user : account
        ));
        setMessage("User account updated successfully.");
      } else {
        const response = await axios.post(
          "/api/admin/users",
          userForm,
          authConfig()
        );
        setUsers((current) => [response.data.user, ...current]);
        setMessage("User account created successfully.");
      }

      resetUserForm();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save user account");
    }
  };

  const setUserActive = async (account, active) => {
    const action = active ? "reactivate" : "deactivate";
    if (!window.confirm(`Are you sure you want to ${action} ${account.email}?`)) return;

    try {
      setError("");
      setMessage("");
      const response = await axios.patch(
        `/api/admin/users/${account.id}`,
        { active },
        authConfig()
      );
      setUsers((current) => current.map((item) =>
        item.id === account.id ? response.data.user : item
      ));
      setMessage(`User account ${active ? "reactivated" : "deactivated"}.`);
    } catch (err) {
      setError(err.response?.data?.error || `Failed to ${action} user`);
    }
  };

  const permanentlyDeleteUser = async (account) => {
    const confirmed = window.confirm(
      `Permanently delete ${account.email}?\n\nThis cannot be undone. Deactivate the account instead if you only want to block access.`
    );
    if (!confirmed) return;

    try {
      setError("");
      setMessage("");
      await axios.delete(`/api/admin/users/${account.id}`, authConfig());
      setUsers((current) => current.filter((item) => item.id !== account.id));
      setMessage("User account permanently deleted.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete user");
    }
  };

  if (!user || user.role !== "admin") return null;

  return (
    <>
      <nav className="navbar">
        <h1>Admin Dashboard</h1>
        <div className="navbar-links">
          <button onClick={() => navigate("/dashboard")}>Main Dashboard</button>
          <button onClick={() => navigate("/gallery")}>Browse Videos</button>
        </div>
      </nav>

      <main className="container">
        {error && <div className="error">{error}</div>}
        {message && <div className="success">{message}</div>}

        <section>
          <h2>User Management</h2>
          <button className="btn" onClick={() => {
            if (showUserForm) resetUserForm();
            else setShowUserForm(true);
          }}>
            {showUserForm ? "Cancel" : "Add User"}
          </button>

          {showUserForm && (
            <form onSubmit={saveUser} style={{ marginTop: "20px", maxWidth: "520px" }}>
              <label>Username</label>
              <input
                value={userForm.username}
                onChange={(event) => setUserForm({ ...userForm, username: event.target.value })}
                required
                minLength={2}
              />

              <label>Email</label>
              <input
                type="email"
                value={userForm.email}
                onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
                required
              />

              <label>{editingUserId ? "New password (leave blank to keep current)" : "Password"}</label>
              <input
                type="password"
                value={userForm.password}
                onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
                required={!editingUserId}
                minLength={8}
              />

              <label>Role</label>
              <select
                value={userForm.role}
                onChange={(event) => setUserForm({ ...userForm, role: event.target.value })}
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>

              <label style={{ display: "block", margin: "12px 0" }}>
                <input
                  type="checkbox"
                  checked={Boolean(userForm.age_verified)}
                  onChange={(event) => setUserForm({ ...userForm, age_verified: event.target.checked })}
                />{" "}
                Age verified
              </label>

              <button className="btn" type="submit">
                {editingUserId ? "Save Changes" : "Create User"}
              </button>
            </form>
          )}

          {loadingUsers ? (
            <div className="loading">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="info">There are currently no users.</div>
          ) : (
            <div style={{ overflowX: "auto", marginTop: "20px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th align="left">Username</th>
                    <th align="left">Email</th>
                    <th align="left">Role</th>
                    <th align="left">Status</th>
                    <th align="left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((account) => (
                    <tr key={account.id}>
                      <td>{account.username}</td>
                      <td>{account.email}</td>
                      <td>{account.role}</td>
                      <td>{account.active ? "Active" : "Deactivated"}</td>
                      <td>
                        <button className="btn" onClick={() => startEditingUser(account)}>Edit</button>{" "}
                        <button className="btn btn-secondary" onClick={() => setUserActive(account, !account.active)}>
                          {account.active ? "Deactivate" : "Reactivate"}
                        </button>{" "}
                        <button className="btn btn-danger" onClick={() => permanentlyDeleteUser(account)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section style={{ marginTop: "40px" }}>
          <h2>Video Management</h2>

          {loadingVideos ? (
            <div className="loading">Loading videos...</div>
          ) : videos.length === 0 ? (
            <div className="info">There are currently no videos.</div>
          ) : (
            <div className="video-grid">
              {videos.map((video) => (
                <div className="video-card" key={video.id}>
                  <div className="video-info">
                    <h3>{video.title || "Untitled video"}</h3>
                    <p><strong>ID:</strong> {video.id}</p>
                    <p><strong>Uploader:</strong> {video.username || "Unknown"}</p>
                    {video.description && <p>{video.description}</p>}
                    <p><strong>Status:</strong> {video.approval_status || "pending"}</p>
                    <p><strong>Views:</strong> {video.view_count || 0}</p>

                    <div style={{ display: "flex", gap: "10px", marginTop: "15px", flexWrap: "wrap" }}>
                      {video.approval_status === "pending" && (
                        <>
                          <button className="btn" onClick={() => approveVideo(video.id)}>Approve</button>
                          <button className="btn btn-danger" onClick={() => rejectVideo(video.id)}>Reject</button>
                        </>
                      )}
                      <button className="btn btn-danger" onClick={() => deleteVideo(video.id, video.title)}>
                        Delete Permanently
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button className="btn btn-secondary" style={{ marginTop: "25px", maxWidth: "250px" }} onClick={() => {
            loadVideos();
            loadUsers();
          }}>
            Refresh Dashboard
          </button>
        </section>
      </main>
    </>
  );
}

export default AdminDashboard;
