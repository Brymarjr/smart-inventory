"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import {
  Bell,
  Info,
  Package,
  CreditCard,
  ShoppingBag,
  Calendar,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Notification {
  id: number;
  title: string;
  message: string;
  notification_type: "inventory" | "purchase" | "billing" | "system";
  is_read: boolean;
  created_at: string;
}

export function NotificationsBell() {
  const [isOpen, setIsOpen] = useState(false); // Controls Popover
  const [viewNotification, setViewNotification] = useState<Notification | null>(
    null,
  ); // Controls Dialog
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data } = await api.get<any>("/api/notifications/");
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.results)) return data.results;
      return [];
    },
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter(
    (n: Notification) => !n.is_read,
  ).length;

  const markReadMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.post(`/api/notifications/${id}/mark_read/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await api.post("/api/notifications/mark_all_read/");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("All notifications marked as read");
      setIsOpen(false);
    },
  });

  // Handle click: Open Dialog AND Mark as Read
  const handleItemClick = (n: Notification) => {
    setViewNotification(n);
    setIsOpen(false); // Close the small dropdown

    if (!n.is_read) {
      markReadMutation.mutate(n.id);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "inventory":
        return <Package className="h-5 w-5 text-orange-600" />;
      case "purchase":
        return <ShoppingBag className="h-5 w-5 text-blue-600" />;
      case "billing":
        return <CreditCard className="h-5 w-5 text-green-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case "inventory":
        return "warning"; // requires custom variant or default
      case "purchase":
        return "default";
      case "billing":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative text-gray-500 hover:text-gray-700"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50/50">
            <h4 className="font-semibold text-sm">Notifications</h4>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-auto px-2 py-1 text-xs text-primary hover:text-primary/80"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
              >
                Mark all read
              </Button>
            )}
          </div>

          <ScrollArea className="h-[350px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
                <Bell className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-sm">No notifications yet.</p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((n: Notification) => (
                  <div
                    key={n.id}
                    className={cn(
                      "p-4 flex gap-3 hover:bg-muted transition-colors cursor-pointer relative group",
                      !n.is_read ? "bg-blue-50/40" : "",
                    )}
                    onClick={() => handleItemClick(n)}
                  >
                    <div className="mt-1 bg-card p-1.5 rounded-full border shadow-sm h-fit">
                      {getIcon(n.notification_type)}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-start">
                        <p
                          className={cn(
                            "text-sm leading-none",
                            !n.is_read
                              ? "font-semibold text-foreground"
                              : "font-medium text-slate-700",
                          )}
                        >
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {n.message}
                      </p>
                      <p className="text-[10px] text-gray-400 pt-1">
                        {formatDistanceToNow(new Date(n.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* --- LARGE VIEW DIALOG --- */}
      <Dialog
        open={!!viewNotification}
        onOpenChange={(open) => !open && setViewNotification(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-slate-100 rounded-full">
                {viewNotification &&
                  getIcon(viewNotification.notification_type)}
              </div>
              <div className="space-y-1">
                <DialogTitle>{viewNotification?.title}</DialogTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge
                    variant="outline"
                    className="capitalize rounded-sm px-1 py-0 h-5 font-normal"
                  >
                    {viewNotification?.notification_type}
                  </Badge>
                  <span>•</span>
                  <span>
                    {viewNotification &&
                      format(new Date(viewNotification.created_at), "PPP p")}
                  </span>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="bg-muted p-4 rounded-md border text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
            {viewNotification?.message}
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setViewNotification(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
