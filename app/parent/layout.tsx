/**
 * Parent Layout
 * 
 * Layout wrapper for parent-specific routes.
 * Provides structure for parent portal pages.
 */

export default function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
