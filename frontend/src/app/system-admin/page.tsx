'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2, Building2, ChevronLeft, ChevronRight, Activity, Ban } from 'lucide-react';
import api from '@/lib/api';
import { SystemTenant } from '@/lib/types';
import Link from 'next/link';

// Helper to debounce search requests
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// Stats Interface
interface DashboardStats {
    total: number;
    active: number;
    inactive: number;
}

export default function SystemDashboard() {
  // --- STATE ---
  const [tenants, setTenants] = useState<SystemTenant[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ total: 0, active: 0, inactive: 0 });
  const [isLoading, setIsLoading] = useState(true);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 500);

  // Pagination State
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [prevPage, setPrevPage] = useState<string | null>(null);

  // --- FETCH STATS (Runs Once) ---
  useEffect(() => {
    const fetchStats = async () => {
        try {
            const { data } = await api.get<DashboardStats>('/api/admin/stats/');
            setStats(data);
        } catch (e) {
            console.error("Failed to fetch stats");
        }
    };
    fetchStats();
  }, []);

  // --- FETCH TENANTS (Main Logic) ---
  const fetchTenants = useCallback(async (url: string = '/api/admin/tenants/') => {
    setIsLoading(true);
    try {
      // Logic: If searching, append query param (only if we are on the base URL)
      let finalUrl = url;
      if (url.includes('/api/admin/tenants/') && debouncedSearch) {
        // Check if '?' already exists to append correctly
        const separator = finalUrl.includes('?') ? '&' : '?';
        finalUrl += `${separator}search=${encodeURIComponent(debouncedSearch)}`;
      }

      const { data } = await api.get(finalUrl);

      // Handle Pagination Response
      if (data.results) {
        setTenants(data.results);
        setNextPage(data.next);      // Save Next Page URL
        setPrevPage(data.previous);  // Save Prev Page URL
      } else if (Array.isArray(data)) {
        // Fallback for non-paginated response
        setTenants(data);
        setNextPage(null);
        setPrevPage(null);
      }
    } catch (error) {
      console.error("Failed to fetch tenants", error);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch]);

  // Trigger Fetch when Debounced Search changes
  useEffect(() => {
    // Reset to page 1 when search term changes
    fetchTenants('/api/admin/tenants/');
  }, [fetchTenants]); 

  // --- PAGINATION HANDLERS ---
  const handleNext = () => {
    if (nextPage) fetchTenants(nextPage);
  };

  const handlePrev = () => {
    if (prevPage) fetchTenants(prevPage);
  };

  // --- RENDER ---
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Organizations</h2>
          <p className="text-slate-500 dark:text-slate-400">Manage and monitor all registered stores.</p>
        </div>
      </div>

      {/* --- STATS CARDS --- */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Total Organizations</CardTitle>
            <Building2 className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Active Stores</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">Inactive/Suspended</CardTitle>
            <Ban className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.inactive}</div>
          </CardContent>
        </Card>
      </div>

      {/* --- TENANT DIRECTORY TABLE --- */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Directory</CardTitle>
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search organizations..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>URL Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tenants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No organizations found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenants.map((tenant) => (
                      <TableRow key={tenant.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-md">
                              <Building2 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                            </div>
                            {tenant.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-500">{tenant.slug}</TableCell>
                        <TableCell>
                          {tenant.is_active ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200 border">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="destructive">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(tenant.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" asChild>
                             <Link href={`/system-admin/tenants/${tenant.id}`}>
                               View Data
                             </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* --- PAGINATION CONTROLS --- */}
              <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrev}
                  disabled={!prevPage || isLoading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleNext}
                  disabled={!nextPage || isLoading}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}