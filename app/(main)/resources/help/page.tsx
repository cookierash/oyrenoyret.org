import Link from 'next/link';
import { getI18n } from '@/src/i18n/server';
import { BrandText } from '@/src/components/ui/brand-text';

export const metadata = {
  title: 'Help Center',
};

export default async function HelpCenterPage() {
  const { messages } = await getI18n();
  const copy = messages.main.help;
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-20 pt-20 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          <BrandText>{copy.title}</BrandText>
        </h1>
        <p className="text-sm text-muted-foreground">
          <BrandText>{copy.subtitle}</BrandText>
        </p>
      </div>
      <div className="mt-8 space-y-4">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
          <BrandText>{copy.notice}</BrandText>
        </div>
        <Link
          href="/contact"
          className="inline-flex items-center text-sm font-medium text-foreground transition-colors hover:text-foreground/80"
        >
          <BrandText>{copy.contact}</BrandText>
        </Link>
      </div>
    </main>
  );
}
