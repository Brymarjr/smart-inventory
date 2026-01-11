'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { Device } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Unlock, Smartphone, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function DeviceTable() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [targetDevice, setTargetDevice] = useState<number | null>(null);

  // 1. Fetch Devices
  const { data: devices = [], isLoading } = useQuery({ 
    queryKey: ['devices'],
    queryFn: async () => {
      const response = await api.get('/api/sync/devices/');
      
      // Handle Django Pagination vs Array
      if (response.data && Array.isArray(response.data.results)) {
        return response.data.results as Device[];
      } else if (Array.isArray(response.data)) {
        return response.data as Device[];
      }
      
      return []; 
    }
  });

  // 2. Unblock Mutation
  const unblockMutation = useMutation({
    mutationFn: async (deviceId: number) => {
      setTargetDevice(deviceId);
      await api.post(`/api/sync/devices/${deviceId}/unblock/`);
    },
    onSuccess: () => {
      toast.success("Device unblocked successfully");
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setTargetDevice(null);
    },
    onError: (error) => {
      console.error(error);
      toast.error("Failed to unblock device");
      setTargetDevice(null);
    }
  });

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Registered POS Devices
        </CardTitle>
        <CardDescription>
          Manage the hardware devices authorized to sync with this tenant.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {(!devices || devices.length === 0) ? (
          <div className="text-center py-8 text-muted-foreground">
            No devices registered yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device Name</TableHead>
                <TableHead>Hardware ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Sync</TableHead>
                <TableHead>Version</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell className="font-medium">{device.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {device.device_id.substring(0, 12)}...
                  </TableCell>
                  <TableCell>
                    {device.is_blocked ? (
                      <Badge variant="destructive" className="flex w-fit items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Blocked
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                        Active
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {device.last_sync_at 
                      ? new Date(device.last_sync_at).toLocaleString() 
                      : 'Never'}
                  </TableCell>
                  <TableCell>{device.app_version}</TableCell>
                  <TableCell className="text-right">
                    {/* Allow 'tenant_admin' OR 'superuser' to see the button */}
                    {(user?.role === 'tenant_admin' || user?.is_superuser) && device.is_blocked && (
                      <Button 
                        size="sm" 
                        variant="default"
                        disabled={targetDevice === device.id}
                        onClick={() => unblockMutation.mutate(device.id)}
                      >
                        {targetDevice === device.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Unlock className="mr-2 h-4 w-4" />
                            Unblock
                          </>
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}