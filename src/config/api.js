const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function getToken() {
  return localStorage.getItem("token");
}

function getHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export async function apiLogin(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Login failed");
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  return data;
}

export async function apiRegister(email, password) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Registration failed");
  localStorage.setItem("token", data.token);
  localStorage.setItem("user", JSON.stringify(data.user));
  return data;
}

export async function apiGetMe() {
  const res = await fetch(`${API_BASE}/auth/me`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

export async function apiGetSettings() {
  const res = await fetch(`${API_BASE}/settings`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to load settings");
  return res.json();
}

export async function apiUpdateSettings(totalTimeAllowed, passingThreshold) {
  const res = await fetch(`${API_BASE}/settings`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ totalTimeAllowed, passingThreshold }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update settings");
  return data;
}

export async function apiGetQuestions() {
  const res = await fetch(`${API_BASE}/questions`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to load questions");
  return res.json();
}

export async function apiBulkUpdateQuestions(questions) {
  const res = await fetch(`${API_BASE}/questions/bulk`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ questions }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to update questions");
  return data;
}

export async function apiSubmitQuiz(payload) {
  const res = await fetch(`${API_BASE}/quiz/submit`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to submit quiz");
  return data;
}

export async function apiGetAttempts() {
  const res = await fetch(`${API_BASE}/quiz/attempts`, { headers: getHeaders() });
  if (!res.ok) throw new Error("Failed to load attempts");
  return res.json();
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}

export function getCurrentUser() {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
}

export function isAuthenticated() {
  return !!localStorage.getItem("token");
}
