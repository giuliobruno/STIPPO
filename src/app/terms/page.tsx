import { LegalSection, LegalShell } from "@/components/LegalShell";

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Use">
      <LegalSection title="1. Acceptance">
        <p>
          By creating an account or using Visual Memory (“the Service”), you agree to
          these Terms of Use and the Privacy Policy. If you do not agree, do not use
          the Service.
        </p>
      </LegalSection>

      <LegalSection title="2. The Service">
        <p>
          Visual Memory helps architects and designers capture project references
          (images, notes, voice annotations), organize them by project, and retrieve
          them with hybrid search. Features may change as we improve the product.
        </p>
      </LegalSection>

      <LegalSection title="3. Accounts">
        <p>
          You must provide accurate registration information and keep credentials
          confidential. You are responsible for activity under your account. Notify us
          promptly of unauthorized access. We may suspend accounts that abuse the
          Service or violate these terms.
        </p>
      </LegalSection>

      <LegalSection title="4. Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Upload unlawful, infringing, or malicious content.</li>
          <li>Attempt to access other users’ data or circumvent security controls.</li>
          <li>Reverse engineer, overload, or disrupt the Service.</li>
          <li>Use the Service to violate client confidentiality or workplace policies.</li>
          <li>Resell or scrape the Service without written permission.</li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Your content">
        <p>
          You retain ownership of content you capture. You grant us a limited license
          to process and store only what is needed to operate the Service for you
          (indexing, sync, display, backup of the semantic index). Local-first
          originals remain under your control unless you opt into full-resolution sync.
        </p>
      </LegalSection>

      <LegalSection title="6. Plans & billing">
        <p>
          Free and paid plans (e.g. Pro) have different limits and features. Paid
          subscriptions are billed via Stripe according to the plan you select.
          Fees are generally non-refundable except where required by law. You may
          cancel renewal through the billing portal; access continues until the end of
          the paid period unless otherwise stated.
        </p>
      </LegalSection>

      <LegalSection title="7. AI features">
        <p>
          AI-generated titles, tags, and summaries are assistive and may be incomplete
          or incorrect. You remain responsible for verifying outputs before relying on
          them in professional deliverables.
        </p>
      </LegalSection>

      <LegalSection title="8. Termination">
        <p>
          You may delete your account at any time from Account settings (three-step
          confirmation). We may terminate or suspend access for breach, risk, or
          discontinuation of the Service. On deletion, data handling follows the Privacy
          Policy.
        </p>
      </LegalSection>

      <LegalSection title="9. Disclaimer of warranties">
        <p>
          The Service is provided “as is” and “as available” without warranties of any
          kind, express or implied, including fitness for a particular purpose and
          non-infringement, to the fullest extent permitted by law.
        </p>
      </LegalSection>

      <LegalSection title="10. Limitation of liability">
        <p>
          To the fullest extent permitted by law, Visual Memory and its operators are
          not liable for indirect, incidental, special, consequential, or lost-profit
          damages, or for loss of data beyond restoring what we can from our systems
          after a verified incident. Aggregate liability for claims relating to the
          Service is limited to the amounts you paid us in the three months before the
          claim (or €50 if you are on a free plan).
        </p>
      </LegalSection>

      <LegalSection title="11. Changes">
        <p>
          We may update these Terms. Material changes will be reflected by the “Last
          updated” date on this page. Continued use after changes constitutes
          acceptance.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
