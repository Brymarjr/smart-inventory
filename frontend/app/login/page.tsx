"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { saveTokens, getAccessToken } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Auto-redirect if already logged in
  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      const res = await fetch("http://127.0.0.1:8000/api/auth/token/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) throw new Error("Invalid credentials");

      const data = await res.json();
      saveTokens(data);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed");
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-sm"
      >
        <h1 className="text-2xl font-semibold mb-6 text-center">Login</h1>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="border border-gray-300 p-2 w-full rounded mb-3"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="border border-gray-300 p-2 w-full rounded mb-4"
        />

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
        >
          Login
        </button>

        {/* Tenant Links */}
        <div className="mt-6 text-center text-sm text-gray-600 space-y-2">
          <p>
            Are you a tenant?{" "}
            <a
              href="/tenant-login"
              className="text-blue-600 hover:underline font-medium"
            >
              Login here
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



