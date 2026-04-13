import { SiteHeader } from '@/src/components/layout/site-header';
import { SiteFooter } from '@/src/components/layout/site-footer';
import { BrandText } from '@/src/components/ui/brand-text';
import { getI18n } from '@/src/i18n/server';

export const metadata = {
  title: 'Cookie Policy',
};

export default async function CookiePolicyPage() {
  const { messages } = await getI18n();
  const copy = messages.legals.cookiePolicy;
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
              <BrandText>{copy.sections.what}</BrandText>
            </h2>
            <p className="text-sm text-muted-foreground">
              <BrandText>{copy.whatBody}</BrandText>
            </p>
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
              <BrandText>{copy.sections.set}</BrandText>
            </h2>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">
                      <BrandText>{copy.table.cookie}</BrandText>
                    </th>
                    <th className="px-4 py-3">
                      <BrandText>{copy.table.purpose}</BrandText>
                    </th>
                    <th className="px-4 py-3">
                      <BrandText>{copy.table.setWhen}</BrandText>
                    </th>
                    <th className="px-4 py-3">
                      <BrandText>{copy.table.duration}</BrandText>
                    </th>
                    <th className="px-4 py-3">
                      <BrandText>{copy.table.attributes}</BrandText>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {copy.rows.map((row) => (
                    <tr key={row.name} className="bg-background">
                      <td className="px-4 py-3 font-medium text-foreground">
                        <BrandText>{row.name}</BrandText>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <BrandText>{row.purpose}</BrandText>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <BrandText>{row.setWhen}</BrandText>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <BrandText>{row.duration}</BrandText>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        <BrandText>{row.attributes}</BrandText>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              <BrandText>{copy.sections.choices}</BrandText>
            </h2>
            <p className="text-sm text-muted-foreground">
              <BrandText>{copy.choicesBody}</BrandText>
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-medium text-foreground">
              <BrandText>{copy.sections.changes}</BrandText>
            </h2>
            <p className="text-sm text-muted-foreground">
              <BrandText>{copy.changesBody}</BrandText>
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
