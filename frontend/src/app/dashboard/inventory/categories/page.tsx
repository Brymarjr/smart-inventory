'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Category, PaginatedResponse } from '@/lib/types';
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
    Plus, Loader2, Tags, Pencil, Trash2, MoreHorizontal, 
    ChevronLeft, ChevronRight 
} from 'lucide-react';
import { toast } from 'sonner';

// ✅ Import Debounced Input
import { DebouncedInput } from '@/components/shared/debounced-input';

export default function CategoriesPage() {
  const { user } = useAuth();
  
  // ✅ State holds "final" search term only
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  
  const queryClient = useQueryClient();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [reason, setReason] = useState('');

  const canModify = user?.role === 'tenant_admin' || user?.role === 'manager';

  // ✅ Reset page when search changes
  useEffect(() => {
    setPage(1);
  }, [search]);

  // 1. Fetch Categories
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['categories', search, page],
    queryFn: async () => {
      const params = { search, page, page_size: 20 };
      const { data } = await api.get<PaginatedResponse<Category>>('/api/categories/', { params });
      return data;
    },
    placeholderData: (prev) => prev,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await api.post('/api/categories/', { name, description });
    },
    onSuccess: () => {
      toast.success('Category created');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setIsCreateOpen(false);
      setName(''); setDescription('');
    },
    onError: (error: any) => handleApiError(error)
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
        if (!editingCategory) return;
        await api.patch(`/api/categories/${editingCategory.id}/`, { name, description, reason });
    },
    onSuccess: () => {
      toast.success('Category updated');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setEditingCategory(null);
      setName(''); setDescription(''); setReason('');
    },
    onError: (error: any) => handleApiError(error)
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
        if (!deletingCategory) return;
        await api.delete(`/api/categories/${deletingCategory.id}/`, { data: { reason } });
    },
    onSuccess: () => {
      toast.success('Category deleted');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setDeletingCategory(null);
      setReason('');
    },
    onError: (error: any) => handleApiError(error)
  });

  const handleApiError = (error: any) => {
      const data = error.response?.data;
      const detail = data?.detail || data?.reason || "Operation failed";
      if (typeof detail === 'string' && detail.toLowerCase().includes("limit")) {
          toast.error("Plan Limit Reached: Upgrade to add more.");
      } else {
          toast.error(typeof detail === 'string' ? detail : "An error occurred.");
      }
  };

  const openEdit = (cat: Category) => {
      setEditingCategory(cat);
      setName(cat.name);
      setDescription(cat.description || '');
      setReason('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
           <p className="text-muted-foreground text-sm">Organize your products.</p>
        </div>
        
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setName(''); setDescription(''); }}>
              <Plus className="mr-2 h-4 w-4" /> Add Category
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Category</DialogTitle>
              <DialogDescription>Create a category to group your products.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Electronics" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details..." />
              </div>
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
                <CardTitle className="text-base">All Categories</CardTitle>
                
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
                <Tags className="h-8 w-8 mb-2 opacity-20" />
                <p>No categories found.</p>
             </div>
          ) : (
            <>
            <div className="rounded-md border">
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data?.results.map((cat) => (
                    <TableRow key={cat.id}>
                        <TableCell className="font-medium">{cat.name}</TableCell>
                        <TableCell className="text-muted-foreground">{cat.description || '-'}</TableCell>
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
                                        <DropdownMenuItem onClick={() => openEdit(cat)}>
                                            <Pencil className="mr-2 h-4 w-4" /> Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setDeletingCategory(cat)} className="text-red-600">
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

      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Category: {editingCategory?.name}</DialogTitle>
                <DialogDescription>Updating critical data requires a reason for the audit log.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
                <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
                <div><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
                
                <div className="pt-2 border-t">
                    <Label className="text-amber-600">Reason for Update (Required)</Label>
                    <Textarea placeholder="Why are you changing this?" value={reason} onChange={e => setReason(e.target.value)} />
                </div>
                <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || !reason.trim()}>
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update Category
                </Button>
            </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle className="text-red-600">Delete Category: {deletingCategory?.name}</DialogTitle>
                <DialogDescription>This action cannot be undone. Please provide a reason.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
                <Label>Reason for Deletion (Required)</Label>
                <Textarea placeholder="Why is this being deleted?" value={reason} onChange={e => setReason(e.target.value)} />
                <DialogFooter>
                      <Button variant="outline" onClick={() => setDeletingCategory(null)}>Cancel</Button>
                      <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending || !reason.trim()}>
                        {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete Permanently
                    </Button>
                </DialogFooter>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}