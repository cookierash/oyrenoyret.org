/**
 * Dashboard Layout
 * 
 * Layout wrapper for dashboard routes.
 * Provides navigation and structure for authenticated user dashboard.
 */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
