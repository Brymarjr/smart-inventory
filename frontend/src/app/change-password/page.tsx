"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AlertTriangle, Loader2, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const { user, refreshUser } = useAuth(); // ✅ We use refreshUser now
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      // ✅ Ensure this URL matches your users/urls.py
      // Based on your ViewSet, it is likely:
      await api.post("/api/users/password/change_password/", {
        current_password: currentPassword,
        new_password: newPassword,
      });
    },
    onSuccess: async () => {
      toast.success("Password changed successfully!");

      // 1. Refresh the user profile via API to get "must_change_password: false"
      await refreshUser();

      // 2. Intelligent Redirect based on Role
      if (user?.is_superuser) {
        router.push("/system-admin");
      } else {
        router.push("/dashboard");
      }
    },
    onError: (error: any) => {
      const msg =
        error.response?.data?.detail ||
        error.response?.data?.current_password?.[0] ||
        "Failed to change password.";
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }
    changePasswordMutation.mutate();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-md border-amber-200 bg-amber-50/50 shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-semibold text-sm uppercase tracking-wide">
              Action Required
            </span>
          </div>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Your account is flagged for a mandatory password update. Please set
            a new permanent password to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="current">Temporary / Current Password</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="current"
                  type="password"
                  className="pl-9 bg-card"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter the password you just logged in with"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new">New Password</Label>
              <div className="relative">
                <LockKeyhole className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="new"
                  type="password"
                  className="pl-9 bg-card"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                />
              </div>
            </div>

            <Button
              className="w-full bg-amber-600 hover:bg-amber-700 text-white"
              type="submit"
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
