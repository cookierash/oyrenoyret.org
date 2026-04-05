import { SiteHeader } from '@/src/components/layout/site-header';
import { SiteFooter } from '@/src/components/layout/site-footer';
import { getI18n } from '@/src/i18n/server';

export const metadata = {
  title: 'Privacy Policy',
};

export default async function PrivacyPolicyPage() {
  const { messages } = await getI18n();
  const copy = messages.legals.privacyPolicy;
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
            <h2 className="text-lg font-semibold text-foreground">{copy.sections.collect}</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {copy.collectItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{copy.sections.use}</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {copy.useItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{copy.sections.cookies}</h2>
            <p className="text-sm text-muted-foreground">{copy.cookiesBody}</p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{copy.sections.share}</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {copy.shareItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{copy.sections.retention}</h2>
            <p className="text-sm text-muted-foreground">{copy.retentionBody}</p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{copy.sections.rights}</h2>
            <p className="text-sm text-muted-foreground">{copy.rightsBody}</p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{copy.sections.contact}</h2>
            <p className="text-sm text-muted-foreground">{copy.contactBody}</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
