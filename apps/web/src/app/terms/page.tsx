import Link from "next/link";
import { LegalPage, LEGAL_CONTACT_EMAIL } from "@/components/legal-page";

export const metadata = { title: "Terms of Service" };

export default function TermsOfServicePage() {
  return (
    <LegalPage title="Terms of Service">
      <section>
        <p>
          These terms are an agreement between you and xivago. By creating an account or using xivago you accept them,
          together with our{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
      </section>

      <section>
        <h2>1. What xivago is</h2>
        <p>
          xivago connects people who need a service or product with providers who offer one. You can post a{" "}
          <b>request</b> (something you need) or an <b>offer</b> (something you provide). Providers respond to requests
          using a limited number of <b>response spots</b>, and you choose who to talk to. xivago is not a party to any
          deal you make with another user, and we do not guarantee the quality, safety or legality of what users offer.
        </p>
      </section>

      <section>
        <h2>2. Your account</h2>
        <ul>
          <li>You must be 18 or older and give true details about yourself.</li>
          <li>Keep your login, OTPs and transaction PIN secret. You are responsible for activity on your account.</li>
          <li>One person may hold only one account unless we agree otherwise.</li>
        </ul>
      </section>

      <section>
        <h2>3. Credits and payments</h2>
        <ul>
          <li>In-app prices are in credits. 1 credit = ₹1.</li>
          <li>
            Credits pay for response spots, featured placements and other features. Credits from rewards or promotions
            cannot be withdrawn.
          </li>
          <li>
            You can ask to withdraw credits you bought. A withdrawal reaches your bank after payment-gateway fees and
            GST, usually within 5–7 working days.
          </li>
          <li>Payments are processed by Razorpay under their terms.</li>
        </ul>
      </section>

      <section>
        <h2>4. What you must not do</h2>
        <ul>
          <li>Post anything illegal, misleading, hateful, sexual, violent, or that infringes someone else&rsquo;s rights.</li>
          <li>Spam, scam, harass or impersonate anyone, or collect other users&rsquo; data.</li>
          <li>Try to break, overload or get around the security of xivago.</li>
        </ul>
        <p className="mt-2">
          We may remove content, limit features, or suspend or close accounts that break these terms.
        </p>
      </section>

      <section>
        <h2>5. Your content</h2>
        <p>
          You own what you post. You give xivago permission to store, show and share it inside the service so the
          service can work. This permission ends when you delete the content or your account.
        </p>
      </section>

      <section>
        <h2>6. Deleting your account</h2>
        <p>
          You can delete your account at any time from{" "}
          <Link href="/settings" className="underline">
            Settings and privacy
          </Link>
          . Deletion is permanent. Your profile and everything you posted are removed, and any credits left in your
          wallet are lost, so withdraw them first. An active PRO subscription is cancelled. Payment and invoice records
          are kept for 8 years as the law requires (see the Privacy Policy).
        </p>
      </section>

      <section>
        <h2>7. Liability</h2>
        <p>
          xivago is provided &ldquo;as is&rdquo;. As far as the law allows, we are not liable for losses from deals
          between users, or for indirect losses. Our total liability to you is limited to the amount you paid us in
          the 3 months before the claim.
        </p>
      </section>

      <section>
        <h2>8. Changes and law</h2>
        <p>
          We may update these terms. If a change matters, we will ask you to accept it again. These terms follow the
          laws of India.
        </p>
      </section>

      <section>
        <h2>9. Contact</h2>
        <p>
          Questions or complaints:{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline">
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalPage>
  );
}
