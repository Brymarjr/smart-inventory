import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface PremiumPaywallProps {
  title: string;
  message?: string;
}

export function PremiumPaywall({ title, message }: PremiumPaywallProps) {
  return (
    <div className="flex flex-col items-center justify-center h-[70vh] text-center max-w-md mx-auto animate-in fade-in duration-500">
      <div className="bg-primary/10 p-6 rounded-full mb-6">
        <Lock className="w-12 h-12 text-primary" />
      </div>
      <h2 className="text-3xl font-bold text-foreground mb-3">{title}</h2>
      <p className="text-muted-foreground mb-8 leading-relaxed">
        {message ||
          "Unlock advanced capabilities, deeper insights, and premium tools by upgrading your plan."}
      </p>
      <Link href="/dashboard/billing">
        <Button size="lg" className="w-full font-bold text-md h-12 rounded-xl">
          View Upgrade Options
        </Button>
      </Link>
    </div>
  );
}
