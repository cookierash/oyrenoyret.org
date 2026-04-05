import { getI18n } from '@/src/i18n/server';

export const metadata = {
  title: 'Contact',
};

export default async function ContactPage() {
  const { messages } = await getI18n();
  const copy = messages.main.contact;
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-20 pt-20 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
      </div>
      <div className="mt-8 rounded-lg border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
        {copy.notice}
        <a
          href="https://www.instagram.com/oyrenoyret.hzt/"
          className="font-medium text-foreground underline underline-offset-4"
          target="_blank"
          rel="noreferrer"
        >
          @oyrenoyret.hzt
        </a>
        .
      </div>
    </main>
  );
}
