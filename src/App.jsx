import React, { useState, useEffect } from "react";
import { apiGetMe, isAuthenticated, logout } from "./config/api";
import AuthPortal from "./components/AuthPortal";
import AdminDashboard from "./components/AdminDashboard";
import StudentDashboard from "./components/StudentDashboard";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }

    try {
      const userData = await apiGetMe();
      setUser(userData);
    } catch (err) {
      // Token expired or invalid
      logout();
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSuccess = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    logout();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans text-slate-700 gap-3">
        <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <AuthPortal onAuthSuccess={handleAuthSuccess} />;
  if (user.role === "admin") return <AdminDashboard onLogout={handleLogout} />;
  if (user.role === "student") return <StudentDashboard user={user} onLogout={handleLogout} />;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
      <h1 className="text-lg font-bold text-slate-800 tracking-wide uppercase">
        Routing Failure
      </h1>
      <p className="text-slate-500 text-xs mt-1">
        Your profile context could not be parsed. Contact administration.
      </p>
    </div>
  );
}
