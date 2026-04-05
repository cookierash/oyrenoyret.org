import { SiteHeader } from '@/src/components/layout/site-header';
import { SiteFooter } from '@/src/components/layout/site-footer';
import { getI18n } from '@/src/i18n/server';

export const metadata = {
  title: 'GDPR Compliance',
};

export default async function GdprPage() {
  const { messages } = await getI18n();
  const copy = messages.legals.gdpr;
  return (
    <div className="landing-light min-h-screen bg-background text-foreground">
      <SiteHeader showSpacer={false} showSeparator />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-20 pt-20 sm:px-6 lg:px-8">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {copy.title}
          </h1>
          <p className="text-sm text-muted-foreground">{copy.updated}</p>
          <p className="text-base text-muted-foreground">{copy.intro}</p>
        </div>

        <section className="mt-10 space-y-8">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{copy.sections.controller}</h2>
            <p className="text-sm text-muted-foreground">{copy.controllerBody}</p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{copy.sections.lawful}</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {copy.lawfulItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{copy.sections.rights}</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {copy.rightsItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{copy.sections.transfers}</h2>
            <p className="text-sm text-muted-foreground">{copy.transfersBody}</p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{copy.sections.retention}</h2>
            <p className="text-sm text-muted-foreground">{copy.retentionBody}</p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{copy.sections.exercise}</h2>
            <p className="text-sm text-muted-foreground">{copy.exerciseBody}</p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{copy.sections.complaints}</h2>
            <p className="text-sm text-muted-foreground">{copy.complaintsBody}</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
