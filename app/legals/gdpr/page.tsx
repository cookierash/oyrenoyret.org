import { SiteHeader } from '@/src/components/layout/site-header';
import { SiteFooter } from '@/src/components/layout/site-footer';

export const metadata = {
  title: 'GDPR Compliance',
};

export default function GdprPage() {
  return (
    <div className="landing-light min-h-screen bg-background text-foreground">
      <SiteHeader showSpacer={false} showSeparator />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-20 pt-20 sm:px-6 lg:px-8">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            GDPR Compliance
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: April 2, 2026</p>
          <p className="text-base text-muted-foreground">
            This page summarizes how oyrenoyret.org aligns with the General Data Protection
            Regulation for users in the EEA and the UK. We prioritize data minimization,
            parental oversight, and secure learning experiences.
          </p>
        </div>

        <section className="mt-10 space-y-8">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Data controller</h2>
            <p className="text-sm text-muted-foreground">
              oyrenoyret.org acts as the data controller for personal data processed on the
              platform. You can contact us through the support options in the platform.
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Lawful bases</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Consent when required for specific features or communications.</li>
              <li>Contract performance to deliver learning services you request.</li>
              <li>Legal obligations related to safety and recordkeeping.</li>
              <li>Legitimate interests to secure, improve, and protect the platform.</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Your rights</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Access, correct, or delete your personal data.</li>
              <li>Restrict or object to certain processing.</li>
              <li>Request data portability where applicable.</li>
              <li>Withdraw consent at any time where processing is consent-based.</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">International transfers</h2>
            <p className="text-sm text-muted-foreground">
              If we transfer data outside the EEA or the UK, we use appropriate safeguards,
              such as standard contractual clauses, to protect personal data.
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Data retention</h2>
            <p className="text-sm text-muted-foreground">
              We keep data only as long as needed to provide services, meet legal
              obligations, and protect the learning community.
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">How to exercise rights</h2>
            <p className="text-sm text-muted-foreground">
              To exercise GDPR rights, submit a request using the contact options available
              in the platform. Parents or guardians can act on behalf of minors.
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Complaints</h2>
            <p className="text-sm text-muted-foreground">
              You may lodge a complaint with your local supervisory authority if you believe
              your data protection rights have been violated.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
