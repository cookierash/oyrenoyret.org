import { SiteHeader } from '@/src/components/layout/site-header';
import { SiteFooter } from '@/src/components/layout/site-footer';

export const metadata = {
  title: 'Privacy Policy',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="landing-light min-h-screen bg-background text-foreground">
      <SiteHeader showSpacer={false} showSeparator />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-20 pt-20 sm:px-6 lg:px-8">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: April 2, 2026</p>
          <p className="text-base text-muted-foreground">
            This Privacy Policy explains how oyrenoyret.org collects, uses, and protects
            information when you use our secure learning platform. We build for minors and
            prioritize parent oversight, data minimization, and safety.
          </p>
        </div>

        <section className="mt-10 space-y-8">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Information we collect</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Account and profile details such as name, email, and role.</li>
              <li>Parent or guardian contact information for minor accounts.</li>
              <li>Learning activity, progress, and submissions.</li>
              <li>Messages, discussions, and support requests.</li>
              <li>Technical data such as device, browser, IP address, and logs.</li>
              <li>Transaction records if you purchase materials or credits.</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">How we use information</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Provide, secure, and personalize the platform experience.</li>
              <li>Authenticate sessions and prevent fraud or abuse.</li>
              <li>Communicate updates, learning notifications, and support responses.</li>
              <li>Improve platform quality, safety, and accessibility.</li>
              <li>Comply with legal and regulatory obligations.</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Cookies and sessions</h2>
            <p className="text-sm text-muted-foreground">
              We use strictly necessary cookies to keep sessions secure. For details, review
              the Cookie Policy.
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">How we share information</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                With vetted service providers that help us host, secure, and operate the
                platform.
              </li>
              <li>With parents or guardians for minor accounts and learning oversight.</li>
              <li>When required by law or to protect safety and platform integrity.</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Data retention</h2>
            <p className="text-sm text-muted-foreground">
              We retain information for as long as an account is active or as needed to
              provide services, resolve disputes, and meet legal obligations.
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Your rights and choices</h2>
            <p className="text-sm text-muted-foreground">
              You can request access, correction, export, or deletion of personal data as
              permitted by law. Parents or guardians can manage data on behalf of minors.
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Contact</h2>
            <p className="text-sm text-muted-foreground">
              If you have privacy questions, reach out through the contact options available
              in the platform.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
