"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveTokens } from "@/lib/auth";

export default function TenantLoginPage() {
  const router = useRouter();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api";

  const [tenant, setTenant] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE_URL}/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant, username, password }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Invalid tenant credentials");
      }

      const data = await response.json();
      saveTokens(data);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm"
      >
        <h1 className="text-2xl font-semibold mb-6 text-center">
          Tenant Login
        </h1>

        {error && <p className="text-red-500 text-sm mb-4 text-center">{error}</p>}

        <input
          type="text"
          placeholder="Tenant name or ID"
          value={tenant}
          onChange={(e) => setTenant(e.target.value)}
          className="border border-gray-300 p-2 w-full rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border border-gray-300 p-2 w-full rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-gray-300 p-2 w-full rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition disabled:bg-gray-400"
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <div className="mt-6 text-center text-sm text-gray-600 space-y-2">
          <p>
            Not a tenant?{" "}
            <a href="/login" className="text-blue-600 hover:underline font-medium">
              Go back to admin login
            </a>
          </p>
          <p>
            New tenant?{" "}
            <a
              href="/tenant-register"
              className="text-blue-600 hover:underline font-medium"
            >
              Register here
            </a>
          </p>
        </div>
      </form>
    </div>
  );
}


