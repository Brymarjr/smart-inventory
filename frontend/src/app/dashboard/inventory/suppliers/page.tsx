'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Supplier, PaginatedResponse } from '@/lib/types';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
    Plus, Loader2, Truck, Pencil, Trash2, MoreHorizontal, Mail, Phone,
    ChevronLeft, ChevronRight 
} from 'lucide-react';
import { toast } from 'sonner';

// ✅ Import Debounced Input
import { DebouncedInput } from '@/components/shared/debounced-input';

export default function SuppliersPage() {
  const { user } = useAuth();
  
  // ✅ State holds final search term
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [reason, setReason] = useState(''); 

  const canModify = user?.role === 'tenant_admin' || user?.role === 'manager';

  // ✅ Reset page on search
  useEffect(() => {
    setPage(1);
  }, [search]);

  // 1. Fetch Suppliers
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['suppliers', search, page],
    queryFn: async () => {
      const params = { search, page, page_size: 20 };
      const { data } = await api.get<PaginatedResponse<Supplier>>('/api/suppliers/', { params });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/api/suppliers/', { name, email, phone, address });
    },
    onSuccess: () => {
      toast.success('Supplier added successfully');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setIsCreateOpen(false);
      resetForm();
    },
    onError: (error: any) => handleApiError(error),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
        if (!editingSupplier) return;
        await api.patch(`/api/suppliers/${editingSupplier.id}/`, { name, email, phone, address, reason });
    },
    onSuccess: () => {
      toast.success('Supplier updated');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setEditingSupplier(null);
      resetForm();
    },
    onError: (error: any) => handleApiError(error),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
        if (!deletingSupplier) return;
        await api.delete(`/api/suppliers/${deletingSupplier.id}/`, { data: { reason } });
    },
    onSuccess: () => {
      toast.success('Supplier deleted');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setDeletingSupplier(null);
      resetForm();
    },
    onError: (error: any) => handleApiError(error),
  });

  const resetForm = () => {
      setName(''); setEmail(''); setPhone(''); setAddress(''); setReason('');
  };

  const handleApiError = (error: any) => {
      const data = error.response?.data;
      const detail = data?.detail || data?.reason || "Operation failed";
      if (typeof detail === 'string' && detail.toLowerCase().includes("limit")) {
          toast.error("Plan Limit Reached: Upgrade to add more.");
      } else {
          toast.error(typeof detail === 'string' ? detail : "An error occurred.");
      }
  };

  const openEdit = (sup: Supplier) => {
      setEditingSupplier(sup);
      setName(sup.name);
      setEmail(sup.email || '');
      setPhone(sup.phone || '');
      setAddress(sup.address || '');
      setReason('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
           <p className="text-muted-foreground text-sm">Manage your vendors and sources.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="mr-2 h-4 w-4" /> Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Supplier</DialogTitle>
              <DialogDescription>Enter contact details for your vendor.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Address</Label><Textarea value={address} onChange={(e) => setAddress(e.target.value)} /></div>
              <DialogFooter>
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
                <CardTitle className="text-base">All Suppliers</CardTitle>
                
                {/* ✅ FAST DEBOUNCED INPUT */}
                <DebouncedInput 
                    value={search}
                    onChange={(val) => setSearch(val)}
                    isLoading={isFetching && !isLoading}
                    placeholder="Search..."
                />
            </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
             <div className="h-32 flex items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
          ) : data?.results.length === 0 ? (
             <div className="h-32 flex flex-col items-center justify-center text-muted-foreground">
                <Truck className="h-8 w-8 mb-2 opacity-20" />
                <p>No suppliers found.</p>
             </div>
          ) : (
            <>
            <div className="rounded-md border">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data?.results.map((sup) => (
                    <TableRow key={sup.id}>
                        <TableCell className="font-medium">{sup.name}</TableCell>
                        <TableCell>
                            <div className="text-sm flex flex-col gap-1">
                                {sup.email && <div className="flex items-center gap-2"><Mail className="h-3 w-3 text-muted-foreground" /> {sup.email}</div>}
                                {sup.phone && <div className="flex items-center gap-2"><Phone className="h-3 w-3 text-muted-foreground" /> {sup.phone}</div>}
                            </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground truncate max-w-[200px]">{sup.address || '-'}</TableCell>
                        <TableCell className="text-right">
                            {canModify && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => openEdit(sup)}>
                                            <Pencil className="mr-2 h-4 w-4" /> Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setDeletingSupplier(sup)} className="text-red-600">
                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
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
                            Showing <strong>{(page - 1) * 20 + 1}</strong> to <strong>{Math.min(page * 20, data.count)}</strong> of <strong>{data.count}</strong> results
                        </span>
                    ) : "0 results"}
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

      <Dialog open={!!editingSupplier} onOpenChange={(open) => !open && setEditingSupplier(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Supplier</DialogTitle>
                <DialogDescription>Reason required for audit log.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
                <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
                <Input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                <Input placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
                <Input placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} />
                
                <div className="pt-2 border-t">
                    <Label className="text-amber-600">Reason for Update (Required)</Label>
                    <Textarea placeholder="Why are you changing this?" value={reason} onChange={e => setReason(e.target.value)} />
                </div>
                <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !reason.trim()}>
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update
                </Button>
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingSupplier} onOpenChange={(open) => !open && setDeletingSupplier(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle className="text-red-600">Delete Supplier: {deletingSupplier?.name}</DialogTitle>
                <DialogDescription>Reason required for audit log.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
                <Label>Reason for Deletion</Label>
                <Textarea placeholder="Why is this being deleted?" value={reason} onChange={e => setReason(e.target.value)} />
                <DialogFooter>
                      <Button variant="outline" onClick={() => setDeletingSupplier(null)}>Cancel</Button>
                      <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending || !reason.trim()}>
                        {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete
                    </Button>
                </DialogFooter>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}