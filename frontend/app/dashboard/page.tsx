// frontend/app/dashboard/page.tsx
"use client";

import { useAuth } from "@/hooks/useAuth";

/**
 * DashboardPage component
 * Displays a welcome screen for authenticated users
 * Provides a logout button
 */
export default function DashboardPage() {
  // useAuth hook manages authentication state and logout logic
  const { isAuthenticated, logout } = useAuth(true);

  // Show loading state if auth status is not yet determined
  if (!isAuthenticated) {
    return <p>Loading...</p>;
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
      {/* Welcome message */}
      <h1 className="text-3xl font-bold mb-4">
        Welcome to Smart Inventory 🎉
      </h1>
      <p className="text-gray-600 mb-6">
        You are successfully logged in!
      </p>

      {/* Logout button */}
      <button
        onClick={logout}
        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
        aria-label="Logout from Smart Inventory"
      >
        Logout
      </button>
    </div>
  );
}

