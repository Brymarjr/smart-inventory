"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

// TIMEOUT SETTINGS:
const INACTIVITY_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds
const WARNING_TIME = 60; // 60 seconds countdown

export function IdleTimeoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(WARNING_TIME);

  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    // If the warning is already on screen, force them to click the button.
    // Moving the mouse shouldn't secretly dismiss the modal.
    if (showWarning) return;

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    idleTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setCountdown(WARNING_TIME);
    }, INACTIVITY_TIME);
  }, [showWarning]);

  // 1. Listen for user activity
  useEffect(() => {
    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    // Throttle the reset so it doesn't fire 1000 times a second and burn CPU
    let isThrottled = false;
    const handleUserActivity = () => {
      if (isThrottled) return;
      isThrottled = true;
      resetTimer();
      setTimeout(() => {
        isThrottled = false;
      }, 1000);
    };

    events.forEach((event) =>
      document.addEventListener(event, handleUserActivity),
    );
    resetTimer();

    return () => {
      events.forEach((event) =>
        document.removeEventListener(event, handleUserActivity),
      );
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [resetTimer]);

  // 2. Handle the 60-second countdown when inactive
  useEffect(() => {
    if (showWarning) {
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current!);
            logout(); // Time is up. Nuke the browser session.
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [showWarning, logout]);

  const stayLoggedIn = () => {
    setShowWarning(false);
    resetTimer();
  };

  return (
    <>
      {children}

      {/* 🚨 The Warning Modal Overlay */}
      {showWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card p-6 rounded-[2rem] shadow-2xl max-w-md w-full mx-4 text-center space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="mx-auto bg-amber-100 p-4 rounded-full w-fit">
              <AlertTriangle className="h-10 w-10 text-amber-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-foreground">
                Are you still there?
              </h2>
              <p className="text-muted-foreground font-medium">
                For your security, you will be automatically logged out in{" "}
                <span className="text-red-600 font-black text-lg">
                  {countdown}
                </span>{" "}
                seconds due to inactivity.
              </p>
            </div>
            <div className="flex gap-3 justify-center pt-4">
              <Button
                variant="outline"
                onClick={logout}
                className="w-full h-12 rounded-xl font-bold border-2"
              >
                Log Out
              </Button>
              <Button
                onClick={stayLoggedIn}
                className="w-full h-12 rounded-xl bg-[#2D31FA] hover:bg-[#1A1B4B] font-bold text-white transition-colors"
              >
                I'm Still Here
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
