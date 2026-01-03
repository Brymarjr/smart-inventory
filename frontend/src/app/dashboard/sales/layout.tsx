'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Store, History } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { name: 'Point of Sale', href: '/dashboard/sales', icon: Store },
  { name: 'Sales History', href: '/dashboard/sales/history', icon: History },
];

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-6">
      {/* Sales Sub-Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {TABS.map((tab) => {
            const isActive = pathname === tab.href;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={cn(
                  isActive
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                  'group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium transition-colors'
                )}
              >
                <tab.icon
                  className={cn(
                    isActive ? 'text-primary' : 'text-gray-400 group-hover:text-gray-500',
                    '-ml-0.5 mr-2 h-5 w-5'
                  )}
                  aria-hidden="true"
                />
                {tab.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Page Content */}
      <div className="min-h-[500px]">
        {children}
      </div>
    </div>
  );
}