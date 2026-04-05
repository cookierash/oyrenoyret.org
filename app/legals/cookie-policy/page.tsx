import { SiteHeader } from '@/src/components/layout/site-header';
import { SiteFooter } from '@/src/components/layout/site-footer';
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
            {copy.title}
          </h1>
          <p className="text-sm text-muted-foreground">{copy.updated}</p>
          <p className="text-base text-muted-foreground">{copy.intro}</p>
        </div>

        <section className="mt-10 space-y-8">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{copy.sections.what}</h2>
            <p className="text-sm text-muted-foreground">{copy.whatBody}</p>
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
            <h2 className="text-lg font-semibold text-foreground">{copy.sections.set}</h2>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">{copy.table.cookie}</th>
                    <th className="px-4 py-3">{copy.table.purpose}</th>
                    <th className="px-4 py-3">{copy.table.setWhen}</th>
                    <th className="px-4 py-3">{copy.table.duration}</th>
                    <th className="px-4 py-3">{copy.table.attributes}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {copy.rows.map((row) => (
                    <tr key={row.name} className="bg-background">
                      <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.purpose}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.setWhen}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.duration}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.attributes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{copy.sections.choices}</h2>
            <p className="text-sm text-muted-foreground">{copy.choicesBody}</p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">{copy.sections.changes}</h2>
            <p className="text-sm text-muted-foreground">{copy.changesBody}</p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
