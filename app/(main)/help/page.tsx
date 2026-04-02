import Link from 'next/link';

export const metadata = {
  title: 'Help Center',
};

export default function HelpCenterPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-20 pt-20 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Help Center</h1>
        <p className="text-sm text-muted-foreground">
          Find answers to common questions and learn how to navigate the platform.
        </p>
      </div>
      <div className="mt-8 space-y-4">
        <div className="rounded-lg border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
          Our help articles are being organized. If you need assistance right now, reach out
          through the contact page.
        </div>
        <Link
          href="/contact"
          className="inline-flex items-center text-sm font-semibold text-foreground transition-colors hover:text-foreground/80"
        >
          Contact support
        </Link>
      </div>
    </main>
  );
}
