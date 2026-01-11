'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Copy, CheckCircle, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

export function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'form' | 'success'>('form');
  
  // Form State
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState(''); // New separate field
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState('staff');
  
  // Auto-generate a secure-ish temp password by default
  const generateTempPassword = () => `Temp${Math.random().toString(36).slice(-6)}!23`;
  const [password, setPassword] = useState(generateTempPassword());

  const queryClient = useQueryClient();

  // Mutation to create user
  const createUserMutation = useMutation({
    mutationFn: async (data: any) => {
      await api.post('/api/users/', data);
      return data; 
    },
    onSuccess: () => {
      toast.success('User account created successfully');
      setStep('success'); 
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      console.error(error);
      const msg = error.response?.data?.username?.[0] || error.response?.data?.email?.[0] || 'Failed to create user.';
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate({
      email,
      username, // Sending strictly separated username
      first_name: firstName,
      last_name: lastName,
      role, 
      password: password, 
    });
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setStep('form');
      setEmail('');
      setUsername('');
      setFirstName('');
      setLastName('');
      setRole('staff');
      setPassword(generateTempPassword());
    }, 300);
  };

  const copyToClipboard = () => {
    const text = `Username: ${username}\nEmail: ${email}\nPassword: ${password}\nLogin URL: ${window.location.origin}/login`;
    navigator.clipboard.writeText(text);
    toast.success('Credentials copied to clipboard');
  };

  return (
    <Dialog open={open} onOpenChange={(val: boolean) => !val && handleClose()}>
      <DialogTrigger asChild>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[425px]">
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle>Add New Team Member</DialogTitle>
              <DialogDescription>
                Create an account for a new user. You will need to share the credentials with them.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Doe"
                    required
                  />
                </div>
              </div>
              
              {/* Separate Email and Username Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="johndoe"
                    required
                    />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                   <Label htmlFor="password">Temporary Password</Label>
                   <button 
                     type="button" 
                     onClick={() => setPassword(generateTempPassword())}
                     className="text-xs text-primary hover:underline flex items-center"
                   >
                     <RefreshCcw className="h-3 w-3 mr-1" /> Generate New
                   </button>
                </div>
                <Input
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <p className="text-[0.7rem] text-muted-foreground">
                   The user will be forced to change this on first login.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    {/* Removed finance_officer */}
                    <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter className="pt-4">
                <Button type="submit" disabled={createUserMutation.isPending}>
                  {createUserMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : (
          /* SUCCESS STATE */
          <div className="py-6 flex flex-col items-center text-center space-y-4">
            <div className="h-12 w-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
              <CheckCircle className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold">User Created!</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              The account for <strong>{username}</strong> is ready. Please copy these credentials.
            </p>
            
            <div className="w-full bg-muted p-4 rounded-md text-left font-mono text-sm border space-y-2 mt-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Username:</span>
                <span className="select-all font-semibold">{username}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="select-all">{email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Password:</span>
                <span className="font-bold select-all text-primary">{password}</span>
              </div>
              <div className="flex justify-between">
                 <span className="text-muted-foreground">Role:</span>
                 <span>{role}</span>
              </div>
            </div>

            <Button onClick={copyToClipboard} variant="outline" className="w-full">
              <Copy className="mr-2 h-4 w-4" /> Copy Details
            </Button>
            
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}