import { SiteHeader } from '@/src/components/layout/site-header';
import { SiteFooter } from '@/src/components/layout/site-footer';

export const metadata = {
  title: 'Cookie Policy',
};

const cookieRows = [
  {
    name: 'session_token',
    purpose: 'Keeps you signed in and ties your browser to your secure session.',
    setWhen: 'Set after you log in and is refreshed during active sessions.',
    duration: 'Up to 7 days, or until you log out.',
    attributes: 'HTTP-only, SameSite=Lax, Secure in production.',
  },
];

export default function CookiePolicyPage() {
  return (
    <div className="landing-light min-h-screen bg-background text-foreground">
      <SiteHeader showSpacer={false} showSeparator />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-20 pt-20 sm:px-6 lg:px-8">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Cookie Policy
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: April 2, 2026</p>
          <p className="text-base text-muted-foreground">
            This Cookie Policy explains how oyrenoyret.org uses cookies on the
            platform. We only use strictly necessary, first-party cookies to keep
            sessions secure. We do not use analytics, marketing, or advertising
            cookies.
          </p>
        </div>

        <section className="mt-10 space-y-8">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">What cookies are</h2>
            <p className="text-sm text-muted-foreground">
              Cookies are small text files stored in your browser. They help the
              platform remember your authenticated session so you can navigate
              securely between pages.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">How we use cookies</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Keep you signed in while you move through the platform.</li>
              <li>Protect access to student data and private learning areas.</li>
              <li>Enforce core security controls like session expiry.</li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Cookies we set</h2>
            <div className="overflow-hidden rounded-lg border border-border/60">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Cookie</th>
                    <th className="px-4 py-3">Purpose</th>
                    <th className="px-4 py-3">When it is set</th>
                    <th className="px-4 py-3">Duration</th>
                    <th className="px-4 py-3">Attributes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {cookieRows.map((row) => (
                    <tr key={row.name} className="bg-background">
                      <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.purpose}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.setWhen}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.duration}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.attributes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Your choices</h2>
            <p className="text-sm text-muted-foreground">
              The session cookie is strictly necessary, so it cannot be disabled from
              within the platform. You can clear cookies in your browser or log out
              to remove the session cookie.
            </p>
          </div>

          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Changes to this policy</h2>
            <p className="text-sm text-muted-foreground">
              If we add optional cookies in the future, we will update this policy and
              the cookie settings dialog before enabling them.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
