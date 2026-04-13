import { SiteHeader } from '@/src/components/layout/site-header';
import { SiteFooter } from '@/src/components/layout/site-footer';
import { BrandText } from '@/src/components/ui/brand-text';
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
              <BrandText>{copy.sections.collect}</BrandText>
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {copy.collectItems.map((item) => (
                <li key={item}>
                  <BrandText>{item}</BrandText>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              <BrandText>{copy.sections.use}</BrandText>
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {copy.useItems.map((item) => (
                <li key={item}>
                  <BrandText>{item}</BrandText>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              <BrandText>{copy.sections.cookies}</BrandText>
            </h2>
            <p className="text-sm text-muted-foreground">
              <BrandText>{copy.cookiesBody}</BrandText>
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              <BrandText>{copy.sections.share}</BrandText>
            </h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {copy.shareItems.map((item) => (
                <li key={item}>
                  <BrandText>{item}</BrandText>
                </li>
              ))}
            </ul>
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
              <BrandText>{copy.sections.rights}</BrandText>
            </h2>
            <p className="text-sm text-muted-foreground">
              <BrandText>{copy.rightsBody}</BrandText>
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              <BrandText>{copy.sections.contact}</BrandText>
            </h2>
            <p className="text-sm text-muted-foreground">
              <BrandText>{copy.contactBody}</BrandText>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
