/**
 * Dashboard Page
 *
 * Personalized student dashboard with:
 * - Welcome greeting
 * - Upcoming live activities
 * - Recently purchased materials
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import {
  Calendar,
  Clock,
  Video,
  BookOpen,
  ChevronRight,
  Sparkles,
  Package,
} from 'lucide-react';

function getGreeting() {
  const hour = new Date().getUTCHours() + 4; // UTC+4 (user's timezone)
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default async function DashboardPage() {
  const userId = await getCurrentSession();
  if (!userId) redirect('/login');

  const now = new Date();

  // Fetch user info + upcoming activities + recent purchases in parallel
  const [user, upcomingActivities, recentPurchases] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    }),
    prisma.activity.findMany({
      where: {
        userId,
        date: { gte: now },
      },
      orderBy: { date: 'asc' },
      take: 4,
    }),
    prisma.materialAccess.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 4,
      include: {
        material: {
          select: {
            id: true,
            title: true,
            subjectId: true,
            topicId: true,
            materialType: true,
            difficulty: true,
          },
        },
      },
    }),
  ]);

  const displayName = user?.firstName || 'there';
  const greeting = getGreeting();

  return (
    <DashboardShell>
      {/* Greeting */}
      <header className="mb-8">
        <div className="flex items-center gap-2.5 mb-1">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">
            {greeting}, {displayName}! 👋
          </h1>
        </div>
        <p className="text-muted-foreground text-sm">
          Welcome back to your learning dashboard. Here&apos;s what&apos;s coming up.
        </p>
      </header>

      <main className="space-y-10">
        {/* Upcoming Live Activities */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Video className="h-4 w-4 text-emerald-500" />
              Upcoming Live Activities
            </h2>
            <Link
              href="/live-activities"
              className="text-xs text-muted-foreground hover:text-primary font-medium flex items-center gap-1 transition-colors"
            >
              View all
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {upcomingActivities.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-8 text-center">
              <Video className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No upcoming live activities scheduled.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">New sessions will appear here once added.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {upcomingActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="group rounded-xl border border-border bg-card p-4 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all duration-200 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2">
                      {activity.title}
                    </h3>
                    <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 rounded-full">
                      <Video className="h-2.5 w-2.5" />
                      {activity.type.replace(/_/g, ' ')}
                    </span>
                  </div>

                  {activity.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{activity.description}</p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-auto">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(activity.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    {activity.duration && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {activity.duration} min
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recently Purchased Materials */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Recently Purchased Materials
            </h2>
            <Link
              href="/my-materials"
              className="text-xs text-muted-foreground hover:text-primary font-medium flex items-center gap-1 transition-colors group"
            >
              <Package className="h-3.5 w-3.5" />
              All my materials
              <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>

          {recentPurchases.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-5 py-8 text-center">
              <BookOpen className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No materials purchased yet.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Browse the{' '}
                <Link href="/catalog" className="text-primary underline underline-offset-2">
                  catalog
                </Link>{' '}
                to find materials.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {recentPurchases.map(({ material, createdAt }) => (
                <Link
                  key={material.id}
                  href={`/catalog/${material.subjectId}/${material.topicId}/${material.id}`}
                  className="group rounded-xl border border-border bg-card p-4 hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {material.title}
                    </h3>
                    <span className={`shrink-0 inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full ${material.materialType === 'PRACTICE_TEST'
                      ? 'text-purple-600 bg-purple-50 dark:bg-purple-500/10 dark:text-purple-400'
                      : 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400'
                      }`}>
                      {material.materialType === 'PRACTICE_TEST' ? 'Test' : 'Textual'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-auto">
                    <span className="text-xs text-muted-foreground capitalize">
                      {material.subjectId.replace(/-/g, ' ')}
                    </span>
                    {material.difficulty && (
                      <>
                        <span className="text-muted-foreground/30">·</span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {material.difficulty.toLowerCase()}
                        </span>
                      </>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground/60">
                    Purchased{' '}
                    {new Date(createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </Link>
              ))}
            </div>
          )}

          {recentPurchases.length > 0 && (
            <div className="mt-3 text-center">
              <Link
                href="/my-materials"
                className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline underline-offset-4 transition-colors"
              >
                <Package className="h-4 w-4" />
                View all my materials
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </section>
      </main>
    </DashboardShell>
  );
}
