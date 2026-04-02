export const metadata = {
  title: 'Blog',
};

export default function BlogPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-20 pt-20 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Blog</h1>
        <p className="text-sm text-muted-foreground">
          Stories, updates, and insights from the oyrenoyret team.
        </p>
      </div>
      <div className="mt-8 rounded-lg border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
        Blog posts are coming soon. Stay tuned for learning tips and platform updates.
      </div>
    </main>
  );
}
