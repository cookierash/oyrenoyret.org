/**
 * Mistake Library Page
 *
 * Collection of mistakes and corrections for learning.
 */

import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { Badge } from '@/components/ui/badge';

export default function MistakeLibraryPage() {
  return (
    <DashboardShell>
      <PageHeader
        title="Mistake library"
        description="Review your past mistakes and learn from them. Track patterns and improve over time."
        badge={<Badge variant="secondary">Mistake library</Badge>}
      />

      <main className="space-y-4">
        <p className="text-sm text-muted-foreground">
          The mistake library will show your recorded mistakes and corrections. Content coming soon.
        </p>
      </main>
    </DashboardShell>
  );
}
