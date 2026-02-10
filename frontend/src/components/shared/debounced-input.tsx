'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, Loader2 } from 'lucide-react';

interface DebouncedInputProps {
  value: string;
  onChange: (value: string) => void;
  debounce?: number;
  isLoading?: boolean;
  placeholder?: string;
}

export function DebouncedInput({ 
  value: initialValue, 
  onChange, 
  debounce = 500, 
  isLoading = false,
  placeholder = "Search..."
}: DebouncedInputProps) {
  
  // 1. Keep a local state for immediate "fast" typing
  const [value, setValue] = useState(initialValue);

  // 2. Sync local state if parent changes it externally (optional)
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // 3. The Magic: Only tell the parent after the user stops typing
  useEffect(() => {
    const timeout = setTimeout(() => {
      onChange(value);
    }, debounce);

    return () => clearTimeout(timeout);
  }, [value, debounce, onChange]);

  return (
    <div className="relative w-64">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
            placeholder={placeholder}
            className="pl-8"
            value={value}
            onChange={(e) => setValue(e.target.value)} // ✅ Updates INSTANTLY (Local only)
        />
        {isLoading && (
            <div className="absolute right-2 top-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
        )}
    </div>
  );
}