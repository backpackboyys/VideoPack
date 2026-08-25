import React, {
  useEffect,
  useState
} from "react";

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate
} from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import AgeGate from "./pages/AgeGate";
import Dashboard from "./pages/Dashboard";
import VideoUpload from "./pages/VideoUpload";
import VideoGallery from "./pages/VideoGallery";
import UserProfile from "./pages/UserProfile";
import AdminDashboard from "./pages/AdminDashboard";

import "./App.css";

function hasPassedAgeGate() {
  return (
    sessionStorage.getItem(
      "age_gate_passed"
    ) === "true"
  );
}

function getSafeNextPath(path) {
  if (!path || !path.startsWith("/")) {
    return "/login";
  }

  return path;
}

function AgeProtectedRoute({
  children,
  nextPath
}) {
  if (!hasPassedAgeGate()) {
    const safePath = getSafeNextPath(nextPath);

    return (
      <Navigate
        to={`/age-gate?next=${encodeURIComponent(
          safePath
        )}`}
        replace
      />
    );
  }

  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const token = localStorage.getItem(
        "token"
      );

      const userData = localStorage.getItem(
        "user"
      );

      if (token && userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error(
        "Failed to restore user session:",
        error
      );

      localStorage.removeItem("token");
      localStorage.removeItem("user");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setUser(null);

    sessionStorage.removeItem(
      "age_gate_passed"
    );
  };

  if (loading) {
    return (
      <div className="loading">
        Loading...
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/age-gate"
          element={<AgeGate />}
        />

        <Route
          path="/login"
          element={
            <AgeProtectedRoute nextPath="/login">
              <Login setUser={setUser} />
            </AgeProtectedRoute>
          }
        />

        <Route
          path="/register"
          element={
            <AgeProtectedRoute nextPath="/register">
              <Register />
            </AgeProtectedRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            user ? (
              <AgeProtectedRoute nextPath="/dashboard">
                <Dashboard
                  user={user}
                  onLogout={handleLogout}
                />
              </AgeProtectedRoute>
            ) : (
              <Navigate
                to="/login"
                replace
              />
            )
          }
        />

        <Route
          path="/admin"
          element={
            user ? (
              user.role === "admin" ? (
                <AgeProtectedRoute nextPath="/admin">
                  <AdminDashboard user={user} />
                </AgeProtectedRoute>
              ) : (
                <Navigate
                  to="/dashboard"
                  replace
                />
              )
            ) : (
              <Navigate
                to="/login"
                replace
              />
            )
          }
        />

        <Route
          path="/upload"
          element={
            user ? (
              <AgeProtectedRoute nextPath="/upload">
                <VideoUpload user={user} />
              </AgeProtectedRoute>
            ) : (
              <Navigate
                to="/login"
                replace
              />
            )
          }
        />

        <Route
          path="/profile"
          element={
            user ? (
              <AgeProtectedRoute nextPath="/profile">
                <UserProfile
                  user={user}
                  setUser={setUser}
                />
              </AgeProtectedRoute>
            ) : (
              <Navigate
                to="/login"
                replace
              />
            )
          }
        />

        <Route
          path="/gallery"
          element={
            user ? (
              <AgeProtectedRoute nextPath="/gallery">
                <VideoGallery user={user} />
              </AgeProtectedRoute>
            ) : (
              <Navigate
                to="/login"
                replace
              />
            )
          }
        />

        <Route
          path="/"
          element={
            <Navigate
              to={
                hasPassedAgeGate()
                  ? user
                    ? "/dashboard"
                    : "/login"
                  : "/age-gate?next=%2Flogin"
              }
              replace
            />
          }
        />

        <Route
          path="*"
          element={
            <Navigate
              to={
                hasPassedAgeGate()
                  ? user
                    ? "/dashboard"
                    : "/login"
                  : "/age-gate?next=%2Flogin"
              }
              replace
            />
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
