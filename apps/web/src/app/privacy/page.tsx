import Link from "next/link";
import { LegalPage, LEGAL_CONTACT_EMAIL } from "@/components/legal-page";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <section>
        <p>
          xivago (&ldquo;we&rdquo;, &ldquo;us&rdquo;) helps people find the right person: you post a request or an
          offer, providers respond, and you choose who to talk to. This policy explains what personal data we collect,
          why, and the choices you have. It is written to meet India&rsquo;s Digital Personal Data Protection Act, 2023
          and the Information Technology Act, 2000 and its rules.
        </p>
      </section>

      <section>
        <h2>1. Data we collect</h2>
        <ul>
          <li>
            <b>Account details:</b> name, email address, mobile number (when you sign in with WhatsApp), password (stored
            only as a one-way hash), and your Facebook name and photo if you sign in with Facebook.
          </li>
          <li>
            <b>Profile details you add:</b> photo, bio, company name and logo, website, location, services and
            categories.
          </li>
          <li>
            <b>What you post:</b> requests, offers, feed posts, comments, polls, community content, photos and files,
            ratings, and chat messages with other users.
          </li>
          <li>
            <b>Location:</b> only when you allow it, to show requests and posts near you.
          </li>
          <li>
            <b>Payments and credits:</b> top-ups, response spots, featured placements, withdrawals and invoices.
            Card, UPI and bank details are handled by our payment partner Razorpay. We never see or store them.
          </li>
          <li>
            <b>Device and usage data:</b> IP address, browser or device type, push-notification tokens, and the pages
            you view, so we can keep the service secure and working.
          </li>
          <li>
            <b>Consent records:</b> the date and time you accepted this policy and our Terms, and each time you ticked
            or unticked the consent box, with your IP address and browser.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Why we use it</h2>
        <ul>
          <li>To create and run your account and show your profile, requests and offers to other users.</li>
          <li>To match requests with providers, deliver chats and send notifications you have turned on.</li>
          <li>To process payments, credits, withdrawals and invoices.</li>
          <li>To keep xivago safe: detect fraud and spam, check uploaded images, and enforce our Terms.</li>
          <li>To meet legal duties, such as tax and accounting records.</li>
        </ul>
        <p className="mt-2">We do not sell your personal data, and we do not use it for third-party advertising.</p>
      </section>

      <section>
        <h2>3. Who we share it with</h2>
        <ul>
          <li>
            <b>Other users:</b> what you choose to make public (your profile, requests, offers and posts). Chats are seen
            only by the people in them.
          </li>
          <li>
            <b>Service providers that run xivago for us:</b> hosting and database, Cloudflare (file storage), Razorpay
            (payments), Meta (WhatsApp sign-in codes and messages, Facebook login), Firebase and web push (notifications),
            and an image-moderation service. Each may use the data only to provide their service to us.
          </li>
          <li>
            <b>Authorities:</b> when the law requires it, or to protect users from harm.
          </li>
        </ul>
      </section>

      <section>
        <h2>4. How long we keep it</h2>
        <p>
          We keep your data while your account is open. When you delete your account, your profile, requests, offers,
          posts, comments, chats, ratings, communities you created and uploaded files are permanently removed. We keep
          a short deletion record (date, a masked email and phone number, and how many items were removed) and your
          consent records, so we can show what happened if asked. Your payment, invoice, credit and withdrawal records,
          with your name, email and phone number, are kept for 8 years because Indian tax and company law require it.
          They are used only for accounting, tax, and payment disputes, and only our admins can see them.
        </p>
      </section>

      <section>
        <h2>5. Your rights</h2>
        <ul>
          <li>See and correct your data from your profile at any time.</li>
          <li>
            Delete your account and your content: go to{" "}
            <Link href="/settings" className="underline">
              Settings and privacy
            </Link>{" "}
            → Delete my account.
          </li>
          <li>Withdraw consent at any time by deleting your account. This does not affect what was done before.</li>
          <li>Turn notifications off in your profile settings.</li>
          <li>Raise a complaint with our Grievance Officer (below) or with the Data Protection Board of India.</li>
        </ul>
      </section>

      <section>
        <h2>6. Security</h2>
        <p>
          We use encrypted connections (HTTPS), hashed passwords and PINs, and limited staff access. No system is
          perfectly secure. If a breach affects you, we will tell you and the authorities as the law requires.
        </p>
      </section>

      <section>
        <h2>7. Children</h2>
        <p>xivago is for people aged 18 and over. We do not knowingly collect data from children.</p>
      </section>

      <section>
        <h2>8. Changes to this policy</h2>
        <p>
          If we change this policy in a way that matters, we will ask you to read and accept it again before you
          continue using xivago.
        </p>
      </section>

      <section>
        <h2>9. Contact and Grievance Officer</h2>
        <p>
          For any privacy question, request or complaint, write to{" "}
          <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline">
            {LEGAL_CONTACT_EMAIL}
          </a>
          . We reply within 30 days.
        </p>
      </section>
    </LegalPage>
  );
}
