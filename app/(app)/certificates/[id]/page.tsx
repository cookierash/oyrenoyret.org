/**
 * Individual Certificate Page
 *
 * View details of a specific certificate securely.
 */

import { redirect, notFound } from 'next/navigation';
import { getCurrentSession } from '@/src/modules/auth/utils/session';
import { prisma } from '@/src/db/client';
import { PageHeader } from '@/src/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Award, Calendar, CheckCircle } from 'lucide-react';

export default async function CertificatePage({ params }: { params: { id: string } }) {
    const userId = await getCurrentSession();
    if (!userId) redirect('/login');

    const certificate = await prisma.certificate.findUnique({
        where: { id: params.id },
        include: { user: true }
    });

    if (!certificate) return notFound();

    // Only allow the owner (or admins, if roles are checked) to view it
    if (certificate.userId !== userId) {
        return redirect('/academic-record');
    }

    return (
        <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <PageHeader
                title="Certificate Details"
                description="Verify and view your achievement."
            />

            <Card className="mt-8 border-2 border-primary/20 bg-card overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-bl-[100%] -z-10" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary/10 rounded-tr-[100%] -z-10" />

                <CardContent className="p-10 sm:p-16 text-center space-y-8">
                    <div className="flex justify-center">
                        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center ring-8 ring-background outline outline-1 outline-primary/20">
                            <Award className="w-10 h-10 text-primary" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-3xl sm:text-4xl font-bold font-comfortaa text-primary tracking-tight">
                            Certificate of Completion
                        </h1>
                        <p className="text-muted-foreground uppercase tracking-widest text-sm font-semibold">
                            This acknowledges that
                        </p>
                        <h2 className="text-2xl sm:text-3xl font-semibold text-foreground">
                            {certificate.user.firstName} {certificate.user.lastName}
                        </h2>
                    </div>

                    <div className="pt-4 pb-4 border-y border-border/50">
                        <p className="text-muted-foreground mb-4">has successfully completed</p>
                        <h3 className="text-xl font-semibold mb-2">{certificate.title}</h3>
                        {certificate.description && (
                            <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
                                {certificate.description}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-sm text-foreground/80 pt-4">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            <span>Issued: {new Date(certificate.issuedAt).toLocaleDateString('en-US', {
                                year: 'numeric', month: 'long', day: 'numeric'
                            })}</span>
                        </div>
                        <div className="flex items-center gap-2 font-medium">
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">Verified by oyrenoyret</span>
                        </div>
                    </div>

                    <div className="pt-8 text-xs text-muted-foreground font-mono">
                        Certificate ID: {certificate.id}
                    </div>
                </CardContent>
            </Card>

            <div className="mt-8 text-center text-sm text-muted-foreground sm:flex justify-center gap-4">
                <a href="/academic-record" className="hover:text-foreground hover:underline transition-colors">
                    &larr; Back to Academic Record
                </a>
            </div>
        </div>
    );
}
