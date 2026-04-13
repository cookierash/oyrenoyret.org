import { SiteHeader } from '@/src/components/layout/site-header';
import { SiteFooter } from '@/src/components/layout/site-footer';
import { BrandText } from '@/src/components/ui/brand-text';
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
            <BrandText>{copy.title}</BrandText>
          </h1>
          <p className="text-sm text-muted-foreground">
            <BrandText>{copy.updated}</BrandText>
          </p>
          <p className="text-base text-muted-foreground">
            <BrandText>{copy.intro}</BrandText>
          </p>
        </div>

        <section className="mt-10 space-y-8">
          <div className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              <BrandText>{copy.sections.controller}</BrandText>
            </h2>
            <p className="text-sm text-muted-foreground">
              <BrandText>{copy.controllerBody}</BrandText>
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              <BrandText>{copy.sections.lawful}</BrandText>
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {copy.lawfulItems.map((item) => (
                <li key={item}>
                  <BrandText>{item}</BrandText>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              <BrandText>{copy.sections.rights}</BrandText>
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {copy.rightsItems.map((item) => (
                <li key={item}>
                  <BrandText>{item}</BrandText>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              <BrandText>{copy.sections.transfers}</BrandText>
            </h2>
            <p className="text-sm text-muted-foreground">
              <BrandText>{copy.transfersBody}</BrandText>
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              <BrandText>{copy.sections.retention}</BrandText>
            </h2>
            <p className="text-sm text-muted-foreground">
              <BrandText>{copy.retentionBody}</BrandText>
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              <BrandText>{copy.sections.exercise}</BrandText>
            </h2>
            <p className="text-sm text-muted-foreground">
              <BrandText>{copy.exerciseBody}</BrandText>
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              <BrandText>{copy.sections.complaints}</BrandText>
            </h2>
            <p className="text-sm text-muted-foreground">
              <BrandText>{copy.complaintsBody}</BrandText>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
