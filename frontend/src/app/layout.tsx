import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const jakarta = Plus_Jakarta_Sans({ 
  subsets: ['latin'],
  variable: '--font-jakarta', 
});

// Next.js handles the <head> tags automatically using this export
export const metadata: Metadata = {
  title: 'ForeTrack Smart Inventory',
  description: 'Smart POS and Inventory Management',
  manifest: '/manifest.json',
};

// Next.js 14+ best practice for setting theme colors
export const viewport: Viewport = {
  themeColor: '#1A1B4B',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={jakarta.variable}>
      <body className={`${jakarta.className} antialiased bg-background text-foreground`}>
        {/* We wrap the entire app in our client-side providers */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}