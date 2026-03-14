import { WifiOff } from "lucide-react";
import Link from "next/link";

export default function OfflineFallback() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground text-center p-4">
      <div className="bg-muted p-6 rounded-full mb-6">
        <WifiOff className="h-12 w-12 text-muted-foreground" />
      </div>
      <h1 className="text-3xl font-bold mb-4">You are offline</h1>
      <p className="text-muted-foreground mb-8 max-w-md">
        It looks like you lost your internet connection. Don't worry, your offline sync is active. You can still use the POS to ring up customers.
      </p>
      <Link 
        href="/dashboard/sales" 
        className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors shadow-sm"
      >
        Return to Sales POS
      </Link>
    </div>
  );
}