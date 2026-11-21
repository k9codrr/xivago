import { CardLayoutPicker } from "@/components/settings/card-layout-picker";
import { NavStylePicker } from "@/components/settings/nav-style-picker";
import { HeroStylePicker } from "@/components/settings/hero-style-picker";
import { SheetStylePicker } from "@/components/settings/sheet-style-picker";
import { SoundToggle } from "@/components/settings/sound-toggle";
import { ExploreIconsPicker } from "@/components/settings/explore-icons-picker";
import { DeleteAccount } from "@/components/settings/delete-account";
import { PasswordSettings } from "@/components/settings/password-settings";
import Link from "next/link";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <main className="px-4 pb-28 pt-[max(env(safe-area-inset-top),1.5rem)]">
      <h1 className="mb-6 text-xl font-bold">Settings and privacy</h1>

      <section>
        <p className="mb-1 px-1 text-[13px] uppercase tracking-[0.02em] text-neutral-500">Feed card layout</p>
        <p className="mb-3 px-1 text-[13px] text-neutral-500">
          How requests and offers look on your home feed. Tapping a card opens the same details either way.
        </p>
        <CardLayoutPicker />
      </section>

      <section className="mt-8">
        <p className="mb-1 px-1 text-[13px] uppercase tracking-[0.02em] text-neutral-500">Home hero</p>
        <p className="mb-3 px-1 text-[13px] text-neutral-500">
          How featured requests at the top of your home page look. Same requests and actions either way.
        </p>
        <HeroStylePicker />
      </section>

      <section className="mt-8">
        <p className="mb-1 px-1 text-[13px] uppercase tracking-[0.02em] text-neutral-500">Post drawer</p>
        <p className="mb-3 px-1 text-[13px] text-neutral-500">
          How the drawer for posting a request or offer looks. It works the same in every style.
        </p>
        <SheetStylePicker />
      </section>

      <section className="mt-8">
        <p className="mb-1 px-1 text-[13px] uppercase tracking-[0.02em] text-neutral-500">Sounds</p>
        <p className="mb-3 px-1 text-[13px] text-neutral-500">Short sounds when you send, post, pay or scan. Saved on this device.</p>
        <SoundToggle />
      </section>

      <section className="mt-8">
        <p className="mb-1 px-1 text-[13px] uppercase tracking-[0.02em] text-neutral-500">Bottom navigation</p>
        <p className="mb-3 px-1 text-[13px] text-neutral-500">
          How the tab bar at the bottom of the screen looks. Same tabs either way.
        </p>
        <NavStylePicker />
      </section>

      <section className="mt-8">
        <p className="mb-1 px-1 text-[13px] uppercase tracking-[0.02em] text-neutral-500">Explore icons</p>
        <p className="mb-3 px-1 text-[13px] text-neutral-500">
          The 3D icon style on the Explore page cards. Same layout and features either way.
        </p>
        <ExploreIconsPicker />
      </section>

      <section className="mt-8">
        <p className="mb-1 px-1 text-[13px] uppercase tracking-[0.02em] text-neutral-500">Password</p>
        <p className="mb-3 px-1 text-[13px] text-neutral-500">
          Forgot it? Reset it with a code sent to your email or verified WhatsApp number.
        </p>
        <PasswordSettings />
      </section>

      <section className="mt-8">
        <p className="mb-1 px-1 text-[13px] uppercase tracking-[0.02em] text-neutral-500">Privacy</p>
        <p className="mb-3 px-1 text-[13px] text-neutral-500">
          Read our{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>{" "}
          and{" "}
          <Link href="/terms" className="underline">
            Terms of Service
          </Link>
          .
        </p>
      </section>

      <section className="mt-8">
        <p className="mb-1 px-1 text-[13px] uppercase tracking-[0.02em] text-red-500">Delete account</p>
        <DeleteAccount />
      </section>
    </main>
  );
}
