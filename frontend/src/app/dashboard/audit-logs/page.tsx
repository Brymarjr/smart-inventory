'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PaginatedResponse } from '@/lib/types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
    ShieldAlert, Loader2, ChevronLeft, ChevronRight, User, Clock, FileText, Search, Download 
} from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// ✅ IMPORT THE NEW PAYWALL COMPONENT
import { PremiumPaywall } from '@/components/billing/premium-paywall';

interface AuditLogEntry {
  id: number;
  actor_name: string;
  actor_email: string;
  action: 'UPDATE' | 'DELETE';
  target_model: string;
  target_name: string;
  reason: string;
  timestamp: string;
}

export default function AuditLogsPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const router = useRouter();

  const isAuthorized = user?.role === 'tenant_admin' || user?.role === 'manager';

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, search],
    queryFn: async () => {
      // ✅ ADDED TRY/CATCH TO HANDLE THE 403 BILLING LOCK
      try {
          const { data } = await api.get<any>('/api/audit-logs/', { 
              params: { 
                  page, 
                  page_size: 20,
                  search 
              } 
          });
          return data;
      } catch (error: any) {
          if (error.response?.status === 403) {
              return { isLocked: true, message: error.response.data?.detail };
          }
          throw error;
      }
    },
    enabled: isAuthorized,
    placeholderData: (prev) => prev, 
  });

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
      setPage(1);
  };

  const handleExport = async () => {
    try {
        setIsExporting(true);
        const response = await api.get('/api/audit-logs/export_csv/', {
            params: { search },
            responseType: 'blob', 
        });

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        link.setAttribute('download', `audit_logs_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        
        link.remove();
        toast.success("Audit log exported successfully");
    } catch (error: any) {
        // ✅ Gracefully handle export blocks as well
        if (error.response?.status === 403) {
            toast.error("Premium Feature", { description: "Upgrading is required to export logs." });
        } else {
            console.error(error);
            toast.error("Failed to export logs");
        }
    } finally {
        setIsExporting(false);
    }
  };

  // ✅ NEW HELPER: Remove the "1__" prefix
  const formatName = (name: string) => {
    if (!name) return 'Unknown';
    // If name is "1__Testadmin1", split and take "Testadmin1"
    const parts = name.split('__');
    return parts.length > 1 ? parts[parts.length - 1] : name;
  };

  if (isAuthLoading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

  if (!isAuthorized) {
      return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
              <ShieldAlert className="h-16 w-16 text-red-500" />
              <h2 className="text-2xl font-bold">Access Denied</h2>
              <p className="text-muted-foreground">Only Admins and Managers can view Audit Logs.</p>
              <Button onClick={() => router.push('/dashboard')}>Go Back</Button>
          </div>
      );
  }

  // ✅ DISPLAY THE PAYWALL IF LOCKED
  if (data?.isLocked) {
      return (
          <div className="p-6">
              <PremiumPaywall 
                  title="Premium Security Logs" 
                  message={data.message || "Track every user action, product update, and system change with immutable audit logs. Upgrade to unlock."} 
              />
          </div>
      );
  }

  const getActionBadge = (action: string) => {
      if (action === 'DELETE') return <Badge variant="destructive">DELETE</Badge>;
      if (action === 'UPDATE') return <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">UPDATE</Badge>;
      return <Badge variant="outline">{action}</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
         <div>
            <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
            <p className="text-muted-foreground">Track critical actions performed by staff.</p>
         </div>
         <Button variant="outline" onClick={handleExport} disabled={isExporting}>
             {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
             Export CSV
         </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" /> System Activity
                </CardTitle>
                <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search user, action, reason..." 
                        className="pl-8 h-9" 
                        value={search}
                        onChange={handleSearch}
                    />
                </div>
            </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="h-48 flex items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
          ) : data?.results?.length === 0 ? (
             <div className="h-48 flex flex-col items-center justify-center text-muted-foreground">
                <ShieldAlert className="h-10 w-10 mb-2 opacity-20" />
                <p>No matching logs found.</p>
             </div>
          ) : (
            <>
            <div className="rounded-md border">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data?.results?.map((log: AuditLogEntry) => (
                    <TableRow key={log.id}>
                        <TableCell>
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                                    <User className="h-4 w-4 text-slate-500" />
                                </div>
                                <div className="flex flex-col">
                                    {/* ✅ USE HELPER HERE */}
                                    <span className="font-medium text-sm">
                                        {formatName(log.actor_name)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">{log.actor_email}</span>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell>
                            <div className="flex flex-col">
                                <span className="font-medium">{log.target_name}</span>
                                <span className="text-xs text-muted-foreground capitalize">{log.target_model}</span>
                            </div>
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                            <p className="text-sm text-slate-600 truncate" title={log.reason}>
                                {log.reason}
                            </p>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1">
                                <Clock className="h-3 w-3" />
                                {format(new Date(log.timestamp), "MMM d, HH:mm")}
                            </div>
                        </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
                </Table>
            </div>

            <div className="flex items-center justify-between space-x-2 py-4">
                <div className="text-sm text-muted-foreground">
                    {data?.count ? (
                        <span>
                            Showing <strong>{(page - 1) * 20 + 1}</strong> to <strong>{Math.min(page * 20, data.count)}</strong> of <strong>{data.count}</strong> logs
                        </span>
                    ) : "0 logs"}
                </div>
                <div className="space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(old => Math.max(old - 1, 1))}
                        disabled={page === 1 || isLoading}
                    >
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(old => old + 1)}
                        disabled={!data?.next || isLoading}
                    >
                        Next
                        <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                </div>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}