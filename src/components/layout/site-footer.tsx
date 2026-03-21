import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background/80">
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {new Date().getFullYear()}{' '}
          <span className="font-comfortaa lowercase">oyrenoyret.org</span> — NGO EdTech for minors
        </p>
        <div className="flex gap-6">
          <Link
            href="/login"
            className="transition-colors hover:text-foreground"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="transition-colors hover:text-foreground"
          >
            Get started
          </Link>
        </div>
      </div>
    </footer>
  );
}
