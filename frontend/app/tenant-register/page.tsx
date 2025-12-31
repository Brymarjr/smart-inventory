//frontend/app/tenant-register/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TenantRegisterPage() {
  const router = useRouter();
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api";

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

  // Handle form field changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Handle tenant registration
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
        setMessage(
          `❌ ${data.detail || "Registration failed. Check your inputs."}`
        );
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
        <h1 className="text-2xl font-semibold mb-6 text-center">
          Tenant Registration
        </h1>

        {/* Success or error message */}
        {message && (
          <p
            className={`text-center text-sm mb-4 ${
              message.startsWith("✅") ? "text-green-600" : "text-red-600"
            }`}
          >
            {message}
          </p>
        )}

        {/* Form inputs */}
        {[
          { name: "tenant_name", placeholder: "Tenant Name" },
          { name: "username", placeholder: "Username" },
          { name: "email", placeholder: "Email", type: "email" },
          { name: "first_name", placeholder: "First Name" },
          { name: "last_name", placeholder: "Last Name" },
          { name: "password", placeholder: "Password", type: "password" },
        ].map((field) => (
          <input
            key={field.name}
            type={field.type || "text"}
            name={field.name}
            placeholder={field.placeholder}
            value={(formData as any)[field.name]}
            onChange={handleChange}
            required
            className="border border-gray-300 p-3 w-full rounded mb-3 placeholder-gray-400 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        ))}

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition disabled:bg-gray-400"
        >
          {loading ? "Registering..." : "Register Tenant"}
        </button>

        {/* Navigation link */}
        <p className="mt-6 text-center text-sm text-gray-600">
          Already registered?{" "}
          <a
            href="/tenant-login"
            className="text-blue-600 hover:underline font-medium"
          >
            Login here
          </a>
        </p>
      </form>
    </div>
  );
}
