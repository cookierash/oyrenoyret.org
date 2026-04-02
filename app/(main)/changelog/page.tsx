export const metadata = {
  title: 'Changelog',
};

export default function ChangelogPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-20 pt-20 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Changelog</h1>
        <p className="text-sm text-muted-foreground">
          Track updates to the platform, including feature releases and policy changes.
        </p>
      </div>
      <div className="mt-8 rounded-lg border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
        No public updates yet. We will publish release notes here as soon as they are ready.
      </div>
    </main>
  );
}
