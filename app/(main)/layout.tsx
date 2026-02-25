/**
 * Main Layout
 *
 * Wraps non-auth pages with header and footer.
 * Auth routes (login, register) use a separate layout without header/footer.
 */

import { SiteHeader } from '@/src/components/layout/site-header';
import { SiteFooter } from '@/src/components/layout/site-footer';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
