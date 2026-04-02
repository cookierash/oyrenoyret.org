import { SiteHeader } from '@/src/components/layout/site-header';
import { SiteFooter } from '@/src/components/layout/site-footer';

export const metadata = {
  title: 'Terms of Service',
};

export default function TermsOfServicePage() {
  return (
    <div className="landing-light min-h-screen bg-background text-foreground">
      <SiteHeader showSpacer={false} showSeparator />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-20 pt-20 sm:px-6 lg:px-8">
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: April 2, 2026</p>
          <p className="text-base text-muted-foreground">
            These Terms of Service govern access to oyrenoyret.org and the learning tools we
            provide. By creating an account or using the platform, you agree to these terms.
          </p>
        </div>

        <section className="mt-10 space-y-8">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Who can use the platform</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Parents or guardians may create accounts for minors.</li>
              <li>Educators and staff may use the platform with appropriate authorization.</li>
              <li>All users must provide accurate and current account information.</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Account responsibility</h2>
            <p className="text-sm text-muted-foreground">
              Keep account details secure and notify us of any unauthorized access.
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Acceptable use</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>Be respectful in discussions, messages, and shared work.</li>
              <li>Do not attempt to access accounts or data you are not authorized to see.</li>
              <li>Do not upload content that is harmful, deceptive, or infringes rights.</li>
              <li>Do not disrupt the platform or misuse learning tools.</li>
            </ul>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Content and materials</h2>
            <p className="text-sm text-muted-foreground">
              Platform materials remain the property of oyrenoyret.org or its licensors.
              Content you submit remains yours, but you grant us permission to host, display,
              and process it to operate the service.
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Payments and purchases</h2>
            <p className="text-sm text-muted-foreground">
              If you purchase materials or credits, you agree to provide valid payment
              information. Digital content is delivered immediately unless otherwise stated.
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Suspension and termination</h2>
            <p className="text-sm text-muted-foreground">
              We may suspend or terminate access if terms are violated or if we need to
              protect the safety of learners and the platform.
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Changes to the service</h2>
            <p className="text-sm text-muted-foreground">
              We may improve or modify the platform over time. We will notify users of
              meaningful changes before updating these terms.
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Disclaimers</h2>
            <p className="text-sm text-muted-foreground">
              The platform is provided on an as-is basis. We do not guarantee specific
              learning outcomes, but we are committed to providing a safe and effective
              learning environment.
            </p>
          </div>
          <div className="space-y-3">
            <h2 className="text-lg font-semibold text-foreground">Contact</h2>
            <p className="text-sm text-muted-foreground">
              If you have questions about these terms, reach out through the contact options
              available in the platform.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
