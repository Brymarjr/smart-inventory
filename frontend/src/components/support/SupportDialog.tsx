'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context'; 
import { supportApi } from '@/lib/api'; 
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, HelpCircle, Send } from 'lucide-react';
import { toast } from 'sonner';

interface SupportDialogProps {
  children?: React.ReactNode;
}

export default function SupportDialog({ children }: SupportDialogProps) {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form State
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'low'|'medium'|'high'>('medium');

  // Logic: If role is tenant_admin, they create a ticket. Everyone else contacts the tenant admin.
  const isTenantAdmin = user?.role === 'tenant_admin'; 

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      toast.error("Please fill in all fields.");
      return;
    }

    setIsLoading(true);
    try {
      if (isTenantAdmin) {
        // TIER 2: Create Formal Ticket
        await supportApi.createTicket({ subject, message, priority });
        toast.success("Support ticket created!");
      } else {
        // TIER 1: Notify Tenant Admin
        await supportApi.contactTenantAdmin({ subject, message, priority });
        toast.success("Your Admin has been notified.");
      }
      setIsOpen(false);
      setSubject('');
      setMessage('');
      setPriority('medium');
    } catch (error) {
      toast.error("Failed to send request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            {isTenantAdmin ? "Contact System Support" : "Contact Your Admin"}
          </DialogTitle>
          <DialogDescription>
            {isTenantAdmin 
              ? "Open a ticket for the Smart Inventory Support Team."
              : "Send a direct message to your store administrator."
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Subject</Label>
            <Input 
              placeholder="Brief summary of the issue"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low - General Question</SelectItem>
                <SelectItem value="medium">Medium - Need Assistance</SelectItem>
                <SelectItem value="high">High - Urgent Issue</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Message</Label>
            <Textarea 
              placeholder="Describe your issue in detail..."
              className="h-32 resize-none"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}