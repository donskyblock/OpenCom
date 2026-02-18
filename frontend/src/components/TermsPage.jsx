export function TermsPage({ onBack }) {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <img src="logo.png" alt="OpenCom" className="landing-logo" />
        <span className="landing-brand">OpenCom</span>
      </header>

      <main className="legal-main">
        <article className="legal-card">
          <h1>Terms of Service</h1>
          <p className="legal-meta">Last updated: February 18, 2026</p>

          <section>
            <h2>1. Acceptance</h2>
            <p>
              By accessing or using OpenCom, you agree to these Terms of Service. If you do not agree, do not use the service.
            </p>
          </section>

          <section>
            <h2>2. Eligibility and Accounts</h2>
            <p>
              You must provide accurate account information and keep your credentials secure. You are responsible for activity
              on your account.
            </p>
          </section>

          <section>
            <h2>3. Acceptable Use</h2>
            <p>You may not use OpenCom to:</p>
            <ul>
              <li>violate any law or regulation;</li>
              <li>harass, threaten, exploit, or impersonate others;</li>
              <li>upload malware, attempt unauthorized access, or disrupt services;</li>
              <li>infringe intellectual property or privacy rights;</li>
              <li>distribute spam, fraud, or deceptive content.</li>
            </ul>
          </section>

          <section>
            <h2>4. User Content</h2>
            <p>
              You retain ownership of content you submit. You grant OpenCom a worldwide, non-exclusive license to host, process,
              store, and display that content solely to operate and improve the service.
            </p>
          </section>

          <section>
            <h2>5. Moderation and Enforcement</h2>
            <p>
              We may investigate reports and remove content, suspend features, or terminate accounts that violate these Terms or
              create legal, security, or abuse risk.
            </p>
          </section>

          <section>
            <h2>6. Paid Features and Billing</h2>
            <p>
              Paid subscriptions and boosts may auto-renew unless canceled before renewal. Fees are generally non-refundable except
              where required by law.
            </p>
          </section>

          <section>
            <h2>7. Third-Party Services</h2>
            <p>
              OpenCom may link to or integrate third-party services. We are not responsible for third-party content, terms, or data
              handling.
            </p>
          </section>

          <section>
            <h2>8. Service Availability</h2>
            <p>
              OpenCom is provided on an "as is" and "as available" basis. We do not guarantee uninterrupted or error-free service.
            </p>
          </section>

          <section>
            <h2>9. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, OpenCom and its operators are not liable for indirect, incidental, special,
              consequential, or punitive damages, or loss of data, profits, or goodwill.
            </p>
          </section>

          <section>
            <h2>10. Termination</h2>
            <p>
              You may stop using OpenCom at any time. We may suspend or terminate access where necessary to enforce these Terms,
              prevent abuse, or comply with legal obligations.
            </p>
          </section>

          <section>
            <h2>11. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. Continued use after changes become effective constitutes acceptance of the
              revised Terms.
            </p>
          </section>

          <section>
            <h2>12. Contact</h2>
            <p>
              Questions about these Terms can be sent to <a href="mailto:don@opencom.online">don@opencom.online</a>.
            </p>
          </section>
        </article>

        <div className="legal-actions">
          <button type="button" className="landing-btn landing-btn-secondary" onClick={onBack}>
            Back
          </button>
        </div>
      </main>
    </div>
  );
}
