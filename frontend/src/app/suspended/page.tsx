'use client';

import { useState } from "react";
import { Lock, Send, Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { supportApi } from "@/lib/api";
import { toast } from "sonner";

export default function SuspendedPage() {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setIsSubmitting(true);
    try {
      // This works because we bypassed /api/support/ in the backend!
      await supportApi.createTicket({ 
        subject: "Account Suspension Inquiry", 
        message: message 
      });
      toast.success("Message sent to support. We will contact you via email.");
      setMessage("");
    } catch (error) {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-lg border-red-100">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-red-100 p-3 rounded-full w-fit mb-4">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-2xl text-red-700">Account Suspended</CardTitle>
          <CardDescription className="text-base mt-2">
            Your organization's access to ForeTrack has been temporarily disabled. 
            This may be due to a billing issue or a violation of our terms of service.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="message" className="text-sm font-medium">
                Contact Support to resolve this issue:
              </label>
              <Textarea
                id="message"
                placeholder="Briefly describe your situation..."
                className="resize-none h-24"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting || !message.trim()}>
              {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send Message to Support
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex justify-center border-t pt-4">
          <Button variant="ghost" className="text-muted-foreground" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}