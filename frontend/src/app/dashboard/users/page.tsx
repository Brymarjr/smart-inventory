'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { User, PaginatedResponse } from '@/lib/types'; 
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  MoreHorizontal, 
  Search, 
  Loader2, 
  ShieldAlert, 
  Trash2, 
  UserCog, 
  ArrowLeft,
  KeyRound
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { InviteUserDialog } from '@/components/users/invite-user-dialog';

export default function UserManagementPage() {
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  // RBAC CHECK
  const isAllowed = 
    authLoading || 
    (currentUser as any)?.is_superuser || 
    currentUser?.role === 'tenant_admin';

  // Fetch Users
  const { data, isLoading: dataLoading } = useQuery({
    queryKey: ['users', search],
    queryFn: async () => {
      const params = search ? { search } : {};
      const { data } = await api.get<PaginatedResponse<User>>('/api/users/', { params });
      return data;
    },
    enabled: isAllowed && !authLoading, 
  });

  // Change Role Mutation
  const changeRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: number; newRole: string }) => {
      await api.post(`/api/users/${userId}/assign-role/`, { role: newRole });
    },
    onSuccess: () => {
      toast.success('User role updated successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => toast.error('Failed to update role.'),
  });

  // Delete User Mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      await api.delete(`/api/users/${userId}/`);
    },
    onSuccess: () => {
      toast.success('User removed from tenant');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: () => toast.error('Failed to remove user.'),
  });

  // --- NEW: Admin Reset Password Mutation ---
  const adminResetMutation = useMutation({
    mutationFn: async (userId: number) => {
      // Endpoint: POST /api/users/password/admin_reset_password/
      await api.post('/api/users/password/admin_reset_password/', { user_id: userId });
    },
    onSuccess: () => {
      toast.success('Password reset email sent to user.');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Failed to initiate password reset.');
    },
  });

  if (!authLoading && !isAllowed) {
    return (
      <div className="flex h-[80vh] flex-col items-center justify-center text-center p-6">
        <div className="rounded-full bg-red-100 p-3 mb-4">
          <ShieldAlert className="h-10 w-10 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Access Restricted</h1>
        <p className="text-muted-foreground mt-2 max-w-md">
          Only Tenant Administrators can manage users and roles.
        </p>
        <Button variant="outline" className="mt-6" onClick={() => router.push('/dashboard')}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage your team members and their access levels.</p>
        </div>
        <InviteUserDialog />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Team Members</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search users..." 
                className="pl-8" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {dataLoading ? (
             <div className="h-48 flex items-center justify-center">
               <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
             </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profile</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.results.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={`https://avatar.vercel.sh/${u.email}`} />
                          <AvatarFallback>{u.first_name?.[0]}{u.last_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm leading-none">{u.first_name} {u.last_name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {u.username || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize font-normal">
                        {u.role || 'No Role'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <span className="text-sm text-muted-foreground">{u.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {currentUser?.id !== u.id && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <UserCog className="mr-2 h-4 w-4" /> Change Role
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                <DropdownMenuRadioGroup 
                                  value={u.role} 
                                  onValueChange={(val) => changeRoleMutation.mutate({ userId: u.id, newRole: val })}
                                >
                                  <DropdownMenuRadioItem value="staff">Staff</DropdownMenuRadioItem>
                                  <DropdownMenuRadioItem value="manager">Manager</DropdownMenuRadioItem>
                                  <DropdownMenuRadioItem value="admin">Admin</DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>

                            {/* NEW: Password Reset Option */}
                            <DropdownMenuItem
                                onClick={() => {
                                    if (confirm(`Send password reset email to ${u.email}? This will invalidate their current password.`)) {
                                        adminResetMutation.mutate(u.id);
                                    }
                                }}
                            >
                                <KeyRound className="mr-2 h-4 w-4" /> Reset Password
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />
                            
                            <DropdownMenuItem 
                              className="text-red-600 focus:text-red-600"
                              onClick={() => {
                                if(confirm('Are you sure you want to remove this user?')) {
                                  deleteUserMutation.mutate(u.id);
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Remove User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}