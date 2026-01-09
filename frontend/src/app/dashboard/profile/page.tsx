'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Save } from 'lucide-react';

interface ProfileData {
  id: number; 
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
}

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset } = useForm<ProfileData>();

  // 1. Fetch Current User Data (Using the new 'me' endpoint)
  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      // ✅ Use 'me' here too, it's safer and cleaner
      const res = await api.get('/api/users/me/');
      return res.data;
    },
  });

  // 2. Populate form
  useEffect(() => {
    if (user) {
      reset({
        id: user.id,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        email: user.email || '',
        phone_number: user.phone_number || '', // Backend field usually snake_case
      });
    }
  }, [user, reset]);

  // 3. Mutation to Update Profile
  const mutation = useMutation({
    mutationFn: async (data: ProfileData) => {
      const payload = {
          first_name: data.first_name,
          last_name: data.last_name,
          phone_number: data.phone_number
      };
      
      // ✅ FIXED: Use '/api/users/me/' instead of ID
      // This bypasses the admin-only check on the main list view
      await api.patch('/api/users/me/', payload);
    },
    onSuccess: () => {
      toast.success("Profile updated!");
      queryClient.invalidateQueries({ queryKey: ['me'] });
      // Also refresh global auth user if you are using one
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update profile.");
      console.error(error);
    }
  });

  const onSubmit = (data: ProfileData) => {
    mutation.mutate(data);
  };

  if (isLoading) return <div className="p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your personal details here.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input id="first_name" {...register('first_name')} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input id="last_name" {...register('last_name')} />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" {...register('email')} disabled className="bg-muted" />
                <p className="text-[0.8rem] text-muted-foreground">Email cannot be changed here.</p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" {...register('phone_number')} />
            </div>

            <div className="pt-4 flex justify-end">
                <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}