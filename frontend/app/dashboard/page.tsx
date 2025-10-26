// frontend/app/dashboard/page.tsx
"use client";

import { useAuth } from "@/hooks/useAuth";

export default function DashboardPage() {
  const { isAuthenticated, logout } = useAuth(true);

  if (!isAuthenticated) {
    return <p>Loading...</p>;
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      <h1 className="text-3xl font-bold mb-4">Welcome to Smart Inventory 🎉</h1>
      <p className="text-gray-600 mb-6">You’re successfully logged in!</p>
      <button
        onClick={logout}
        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
      >
        Logout
      </button>
    </div>
  );
}
