/**
 * Admin Layout
 *
 * Forces English language rules for typography (e.g., CSS uppercase)
 * regardless of the user's preferred locale.
 */

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div lang="en">{children}</div>;
}

