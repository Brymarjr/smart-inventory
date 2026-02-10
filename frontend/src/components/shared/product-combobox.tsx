'use client';

import * as React from "react"
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { useState, useEffect } from "react"

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

interface ProductComboboxProps {
  value?: string;
  onSelect: (productId: string) => void;
}

export function ProductCombobox({ value, onSelect }: ProductComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState("")
  const debouncedSearch = useDebounce(searchTerm, 300)

  const { data, isFetching } = useQuery({
    queryKey: ['product-search', debouncedSearch],
    queryFn: async () => {
      // ✅ 1. Stop! If empty, return nothing. Don't even ask the server.
      if (!debouncedSearch) return { results: [] };
      
      const params = { search: debouncedSearch, page_size: 5 };
      const response = await api.get('/api/products/', { params });
      return response.data;
    },
    // ✅ 2. Disable the query completely if search is empty
    enabled: debouncedSearch.length > 0,
    staleTime: 1000 * 60, 
    placeholderData: (prev) => prev, 
  })

  // ✅ 3. Force list to be empty if search is empty (clears the "default" list)
  const products = debouncedSearch.length > 0 ? (data?.results || []) : [];
  
  const selectedName = products.find((p: any) => p.id.toString() === value)?.name;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-white"
        >
          {value
            ? (selectedName || "Product Selected") 
            : "Search product..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
               className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
               placeholder="Type to search..."
               value={searchTerm}
               onChange={(e) => setSearchTerm(e.target.value)}
            />
            {/* Show spinner only when actually searching */}
            {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          
          <CommandList>
              {/* ✅ 4. Only show 'No results' if we have typed, finished fetching, and found nothing */}
              {debouncedSearch.length > 0 && !isFetching && products.length === 0 && (
                  <CommandEmpty>No product found.</CommandEmpty>
              )}

              <CommandGroup>
                {products.map((product: any) => (
                  <CommandItem
                    key={product.id}
                    value={product.id.toString()}
                    onSelect={() => {
                      onSelect(product.id.toString())
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === product.id.toString() ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col text-left">
                        <span className="font-medium">{product.name}</span>
                        <span className="text-xs text-muted-foreground">SKU: {product.sku || '--'} • Stock: {product.quantity}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}