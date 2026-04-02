export const metadata = {
  title: 'Contact',
};

export default function ContactPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-20 pt-20 sm:px-6 lg:px-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Contact</h1>
        <p className="text-sm text-muted-foreground">
          Reach out to the oyrenoyret team with questions about learning, access, or support.
        </p>
      </div>
      <div className="mt-8 rounded-lg border border-border/60 bg-muted/20 p-6 text-sm text-muted-foreground">
        The contact form will be available soon. In the meantime, check the Help Center for
        quick answers.
      </div>
    </main>
  );
}
