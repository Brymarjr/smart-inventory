'use client';

import { useEffect, useState } from 'react';
import { supportApi } from '@/lib/api';
import { SupportTicket } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Send, Lock, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';

export default function TenantSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const data = await supportApi.getMyTickets();
      setTickets(data);
    } catch (error) {
      toast.error("Failed to load tickets");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

const handleReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    setIsSending(true); // Note: Variable name might be isSending or isUpdating depending on your file
    try {
      const newComment = await supportApi.replyToTicket(selectedTicket.id, replyMessage);
      toast.success("Reply sent");
      setReplyMessage('');
      
      // 1. Instant Dialog Update
      setSelectedTicket((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          comments: [...(prev.comments || []), newComment],
          updated_at: new Date().toISOString()
        };
      });

      // 2. Instant List Update
      setTickets((prevTickets) => 
        prevTickets.map((t) => 
          t.id === selectedTicket.id 
            ? { ...t, comments: [...(t.comments || []), newComment], updated_at: new Date().toISOString() } 
            : t
        )
      );

    } catch (error) {
      toast.error("Failed to send reply");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">My Support Tickets</h2>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : tickets.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-slate-500">No tickets yet.</TableCell></TableRow>
              ) : (
                tickets.map((ticket) => (
                  <TableRow key={ticket.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedTicket(ticket)}>
                    <TableCell>
                      <Badge variant="outline" className={
                        ticket.status === 'open' ? "bg-green-50 text-green-700" :
                        ticket.status === 'resolved' ? "bg-blue-50 text-blue-700" :
                        ticket.status === 'closed' ? "bg-slate-100 text-slate-500" : ""
                      }>{ticket.status}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">{ticket.subject}</TableCell>
                    <TableCell><Badge variant="outline">{ticket.priority}</Badge></TableCell>
                    <TableCell className="text-slate-500 text-sm">{new Date(ticket.updated_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm">View</Button></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* VIEW TICKET DIALOG */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-2 border-b">
            <DialogTitle>{selectedTicket?.subject}</DialogTitle>
            <DialogDescription>Ticket #{selectedTicket?.id}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
            <div className="bg-white p-4 rounded-lg border shadow-sm text-sm">{selectedTicket?.message}</div>
            
            {/* Conversation */}
            {selectedTicket?.comments?.map((comment) => (
              <div key={comment.id} className={`flex flex-col ${comment.is_superuser ? 'items-start' : 'items-end'}`}>
                <span className="text-xs text-slate-500 mb-1">
                  {comment.is_superuser ? 'Support Team' : 'You'} • {new Date(comment.created_at).toLocaleString()}
                </span>
                <div className={`p-3 rounded-lg text-sm max-w-[85%] shadow-sm ${
                  comment.is_superuser ? 'bg-white border text-slate-700' : 'bg-blue-600 text-white'
                }`}>
                  {comment.message}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t bg-white">
            {selectedTicket?.status === 'closed' ? (
                <div className="flex items-center justify-center gap-2 p-3 bg-slate-100 rounded text-slate-500 text-sm">
                    <Lock className="h-4 w-4" /> This ticket is closed.
                </div>
            ) : (
                <div className="flex gap-2">
                    <Textarea 
                      placeholder="Type a reply..." 
                      className="min-h-[60px] resize-none" 
                      value={replyMessage} 
                      onChange={(e) => setReplyMessage(e.target.value)} 
                    />
                    <Button className="h-auto" onClick={handleReply} disabled={isSending || !replyMessage.trim()}>
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}