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

  // 1. Fetch Current User Data
  const { data: user, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
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
        phone_number: user.phone_number || '', 
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
      await api.patch('/api/users/me/', payload);
    },
    onSuccess: () => {
      toast.success("Profile updated!");
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || "Failed to update profile.");
      console.error(error);
    }
  });

  const onSubmit = (data: ProfileData) => {
    mutation.mutate(data);
  };

  if (isLoading) return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading profile...</div>;

  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
      {/* Page Header - Aligned to Dashboard Style */}
      <div className="flex flex-col gap-1.5 ml-1">
        <h3 className="text-3xl font-black tracking-tight text-[#1A1B4B]">Profile</h3>
        <p className="text-muted-foreground">
          Manage your account and contact information
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden rounded-xl">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-6 px-8">
          <CardTitle className="text-[#1A1B4B] font-bold text-xl tracking-tight">Personal Information</CardTitle>
          <CardDescription className="text-slate-500 font-medium">Update your personal details here.</CardDescription>
        </CardHeader>
        
        <CardContent className="pt-10 px-8 pb-10">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
            {/* Name Group */}
            <div className="grid grid-cols-2 gap-8">
                <div className="space-y-3">
                    <Label htmlFor="first_name" className="font-bold text-slate-700 tracking-wide text-sm">First Name</Label>
                    <Input id="first_name" {...register('first_name')} className="h-11 border-slate-300 focus:ring-[#2D31FA] rounded-lg" placeholder="John" />
                </div>
                <div className="space-y-3">
                    <Label htmlFor="last_name" className="font-bold text-slate-700 tracking-wide text-sm">Last Name</Label>
                    <Input id="last_name" {...register('last_name')} className="h-11 border-slate-300 focus:ring-[#2D31FA] rounded-lg" placeholder="Doe" />
                </div>
            </div>

            {/* Email Field - Clickable but read-only */}
            <div className="space-y-3">
                <Label htmlFor="email" className="font-bold text-slate-700 tracking-wide text-sm">Email Address</Label>
                <Input 
                  id="email" 
                  {...register('email')} 
                  readOnly 
                  className="h-11 bg-slate-50/80 border-slate-200 text-slate-500 cursor-text focus-visible:ring-0 rounded-lg" 
                />
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-2">
                  Email management is restricted to administrators
                </p>
            </div>

            {/* Phone Field */}
            <div className="space-y-3 max-w-md">
                <Label htmlFor="phone" className="font-bold text-slate-700 tracking-wide text-sm">Phone Number</Label>
                <Input id="phone" {...register('phone_number')} className="h-11 border-slate-300 focus:ring-[#2D31FA] rounded-lg" placeholder="+234 ..." />
            </div>

            {/* Footer / Action */}
            <div className="pt-8 border-t border-slate-100 flex justify-end">
    <Button 
      type="submit" 
      disabled={mutation.isPending} 
      className="h-11 bg-[#2D31FA] hover:bg-[#1A1B4B] transition-all font-bold px-10 shadow-md rounded-lg flex items-center gap-2 text-white"
    >
        {mutation.isPending ? (
          <Loader2 
            size={16} 
            className="animate-spin" 
            style={{ color: '#FFFFFF', stroke: '#FFFFFF' }} 
          />
        ) : (
          <Save 
            size={16} 
            style={{ color: '#FFFFFF', stroke: '#FFFFFF' }} 
          />
        )}
        <span className="text-white">Save Changes</span>
    </Button>
</div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}