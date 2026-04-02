export const metadata = {
  title: 'Documentation',
};

export default function DocumentationPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-20 pt-20 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Documentation
        </h1>
        <p className="text-sm text-muted-foreground">
          We are preparing product guides, onboarding steps, and platform FAQs.
          Check back soon for detailed documentation.
        </p>
      </div>
      <div className="mt-8 rounded-lg border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
        Documentation is in progress. We will publish getting-started guides and feature
        walkthroughs here.
      </div>
    </main>
  );
}
