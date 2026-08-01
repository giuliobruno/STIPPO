import { LegalSection, LegalShell } from "@/components/LegalShell";

export default function DisclaimerPage() {
  return (
    <LegalShell title="Disclaimers">
      <LegalSection title="1. Professional responsibility">
        <p>
          Visual Memory is a reference and organization tool for design professionals.
          It is <strong>not</strong> a substitute for professional judgment, code
          compliance review, structural calculation, accessibility assessment, or
          contractual documentation. Always verify materials, dimensions, and site
          conditions independently.
        </p>
      </LegalSection>

      <LegalSection title="2. AI & search accuracy">
        <p>
          Automatic titles, tags, OCR, entity extraction, and semantic search can miss,
          invent, or mislabel details. Treat AI output as a starting point, not as an
          authoritative project record.
        </p>
      </LegalSection>

      <LegalSection title="3. Location data">
        <p>
          GPS and EXIF location are approximate and optional. Do not rely on in-app
          coordinates for legal boundaries, surveying, or safety-critical navigation.
        </p>
      </LegalSection>

      <LegalSection title="4. Storage & availability">
        <p>
          Local-first originals depend on your device storage and backups. Cloud index
          availability depends on network and hosting uptime. We do not guarantee
          uninterrupted access or that every capture will process successfully.
        </p>
      </LegalSection>

      <LegalSection title="5. Third-party services">
        <p>
          Authentication providers, payment processors (Stripe), hosting, and optional
          AI providers operate under their own terms. Outages or policy changes at those
          providers may affect parts of the Service.
        </p>
      </LegalSection>

      <LegalSection title="6. Confidential client work">
        <p>
          You are responsible for ensuring that capturing and indexing client or site
          material complies with NDAs, photography restrictions, and local law. Do not
          upload sensitive content if your organization forbids cloud processing.
        </p>
      </LegalSection>

      <LegalSection title="7. No legal advice">
        <p>
          These pages are product disclosures, not legal advice. For jurisdiction-specific
          obligations (GDPR, CCPA, professional insurance, etc.), consult your counsel.
        </p>
      </LegalSection>
    </LegalShell>
  );
}
