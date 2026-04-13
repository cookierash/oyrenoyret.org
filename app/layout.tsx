import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';
import { ThemeProvider } from '@/src/components/theme-provider';
import { SettingsProvider } from '@/src/components/settings/settings-provider';
import { I18nProvider } from '@/src/i18n/i18n-provider';
import { getSettingsPreferences } from '@/src/lib/settings-preferences-server';
import { ClientRuntime } from '@/src/components/layout/client-runtime';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-sans',
  display: 'swap',
  fallback: [
    'ui-sans-serif',
    'system-ui',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Helvetica',
    'Arial',
    'Apple Color Emoji',
    'Segoe UI Emoji',
  ],
});

const comfortaa = localFont({
  src: [
    {
      path: '../public/fonts/Comfortaa-VariableFont_wght.ttf',
      style: 'normal',
      weight: '300 700',
    },
  ],
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { language, timeFormat } = await getSettingsPreferences();
  const showThemeDebugLogger = process.env.NEXT_PUBLIC_THEME_DEBUG_INGEST === 'true';
  const showVercelInsights = process.env.NODE_ENV === 'production';
  return (
    <html lang={language} suppressHydrationWarning>
      <body className={`${inter.variable} ${comfortaa.variable} font-sans antialiased`}>
        <ThemeProvider>
          <I18nProvider locale={language}>
            <SettingsProvider language={language} timeFormat={timeFormat}>
              {children}
              <ClientRuntime
                showThemeDebugLogger={showThemeDebugLogger}
                showVercelInsights={showVercelInsights}
              />
            </SettingsProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
