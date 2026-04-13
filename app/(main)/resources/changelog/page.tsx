import { getI18n } from '@/src/i18n/server';
import { BrandText } from '@/src/components/ui/brand-text';

export const metadata = {
  title: 'Changelog',
};

type ChangelogSection = {
  label: string;
  items: string[];
};

type ChangelogEntry = {
  date: string;
  sections: ChangelogSection[];
};

function parseChangelogNotice(notice: string, fallbackLabel: string): ChangelogEntry[] {
  return notice
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      const [date, ...rest] = lines;
      const sections: ChangelogSection[] = [];
      let currentSection: ChangelogSection | null = null;

      rest.forEach((line) => {
        const isBullet = /^[-*•]\s+/.test(line);
        const isSectionLabel = !isBullet && /:\s*$/.test(line);

        if (isSectionLabel) {
          const label = line.replace(/:\s*$/, '').trim();
          if (label) {
            currentSection = { label, items: [] };
            sections.push(currentSection);
          }
          return;
        }

        if (isBullet) {
          const item = line.replace(/^[-*•]\s+/, '').trim();
          if (!item) return;
          if (!currentSection) {
            currentSection = { label: fallbackLabel, items: [] };
            sections.push(currentSection);
          }
          currentSection.items.push(item);
        }
      });

      return { date: date ?? '', sections };
    })
    .filter((entry) => entry.date);
}

export default async function ChangelogPage() {
  const { messages } = await getI18n();
  const copy = messages.main.changelog;
  const entries = parseChangelogNotice(copy.notice, copy.defaultSectionLabel);
  const hasEntries = entries.some((entry) =>
    entry.sections.some((section) => section.items.length > 0),
  );
  return (
    <main className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-24 pt-20 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          <BrandText>{copy.title}</BrandText>
        </h1>
        <p className="text-sm text-muted-foreground">
          <BrandText>{copy.subtitle}</BrandText>
        </p>
      </div>

      {hasEntries ? (
        <div className="mt-10 space-y-10">
          {entries.map((entry, index) => (
            <article key={`${entry.date}-${index}`} className="grid gap-6 md:grid-cols-[190px_1fr]">
              <div className="flex items-start gap-3">
                <div className="mt-2 h-2.5 w-2.5 rounded-full bg-foreground/80 ring-4 ring-muted/40" />
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <BrandText>{copy.releaseLabel}</BrandText>
                  </p>
                  <p className="text-lg font-medium text-foreground">
                    <BrandText>{entry.date}</BrandText>
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-border/60 bg-card/90 p-6">
                <div className="space-y-6">
                  {entry.sections.map((section, sectionIndex) => (
                    <div key={`${entry.date}-${sectionIndex}`} className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        <span className="rounded-full border border-border/60 bg-muted/40 px-2 py-1">
                          <BrandText>{section.label}</BrandText>
                        </span>
                      </div>
                      <ul className="space-y-3 text-sm text-muted-foreground">
                        {section.items.map((item, itemIndex) => (
                          <li key={`${entry.date}-${sectionIndex}-${itemIndex}`} className="flex gap-3">
                            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-foreground/60" />
                            <span>
                              <BrandText>{item}</BrandText>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-2xl border border-border/60 bg-muted/30 p-6 text-sm text-muted-foreground whitespace-pre-line leading-6">
          <BrandText>{copy.notice}</BrandText>
        </div>
      )}
    </main>
  );
}
