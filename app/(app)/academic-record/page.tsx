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
import type { AcademicRecord } from '@prisma/client';
import { getI18n } from '@/src/i18n/server';

export default async function AcademicRecordPage() {
  const userId = await getCurrentSession();
  if (!userId) redirect('/login');
  const { messages } = await getI18n();
  const copy = messages.app.academicRecord;

  const records: AcademicRecord[] = await prisma.academicRecord.findMany({
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
        title={copy.title}
        description={copy.description}
      />
      <main className="space-y-4 pt-2">
        {user?.publicId ? (
          <p className="text-xs text-muted-foreground font-mono">
            {copy.idLabel} {user.publicId}
          </p>
        ) : null}
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {copy.empty}
          </p>
        ) : (
          <div className="space-y-4">
            {records.map((r) => (
              <Card key={r.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {r.subject ?? copy.subjectFallback}{' '}
                    {r.grade ? `· ${copy.gradeLabel} ${r.grade}` : ''}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {r.score != null && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">{copy.scoreLabel}</span> {r.score}
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
