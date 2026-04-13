import { getI18n } from '@/src/i18n/server';
import { BrandText } from '@/src/components/ui/brand-text';

export const metadata = {
  title: 'Documentation',
};

export default async function DocumentationPage() {
  const { messages } = await getI18n();
  const copy = messages.main.docs;
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
      <div className="mt-8 rounded-lg border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
        <BrandText>{copy.notice}</BrandText>
      </div>
    </main>
  );
}
