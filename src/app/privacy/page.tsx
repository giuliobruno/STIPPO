import { LegalSection, LegalShell } from "@/components/LegalShell";

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy">
      <LegalSection title="1. Our privacy architecture">
        <p>
          Visual Memory is designed around a <strong>local-first</strong> and{" "}
          <strong>minimum-access</strong> model. By default, full-resolution project
          media stay on your device. The service is intentionally limited so it does{" "}
          <strong>not</strong> hold a browsable archive of your originals.
        </p>
        <p>
          Where data must leave the device (for cross-device search), we store only a
          lightweight semantic index — typically compressed thumbnails, voice
          transcripts you provide, and AI-derived labels — not your project library as
          a media vault.
        </p>
      </LegalSection>

      <LegalSection title="2. Encryption & access limits">
        <p>
          <strong>In transit:</strong> connections use HTTPS/TLS so credentials and
          data are encrypted between your client and our servers.
        </p>
        <p>
          <strong>At rest (credentials):</strong> passwords are stored only as strong
          one-way hashes (bcrypt). We cannot recover your plaintext password; you can
          replace it via Forgot password on the sign-in page.
        </p>
        <p>
          <strong>Cloud sync tokens:</strong> Google Drive / Dropbox access tokens are
          encrypted in your browser (IndexedDB + AES-GCM) and are never sent to Stippo
          servers. Full-resolution vault media stays on your device / your cloud folder
          (BYOS).
        </p>
        <p>
          <strong>Originals by default:</strong> full-resolution files remain on the
          capturing device and sync to <em>your</em> Drive/Dropbox folder. Stippo
          servers do not store full-res vault media on the primary capture path.
        </p>
        <p>
          <strong>Cloud index:</strong> the searchable index (understanding + optional
          thumbnails) is processed to provide the product. That index is account-scoped
          and not sold or shared for advertising.
        </p>
      </LegalSection>

      <LegalSection title="3. What we process">
        <ul className="list-disc space-y-1 pl-5">
          <li>Account identity: name, email, authentication tokens.</li>
          <li>Billing metadata via Stripe (card details never stored by us).</li>
          <li>Memory metadata: titles, tags, transcripts, AI summaries, project links.</li>
          <li>Optional location if you enable GPS / EXIF capture.</li>
          <li>Thumbnails / embeddings needed for search (Hybrid Plan B).</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. AI processing">
        <p>
          To make memories findable, submitted notes and (when provided) image
          thumbnails may be analyzed by automated vision/language systems. Outputs
          (titles, tags, summaries, embeddings) stay tied to your account for retrieval.
          Do not submit content you are not allowed to process under client or workplace
          rules.
        </p>
      </LegalSection>

      <LegalSection title="5. What we do not do">
        <ul className="list-disc space-y-1 pl-5">
          <li>We do not sell your personal data.</li>
          <li>We do not use your project media for advertising profiles.</li>
          <li>We do not train public foundation models on your private library as a product feature.</li>
          <li>We do not access local unsynced originals on your device.</li>
        </ul>
      </LegalSection>

      <LegalSection title="6. Your controls">
        <ul className="list-disc space-y-1 pl-5">
          <li>Export your account data (JSON) from Account.</li>
          <li>Delete individual memories at any time.</li>
          <li>
            Close your account with a three-step confirmation; we then delete account
            data, projects, memories, and associated media we hold, and cancel active
            subscriptions where possible.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Retention">
        <p>
          We retain account and index data while your account is active. After verified
          account deletion, we remove associated personal data from production systems
          except records we must keep for legal, tax, or fraud prevention (e.g. Stripe
          invoices).
        </p>
      </LegalSection>

      <LegalSection title="8. Contact">
        <p>
          Privacy requests: use the in-app Account tools first (export / delete). For
          additional inquiries, contact the operator of your Visual Memory deployment
          via the email published on the service homepage or billing receipts.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
