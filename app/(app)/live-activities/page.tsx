/**
 * Live Activities Page
 *
 * View upcoming and past live sessions for the student.
 */

import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
import { DashboardShell } from '@/src/components/ui/dashboard-shell';
import { PageHeader } from '@/src/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, Video } from 'lucide-react';

export default async function LiveActivitiesPage() {
    const userId = await getCurrentSession();
    if (!userId) redirect('/login');

    const activities = await prisma.activity.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
    });

    return (
        <DashboardShell>
            <PageHeader
                title="Live Activities"
                description="Your upcoming and past live sessions."
            />

            <main className="space-y-4 pt-4">
                {activities.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No live activities found. Sessions will appear here once scheduled.
                    </p>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                        {activities.map((activity) => (
                            <Card key={activity.id} className="flex flex-col h-full hover:border-primary/50 transition-colors">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start gap-4">
                                        <CardTitle className="text-lg font-semibold leadng-tight">
                                            {activity.title}
                                        </CardTitle>
                                        <div className="flex items-center gap-1 shrink-0 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full dark:bg-emerald-500/10 dark:text-emerald-400">
                                            <Video className="w-3 h-3" />
                                            <span>{activity.type.replace('_', ' ')}</span>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-3 flex-1 flex flex-col justify-end">
                                    {activity.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {activity.description}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground mt-2">
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {new Date(activity.date).toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </div>
                                        {activity.duration && (
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                {activity.duration} mins
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </main>
        </DashboardShell>
    );
}
