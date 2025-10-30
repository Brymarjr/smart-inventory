// frontend/lib/api.ts

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api";

/**
 * Retrieves stored tokens and tenant from localStorage
 */
function getAuthHeaders() {
  const accessToken = localStorage.getItem("access_token");
  const tenant = localStorage.getItem("tenant"); // we assume this is stored after login

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  if (tenant) {
    headers["X-Tenant"] = tenant;
  }

  return headers;
}

/**
 * General API fetch helper.
 * Automatically attaches Authorization and X-Tenant headers.
 * Handles GET, POST, PATCH, DELETE.
 */
export async function apiFetch(
  endpoint: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: Record<string, any>
) {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `${API_BASE_URL}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: getAuthHeaders(),
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  // Handle unauthorized errors (e.g. expired token)
  if (response.status === 401) {
    console.warn("Unauthorized — redirecting to login...");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    window.location.href = "/login";
    throw new Error("Unauthorized. Please log in again.");
  }

  // Try to parse JSON; handle empty responses gracefully
  let data: any = null;
  try {
    data = await response.json();
  } catch {
    // Response had no JSON body
  }

  if (!response.ok) {
    const errorMessage =
      data?.detail || `Request failed: ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return data;
}
