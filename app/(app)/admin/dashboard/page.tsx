/**
 * Admin dashboard page
 *
 * Shows user activity statistics.
 */

import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
import { isStaff } from '@/src/lib/permissions';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';

export default async function AdminDashboardPage() {
  const userId = await getCurrentSession();
  if (!userId) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (!user || !isStaff(user.role)) {
    redirect('/dashboard');
  }

  const stats = await prisma.userActivityStats.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: {
      user: {
        select: {
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
  });

  const totals = stats.reduce(
    (acc, row) => ({
      materialsSharedTextual: acc.materialsSharedTextual + row.materialsSharedTextual,
      materialsSharedPractice: acc.materialsSharedPractice + row.materialsSharedPractice,
      liveProblemSprintTop3: acc.liveProblemSprintTop3 + row.liveProblemSprintTop3,
      liveGuidedGroupFacilitated:
        acc.liveGuidedGroupFacilitated + row.liveGuidedGroupFacilitated,
      discussionHelps: acc.discussionHelps + row.discussionHelps,
      materialsPurchasedFromUser:
        acc.materialsPurchasedFromUser + row.materialsPurchasedFromUser,
    }),
    {
      materialsSharedTextual: 0,
      materialsSharedPractice: 0,
      liveProblemSprintTop3: 0,
      liveGuidedGroupFacilitated: 0,
      discussionHelps: 0,
      materialsPurchasedFromUser: 0,
    },
  );

  return (
    <DashboardShell>
      <PageHeader
        title="Admin Dashboard"
        description="User activity statistics across the platform."
      />
      <div className="space-y-6">
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Textual Materials Shared
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {totals.materialsSharedTextual}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Practice Materials Shared
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {totals.materialsSharedPractice}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Live Sprint Top 3
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {totals.liveProblemSprintTop3}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Live Groups Facilitated
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {totals.liveGuidedGroupFacilitated}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Discussion Helps
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {totals.discussionHelps}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Materials Purchased
            </p>
            <p className="mt-2 text-2xl font-semibold text-foreground">
              {totals.materialsPurchasedFromUser}
            </p>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">User Activity</h2>
            <p className="text-xs text-muted-foreground">Showing latest {stats.length}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Public ID</th>
                  <th className="px-4 py-3">Textual</th>
                  <th className="px-4 py-3">Practice</th>
                  <th className="px-4 py-3">Top 3</th>
                  <th className="px-4 py-3">Guided</th>
                  <th className="px-4 py-3">Helps</th>
                  <th className="px-4 py-3">Purchased</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {stats.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-6 text-center text-sm text-muted-foreground"
                    >
                      No activity stats recorded yet.
                    </td>
                  </tr>
                ) : (
                  stats.map((row) => (
                    <tr key={row.id} className="border-t border-border/70">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-foreground">
                          {row.user?.firstName || row.user?.lastName
                            ? `${row.user?.firstName ?? ''} ${row.user?.lastName ?? ''}`.trim()
                            : row.user?.email ?? 'Unknown'}
                        </p>
                        {row.user?.email ? (
                          <p className="text-xs text-muted-foreground">{row.user.email}</p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {row.user?.role ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {row.userPublicId}
                      </td>
                      <td className="px-4 py-3">{row.materialsSharedTextual}</td>
                      <td className="px-4 py-3">{row.materialsSharedPractice}</td>
                      <td className="px-4 py-3">{row.liveProblemSprintTop3}</td>
                      <td className="px-4 py-3">{row.liveGuidedGroupFacilitated}</td>
                      <td className="px-4 py-3">{row.discussionHelps}</td>
                      <td className="px-4 py-3">{row.materialsPurchasedFromUser}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {row.updatedAt.toLocaleString('en-US')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
