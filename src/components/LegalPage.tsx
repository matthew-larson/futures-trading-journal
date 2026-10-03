import { ArrowLeft, Shield, FileText } from "lucide-react";
import { AiDisclaimer } from "@/components/Disclaimer";

interface LegalPageProps {
  onBack: () => void;
  type: "terms" | "privacy";
}

export function LegalPage({ onBack, type }: LegalPageProps) {
  const isTerms = type === "terms";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-base-400 transition-colors hover:text-base-200"
        >
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-base-700 to-base-800 border border-base-600 text-base-200">
          {isTerms ? <FileText size={22} /> : <Shield size={22} />}
        </div>
        <div>
          <h1 className="text-xl font-bold text-base-50">
            {isTerms ? "Terms of Service" : "Privacy Policy"}
          </h1>
          <p className="mt-0.5 text-sm text-base-500">Last updated: October 3, 2026</p>
        </div>
      </div>

      <div className="space-y-6 rounded-2xl border border-base-800 bg-base-900/50 p-6 text-sm leading-relaxed text-base-300">
        {isTerms ? <TermsContent /> : <PrivacyContent />}

        <AiDisclaimer className="mt-6" />

        <div className="border-t border-base-800 pt-4">
          <p className="text-xs text-base-500">
            EdgePilot is provided "as is" without warranty of any kind. By using this application you acknowledge that you have read and understood these terms.
            If you have questions about this policy, contact us through the in-app feedback feature.
          </p>
        </div>
      </div>
    </div>
  );
}

function TermsContent() {
  return (
    <>
      <Section title="1. Acceptance of Terms">
        By creating an account and using EdgePilot, you agree to these Terms of Service.
        If you do not agree, you should not use the application.
      </Section>

      <Section title="2. Educational Purpose">
        EdgePilot is a trading journal and analytics tool. All AI-generated insights, coaching responses,
        trade analyses, and performance reports are provided for educational and informational purposes only.
        They do not constitute financial advice, investment recommendations, or solicitations to buy or sell
        any security or derivative product.
      </Section>

      <Section title="3. Risk Acknowledgment">
        Futures trading carries a substantial risk of loss and is not suitable for all investors.
        You can lose more than your initial investment. You are solely responsible for your own trading
        decisions and for any gains or losses you incur. EdgePilot and its operators are not liable for
        any financial losses resulting from actions taken based on information provided by the application.
      </Section>

      <Section title="4. Your Data">
        You retain ownership of all trade data, journal notes, screenshots, and other content you upload.
        EdgePilot stores this data solely to provide journaling and analytics features to you.
        You may export your data at any time and may delete your account and all associated data upon request.
      </Section>

      <Section title="5. Acceptable Use">
        You agree not to abuse the service, including but not limited to: attempting to access other users' data,
        reverse-engineering the application, overwhelming the AI or payment endpoints with automated requests,
        or using the service for any unlawful purpose.
      </Section>

      <Section title="6. Service Availability">
        EdgePilot is provided on a best-effort basis. We do not guarantee uninterrupted access and may modify
        or discontinue features at any time without prior notice.
      </Section>

      <Section title="7. Limitation of Liability">
        To the maximum extent permitted by law, EdgePilot and its operators shall not be liable for any
        indirect, incidental, special, or consequential damages arising from your use of the application,
        including but not limited to trading losses, lost profits, or data loss.
      </Section>

      <Section title="8. Changes to These Terms">
        We may update these terms from time to time. Continued use of EdgePilot after changes constitutes
        acceptance of the revised terms.
      </Section>
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <Section title="1. Information We Collect">
        <p className="mb-2">When you create an account, we collect:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li>Your email address, for authentication and account management.</li>
          <li>Trade data you enter or import, including instrument, direction, prices, quantities, timestamps, notes, emotions, and screenshots.</li>
          <li>Trading rules, coaching conversations, and feedback you submit.</li>
          <li>Aggregate analytics derived from your trade history (win rate, P&L, discipline scores, discovered patterns).</li>
        </ul>
      </Section>

      <Section title="2. How We Store Your Data">
        Your data is stored in a secured database with row-level security policies that ensure only you can
        read or modify your own records. Screenshots are stored in a private bucket accessible only through
        time-limited signed URLs tied to your authenticated session.
      </Section>

      <Section title="3. How We Use Your Data">
        Your data is used exclusively to provide EdgePilot's journaling, analytics, and coaching features to you.
        We do not sell your data to third parties. AI coaching and analysis features process your trade data
        server-side to generate personalized insights; your data is not shared with other users.
      </Section>

      <Section title="4. Data Retention and Deletion">
        Your data is retained for as long as your account is active. You may export your data at any time
        using the in-app export feature. To permanently delete your account and all associated data, use the
        account deletion option in Settings or contact us through the in-app feedback feature.
      </Section>

      <Section title="5. Third-Party Services">
        EdgePilot uses the following third-party services:
        <ul className="ml-4 mt-2 list-disc space-y-1">
          <li><strong>Supabase</strong> — database, authentication, file storage, and server-side functions.</li>
          <li><strong>Stripe</strong> — payment processing for optional donations. Stripe processes your payment information directly; we never see or store your card details.</li>
        </ul>
      </Section>

      <Section title="6. Security">
        We employ row-level security, authenticated server-side functions, and private file storage to protect
        your data. However, no method of internet transmission or electronic storage is fully secure.
        We cannot guarantee absolute security.
      </Section>

      <Section title="7. Changes to This Policy">
        We may update this privacy policy from time to time. We will notify you of significant changes
        through the application.
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-base-100">{title}</h2>
      <div className="text-sm leading-relaxed text-base-400">{children}</div>
    </div>
  );
}
