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
import { PiMedal as Award, PiCalendar as Calendar, PiCheckCircle as CheckCircle } from 'react-icons/pi';
import { getI18n } from '@/src/i18n/server';
import { getLocaleCode } from '@/src/i18n';

interface CertificatePageProps {
  params: Promise<{ id: string }>;
}

export default async function CertificatePage({ params }: CertificatePageProps) {
    const { id } = await params;
    const userId = await getCurrentSession();
    if (!userId) redirect('/login');

    const { t, messages, locale } = await getI18n();
    const copy = messages.certificates;
    const localeCode = getLocaleCode(locale);

    const certificate = await prisma.certificate.findUnique({
        where: { id },
        include: { user: true }
    });

    if (!certificate) return notFound();

    // Only allow the owner (or admins, if roles are checked) to view it
    if (certificate.userId !== userId) {
        return redirect('/academic-record');
    }

    const issuedDate = new Intl.DateTimeFormat(localeCode, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(new Date(certificate.issuedAt));

    return (
        <div className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <PageHeader
                title={copy.detailsTitle}
                description={copy.detailsDescription}
            />

            <Card className="mt-2 border border-primary/20 bg-card overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-bl-[100%] -z-10" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary/10 rounded-tr-[100%] -z-10" />

                <CardContent className="p-10 sm:p-16 text-center space-y-8">
                    <div className="flex justify-center">
                        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center ring-8 ring-background outline outline-1 outline-primary/20">
                            <Award className="w-10 h-10 text-primary" />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h1 className="text-3xl sm:text-4xl font-semibold font-comfortaa text-primary tracking-tight">
                            {copy.completionTitle}
                        </h1>
                        <p className="text-muted-foreground uppercase tracking-normal text-sm font-medium">
                            {copy.acknowledgesLabel}
                        </p>
                        <h2 className="text-2xl sm:text-3xl font-medium text-foreground">
                            {certificate.user.firstName} {certificate.user.lastName}
                        </h2>
                    </div>

                    <div className="pt-4 pb-4 border-y border-border/50">
                        <p className="text-muted-foreground mb-4">{copy.completedLabel}</p>
                        <h3 className="text-xl font-medium mb-2">{certificate.title}</h3>
                        {certificate.description && (
                            <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
                                {certificate.description}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-8 text-sm text-foreground/80 pt-4">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-primary" />
                            <span>
                                {t('certificates.issuedLabel', { date: issuedDate })}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 font-medium">
                            <CheckCircle className="w-4 h-4 text-emerald-500" />
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {copy.verifiedLabel}{' '}
                              <span className="brand-font lowercase">oyrenoyret</span>
                            </span>
                        </div>
                    </div>

                    <div className="pt-8 text-xs text-muted-foreground font-mono">
                        {t('certificates.idLabel', { id: certificate.id })}
                    </div>
                </CardContent>
            </Card>

            <div className="mt-8 text-center text-sm text-muted-foreground sm:flex justify-center gap-4">
                <a href="/academic-record" className="hover:text-foreground hover:underline transition-colors">
                    &larr; {copy.backToRecord}
                </a>
            </div>
        </div>
    );
}
