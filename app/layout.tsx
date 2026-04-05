import type { Metadata } from 'next';
import { Inter, Comfortaa } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/src/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { ThemeDebugLogger } from '@/src/components/debug/theme-debug-logger';
import { Analytics } from '@vercel/analytics/react';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const comfortaa = Comfortaa({
  subsets: ['latin'],
  variable: '--font-comfortaa',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'oyrenoyret.org',
    template: '%s - oyrenoyret.org',
  },
  description: 'A secure educational platform for minors',
  metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-oyrenoyret.ico' },
      { url: '/icon-oyrenoyret.png', type: 'image/png' },
    ],
    shortcut: '/favicon-oyrenoyret.ico',
    apple: '/apple-oyrenoyret.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${comfortaa.variable} font-sans antialiased`}>
        <ThemeProvider>
          <ThemeDebugLogger />
          {children}
          <Toaster />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  );
}
