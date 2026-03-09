'use client';

import { useEffect, useState } from 'react';
import { supportApi } from '@/lib/api';
import { SupportTicket } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Search, Filter, CheckCircle, AlertCircle, Clock, Building, Send, Lock, Star } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const data = await supportApi.getAllTickets();
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

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedTicket) return;
    setIsUpdating(true);
    try {
      await supportApi.updateTicket(selectedTicket.id, { status: newStatus as any });
      toast.success(`Ticket marked as ${newStatus}`);
      
      const refreshedList = await supportApi.getAllTickets();
      setTickets(refreshedList);
      
      const refreshedTicket = refreshedList.find((t: SupportTicket) => t.id === selectedTicket.id);
      if (refreshedTicket) setSelectedTicket(refreshedTicket);
    } catch (error) {
      toast.error("Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReply = async () => {
    if (!selectedTicket || !replyMessage.trim()) return;
    setIsUpdating(true);
    try {
      const newComment = await supportApi.replyToTicket(selectedTicket.id, replyMessage);
      
      toast.success("Reply sent");
      setReplyMessage('');
      
      setSelectedTicket((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          comments: [...(prev.comments || []), newComment],
          updated_at: new Date().toISOString()
        };
      });

      setTickets((prevTickets) => 
        prevTickets.map((t) => 
          t.id === selectedTicket.id 
            ? { 
                ...t, 
                comments: [...(t.comments || []), newComment],
                updated_at: new Date().toISOString()
              } 
            : t
        )
      );

    } catch (error) {
      toast.error("Failed to send reply");
    } finally {
      setIsUpdating(false);
    }
  };

  // ✅ ENFORCING PRIORITY: Filter first, then Sort VIPs to the very top
  const filteredTickets = tickets
    .filter(ticket => 
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => Number(b.is_vip_tenant || false) - Number(a.is_vip_tenant || false));

  const getPriorityColor = (p: string) => {
    switch(p) {
      case 'critical': return 'bg-red-100 text-red-700 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'medium': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support Desk</h1>
          <p className="text-slate-500">Manage incoming support requests from Tenant Admins.</p>
        </div>
        <Button variant="outline" onClick={fetchTickets}>
          <Clock className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="flex gap-4 items-center bg-white p-4 rounded-lg border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
          <Input 
            placeholder="Search by subject or store name..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button variant="outline" size="icon">
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Store</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-400" />
                  </TableCell>
                </TableRow>
              ) : filteredTickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                    No tickets found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTickets.map((ticket) => (
                  <TableRow key={ticket.id} className="cursor-pointer hover:bg-slate-50/50" onClick={() => setSelectedTicket(ticket)}>
                    <TableCell>
                      {ticket.status === 'open' ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Open</Badge> :
                       ticket.status === 'resolved' ? <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Resolved</Badge> :
                       ticket.status === 'closed' ? <Badge variant="secondary" className="text-slate-500">Closed</Badge> :
                       <Badge variant="outline" className="capitalize">{ticket.status}</Badge>}
                    </TableCell>
                    
                    {/* ✅ UI BADGE: Gold VIP indicator injected into the Subject cell */}
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {ticket.is_vip_tenant && (
                          <Badge className="bg-amber-400 hover:bg-amber-500 text-amber-950 border-none flex items-center gap-1 px-1.5 shadow-sm">
                            <Star className="h-3 w-3 fill-current" /> VIP
                          </Badge>
                        )}
                        <span className="truncate max-w-[200px] md:max-w-[300px]">{ticket.subject}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Building className="h-3 w-3" />
                        {ticket.tenant_name || "Unknown"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getPriorityColor(ticket.priority)}>{ticket.priority}</Badge>
                    </TableCell>
                    <TableCell className="text-slate-500 text-sm">{new Date(ticket.updated_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right"><Button variant="ghost" size="sm">View</Button></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent className="sm:max-w-[700px] h-[80vh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-6 pb-2 border-b">
            <DialogTitle className="flex justify-between items-center pr-8">
              {/* ✅ DIALOG BADGE: Ensure the admin sees it in the chat view too */}
              <span className="flex items-center gap-2">
                {selectedTicket?.subject}
                {selectedTicket?.is_vip_tenant && (
                  <Badge className="bg-amber-400 text-amber-950 border-none ml-2">
                    <Star className="h-3 w-3 fill-current mr-1" /> VIP
                  </Badge>
                )}
              </span>
              {selectedTicket && <Badge variant="outline" className={getPriorityColor(selectedTicket.priority)}>{selectedTicket.priority}</Badge>}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-2 pt-1">
              <Building className="h-3 w-3" /> {selectedTicket?.tenant_name} • <span className="text-slate-500">Opened by {selectedTicket?.created_by_name}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs text-slate-500 ml-1">
                    <span className="font-semibold text-slate-700">{selectedTicket?.created_by_name}</span>
                    <span>{selectedTicket && new Date(selectedTicket.created_at).toLocaleString()}</span>
                </div>
                <div className="bg-white p-4 rounded-lg border shadow-sm text-sm text-slate-800 whitespace-pre-wrap">{selectedTicket?.message}</div>
            </div>

            {selectedTicket?.comments && selectedTicket.comments.length > 0 && (
                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink-0 mx-4 text-xs text-slate-400 uppercase font-medium">Activity Log</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                </div>
            )}

            {selectedTicket?.comments?.map((comment: any) => (
                <div key={comment.id} className={`flex flex-col gap-1 ${comment.is_superuser ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-2 text-xs text-slate-500 ${comment.is_superuser ? 'mr-1' : 'ml-1'}`}>
                        <span className={`font-semibold ${comment.is_superuser ? 'text-primary' : 'text-slate-700'}`}>{comment.user_name} {comment.is_superuser ? '(Support)' : ''}</span>
                        <span>{new Date(comment.created_at).toLocaleString()}</span>
                    </div>
                    <div className={`p-3 rounded-lg text-sm max-w-[85%] whitespace-pre-wrap shadow-sm ${comment.is_superuser ? 'bg-primary text-primary-foreground rounded-br-none' : 'bg-white border rounded-bl-none'}`}>{comment.message}</div>
                </div>
            ))}
          </div>

          <div className="p-4 border-t bg-white">
            {selectedTicket?.status === 'closed' ? (
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-dashed rounded-lg text-slate-500">
                    <Lock className="h-5 w-5 mb-2 text-slate-400" />
                    <p className="text-sm font-medium">This ticket is closed.</p>
                    <p className="text-xs">No further replies can be sent.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Textarea placeholder="Type a reply..." className="min-h-[80px] resize-none" value={replyMessage} onChange={(e) => setReplyMessage(e.target.value)} />
                        <Button className="h-auto w-20 flex flex-col gap-1" onClick={handleReply} disabled={isUpdating || !replyMessage.trim()}>
                            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            <span className="text-xs">Send</span>
                        </Button>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                        <span className="text-xs text-slate-400">Current Status: <span className="font-medium text-slate-700 uppercase">{selectedTicket?.status}</span></span>
                        <div className="flex gap-2">
                            {selectedTicket?.status !== 'resolved' && (
                                <Button variant="outline" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200" onClick={() => handleUpdateStatus('resolved')} disabled={isUpdating}>
                                    <CheckCircle className="mr-2 h-3.5 w-3.5" /> Mark Resolved
                                </Button>
                            )}
                            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" onClick={() => handleUpdateStatus('closed')} disabled={isUpdating}>
                                <AlertCircle className="mr-2 h-3.5 w-3.5" /> Close Ticket
                            </Button>
                        </div>
                    </div>
                </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}