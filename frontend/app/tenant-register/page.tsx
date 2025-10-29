"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TenantRegisterPage() {
  const router = useRouter();
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api";

  const [formData, setFormData] = useState({
    tenant_name: "",
    username: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch(`${API_BASE_URL}/tenants/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setMessage("✅ Tenant registered successfully! Redirecting to login...");
        setTimeout(() => router.push("/tenant-login"), 1500);
      } else {
        const data = await response.json();
        setMessage(`❌ ${data.detail || "Registration failed. Check your inputs."}`);
      }
    } catch (error) {
      setMessage("❌ Network error. Please try again.");
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
        <h1 className="text-2xl font-semibold mb-6 text-center">Tenant Registration</h1>

        {message && (
          <p
            className={`text-center text-sm mb-4 ${
              message.startsWith("✅") ? "text-green-600" : "text-red-600"
            }`}
          >
            {message}
          </p>
        )}

        <input
          type="text"
          name="tenant_name"
          placeholder="Tenant Name"
          value={formData.tenant_name}
          onChange={handleChange}
          required
          className="border border-gray-300 p-2 w-full rounded mb-3"
        />

        <input
          type="text"
          name="username"
          placeholder="Username"
          value={formData.username}
          onChange={handleChange}
          required
          className="border border-gray-300 p-2 w-full rounded mb-3"
        />

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={formData.email}
          onChange={handleChange}
          required
          className="border border-gray-300 p-2 w-full rounded mb-3"
        />

        <input
          type="text"
          name="first_name"
          placeholder="First Name"
          value={formData.first_name}
          onChange={handleChange}
          required
          className="border border-gray-300 p-2 w-full rounded mb-3"
        />

        <input
          type="text"
          name="last_name"
          placeholder="Last Name"
          value={formData.last_name}
          onChange={handleChange}
          required
          className="border border-gray-300 p-2 w-full rounded mb-3"
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          value={formData.password}
          onChange={handleChange}
          required
          className="border border-gray-300 p-2 w-full rounded mb-4"
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
        >
          {loading ? "Registering..." : "Register Tenant"}
        </button>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already registered?{" "}
          <a href="/tenant-login" className="text-blue-600 hover:underline">
            Login here
          </a>
        </p>
      </form>
    </div>
  );
}


