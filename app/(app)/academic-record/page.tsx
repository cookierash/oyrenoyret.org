/**
 * Academic Record Page
 *
 * View and manage academic records.
 */

import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default async function AcademicRecordPage() {
  const userId = await getCurrentSession();
  if (!userId) redirect('/login');

  const records = await prisma.academicRecord.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { publicId: true },
  });

  return (
    <DashboardShell>
      <PageHeader
        title="Academic record"
        description="Your grades and academic progress."
      />
      <main className="space-y-4 pt-2">
        {user?.publicId ? (
          <p className="text-xs text-muted-foreground font-mono">
            Your ID: {user.publicId}
          </p>
        ) : null}
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No academic records yet. Records will appear here when added.
          </p>
        ) : (
          <div className="space-y-4">
            {records.map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {r.subject ?? 'Subject'} {r.grade ? `· Grade ${r.grade}` : ''}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {r.score != null && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Score:</span> {r.score}
                    </p>
                  )}
                  {r.notes && (
                    <p className="text-sm text-muted-foreground">{r.notes}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </DashboardShell>
  );
}
