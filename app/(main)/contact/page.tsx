import { getI18n } from '@/src/i18n/server';
import { ContactMessageForm } from '@/src/modules/contact/components/contact-message-form';
import { BrandText } from '@/src/components/ui/brand-text';

export const metadata = {
  title: 'Contact',
};

export default async function ContactPage() {
  const { messages } = await getI18n();
  const copy = messages.main.contact;
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
      <div className="mt-8 space-y-6">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-6">
          <p className="text-sm text-muted-foreground">
            <BrandText>{copy.noticeEmail}</BrandText>
            <a
              href="mailto:office@oyrenoyret.org"
              className="font-medium text-foreground underline underline-offset-4"
            >
              <BrandText>office@oyrenoyret.org</BrandText>
            </a>
            <BrandText>{copy.noticeInstagram}</BrandText>
            <a
              href="https://www.instagram.com/oyrenoyret.hzt/"
              className="font-medium text-foreground underline underline-offset-4"
              target="_blank"
              rel="noreferrer"
            >
              <BrandText>@oyrenoyret.hzt</BrandText>
            </a>
            .
          </p>
        </div>
        <ContactMessageForm />
      </div>
    </main>
  );
}
