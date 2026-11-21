// "use client";

// import { useState } from "react";
// import { useForm } from "react-hook-form";
// import { zodResolver } from "@hookform/resolvers/zod";
// import { signIn } from "next-auth/react";
// import { useRouter, useSearchParams } from "next/navigation";
// import Link from "next/link";
// import { toast } from "sonner";
// import { Mail, MessageCircle } from "lucide-react";
// import { loginSchema, type LoginInput } from "@/lib/validation/auth";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { FieldError } from "@/components/ui/field-error";
// import { WhatsAppOtpLogin } from "@/components/whatsapp-otp-login";
// import { cn } from "@/lib/utils";

// const AUTH_ERROR_MESSAGES: Record<string, string> = {
//   CredentialsSignin: "Incorrect email or password.",
//   AccountBanned: "This account has been suspended. Contact support.",
//   FacebookEmailRequired:
//     "We couldn't get an email from Facebook. Please share your email permission, or sign up with email instead.",
// };

// type Tab = "email" | "whatsapp";

// export default function LoginPage() {
//   const router = useRouter();
//   const searchParams = useSearchParams();
//   const callbackUrl = searchParams.get("callbackUrl") ?? "/";
//   const urlError = searchParams.get("error");
//   const [submitting, setSubmitting] = useState(false);
//   const [tab, setTab] = useState<Tab>("email");

//   const {
//     register,
//     handleSubmit,
//     formState: { errors },
//   } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

//   async function onSubmit(values: LoginInput) {
//     setSubmitting(true);
//     try {
//       const result = await signIn("credentials", {
//         ...values,
//         redirect: false,
//       });
//       if (result?.error) {
//         toast.error(AUTH_ERROR_MESSAGES[result.error] ?? "Could not sign in.");
//         return;
//       }
//       router.push(callbackUrl);
//       router.refresh();
//     } finally {
//       setSubmitting(false);
//     }
//   }

//   return (
//     <main className="flex min-h-dvh flex-col justify-center px-6 py-10">
//       <div className="mx-auto w-full max-w-sm">
//         <h1 className="mb-1 text-2xl font-bold text-neutral-900">Log in</h1>
//         <p className="mb-6 text-sm text-neutral-500">
//           Welcome back to SlotBook.
//         </p>

//         {urlError && (
//           <div className="mb-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
//             {AUTH_ERROR_MESSAGES[urlError] ?? "Something went wrong. Please try again."}
//           </div>
//         )}

//         <div className="mb-5 flex rounded-xl bg-neutral-100 p-1">
//           <button
//             type="button"
//             onClick={() => setTab("email")}
//             className={cn(
//               "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors",
//               tab === "email" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500",
//             )}
//           >
//             <Mail className="h-3.5 w-3.5" /> Email
//           </button>
//           <button
//             type="button"
//             onClick={() => setTab("whatsapp")}
//             className={cn(
//               "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-colors",
//               tab === "whatsapp" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500",
//             )}
//           >
//             <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
//           </button>
//         </div>

//         {tab === "email" ? (
//           <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
//             <div>
//               <Label htmlFor="email">Email</Label>
//               <Input
//                 id="email"
//                 type="email"
//                 autoComplete="email"
//                 aria-invalid={Boolean(errors.email)}
//                 {...register("email")}
//               />
//               <FieldError message={errors.email?.message} />
//             </div>

//             <div>
//               <Label htmlFor="password">Password</Label>
//               <Input
//                 id="password"
//                 type="password"
//                 autoComplete="current-password"
//                 aria-invalid={Boolean(errors.password)}
//                 {...register("password")}
//               />
//               <FieldError message={errors.password?.message} />
//             </div>

//             <Button type="submit" className="w-full" disabled={submitting}>
//               {submitting ? "Logging in…" : "Log in"}
//             </Button>
//           </form>
//         ) : (
//           <WhatsAppOtpLogin callbackUrl={callbackUrl} />
//         )}

//         <div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
//           <div className="h-px flex-1 bg-neutral-200" />
//           OR
//           <div className="h-px flex-1 bg-neutral-200" />
//         </div>

//         <Button
//           type="button"
//           variant="outline"
//           className="w-full"
//           onClick={() => signIn("facebook", { callbackUrl })}
//         >
//           Continue with Facebook
//         </Button>

//         <p className="mt-6 text-center text-sm text-neutral-500">
//           New to SlotBook?{" "}
//           <Link href="/signup" className="font-semibold text-brand-600">
//             Create an account
//           </Link>
//         </p>
//       </div>
//     </main>
//   );
// }

"use client";

import { Suspense } from "react";

import { useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { WhatsAppOtpLogin } from "@/components/whatsapp-otp-login";
import { ForgotPasswordForm } from "@/components/forgot-password-form";
import { ConsentCheckbox } from "@/components/consent-checkbox";
import { savePendingConsent, useConsentCheckbox } from "@/lib/consent-client";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  CredentialsSignin: "Incorrect email or password.",
  AccountBanned: "This account has been suspended. Contact support.",
  FacebookEmailRequired:
    "We couldn't get an email from Facebook. Please share your email permission, or sign up with email instead.",
};

const darkInput =
  "mt-1.5 h-12 rounded-2xl border-white/10 bg-white/5 px-4 text-white placeholder:text-white/25 focus-visible:border-white/30 focus-visible:ring-white/20";

type View = "main" | "email" | "whatsapp" | "forgot";

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 384 512" fill="currentColor" className={className} aria-hidden>
      <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
    </svg>
  );
}

function HeroScene() {
  return (
    <div className="">
      <img src="https://i.pinimg.com/736x/da/d5/87/dad587ff4944ce4475649d37f7589dc2.jpg" alt="" />
    </div>
  );
}

// useSearchParams needs a Suspense boundary so the page can prerender.
export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-black" />}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const urlError = searchParams.get("error");
  const [view, setView] = useState<View>("main");
  const [submitting, setSubmitting] = useState(false);
  const consent = useConsentCheckbox();

  // Not signed in yet, so the ticks wait in sessionStorage; <ConsentGate>
  // logs them against the account straight after sign-in.
  function continueWith(next: () => void) {
    if (!consent.checked) {
      toast.error("Please confirm you are 18 or older and accept the Terms of Service and Privacy Policy to continue.");
      return;
    }
    savePendingConsent(consent.events);
    next();
  }

  const {
    register,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setSubmitting(true);
    try {
      const result = await signIn("credentials", {
        ...values,
        redirect: false,
      });
      if (result?.error) {
        toast.error(AUTH_ERROR_MESSAGES[result.error] ?? "Could not sign in.");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const errorBanner = urlError ? (
    <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {AUTH_ERROR_MESSAGES[urlError] ?? "Something went wrong. Please try again."}
    </div>
  ) : null;

  return (
    <main className=" h-screen w-full  text-white">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col">
        {view === "main" && (
          <button
            type="button"
            onClick={() => router.push(callbackUrl)}
            className="absolute right-4 top-[max(env(safe-area-inset-top),1rem)] z-30 rounded-full px-3 py-1.5 text-[15px] font-medium text-white/75 transition-colors hover:text-white"
          >
            Browse first
          </button>
        )}

        {/* Hero artwork */}
        <div className="relative h-[44dvh] min-h-[320px] shrink-0">
          <HeroScene />
        </div>

        {/* Brand */}
        <div className="relative z-10 -mt-8 flex flex-col items-center">
          <h1 className="sr-only">xivago</h1>
          <Image
            src="/logo/xivago-transparent-favicon.png"
            alt="xivago"
            width={96}
            height={96}
            priority
            className="h-24 w-24 object-contain"
          />
        </div>

        <div className="relative z-10 flex flex-1 flex-col px-6 pb-7 pt-9 bg-black">
          {view === "main" && (
            <div className="space-y-3">
              {errorBanner}

              {/* NOTE: swap "apple"/"google" for the provider ids you have
                  configured in NextAuth (e.g. "facebook"). */}
              <button
                type="button"
                disabled={!consent.checked}
                onClick={() => continueWith(() => signIn("apple", { callbackUrl }))}
                className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-pearl text-[15px] font-semibold text-slate-navy transition active:scale-[0.98] disabled:opacity-40"
              >
                <AppleIcon className="h-[18px] w-[18px]" />
                Continue with Apple
              </button>

              <button
                type="button"
                disabled={!consent.checked}
                onClick={() => continueWith(() => signIn("google", { callbackUrl }))}
                className="flex h-12 w-full items-center justify-center gap-2.5 rounded-full bg-pearl text-[15px] font-semibold text-slate-navy transition active:scale-[0.98] disabled:opacity-40"
              >
                <GoogleIcon className="h-[18px] w-[18px]" />
                Continue with Google
              </button>

              <button
                type="button"
                disabled={!consent.checked}
                onClick={() => continueWith(() => setView("email"))}
                className="flex h-12 w-full items-center justify-center rounded-full bg-white/10 text-[15px] font-semibold text-white ring-1 ring-white/10 transition active:scale-[0.98] disabled:opacity-40"
              >
                Continue with email
              </button>

              <ConsentCheckbox
                consent={consent}
                className="pt-2 text-white/60"
                linkClassName="text-white"
              />
            </div>
          )}

          {view === "email" && (
            <div>
              <button
                type="button"
                onClick={() => setView("main")}
                className="mb-5 flex items-center gap-0.5 text-[15px] text-white/70 transition-colors hover:text-white"
              >
                <ChevronLeft className="h-5 w-5" />
                Back
              </button>

              <h2 className="text-xl font-semibold">Continue with email</h2>
              <p className="mb-6 mt-1 text-sm text-white/50">Log in or create an account.</p>

              {errorBanner}

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
                <div>
                  <Label htmlFor="email" className="text-white/60">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    aria-invalid={Boolean(errors.email)}
                    {...register("email")}
                    className={darkInput}
                  />
                  <FieldError message={errors.email?.message} />
                </div>

                <div>
                  <Label htmlFor="password" className="text-white/60">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Your password"
                    aria-invalid={Boolean(errors.password)}
                    {...register("password")}
                    className={darkInput}
                  />
                  <FieldError message={errors.password?.message} />
                  <div className="mt-2 text-right">
                    <button
                      type="button"
                      onClick={() => setView("forgot")}
                      className="text-[13px] font-medium text-white/60 transition-colors hover:text-white"
                    >
                      Forgot password?
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="mt-1 h-12 w-full rounded-full bg-white text-[15px] font-semibold text-black hover:bg-white/90"
                >
                  {submitting ? "Logging in…" : "Log in"}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => setView("whatsapp")}
                className="mt-4 w-full text-center text-sm font-medium text-[#25D366]"
              >
                Continue with WhatsApp instead
              </button>

              <p className="mt-6 text-center text-sm text-white/50">
                New to xivago?{" "}
                <Link href="/signup" className="font-semibold text-white">
                  Create an account
                </Link>
              </p>
            </div>
          )}

          {view === "forgot" && (
            <div>
              <button
                type="button"
                onClick={() => setView("email")}
                className="mb-5 flex items-center gap-0.5 text-[15px] text-white/70 transition-colors hover:text-white"
              >
                <ChevronLeft className="h-5 w-5" />
                Back
              </button>
              <h2 className="text-xl font-semibold">Reset your password</h2>
              <p className="mb-6 mt-1 text-sm text-white/50">Get a code on WhatsApp and choose a new password.</p>
              <ForgotPasswordForm
                initialIdentifier={getValues("email") ?? ""}
                onDone={(identifier) => {
                  if (identifier.includes("@")) setValue("email", identifier.toLowerCase());
                  setValue("password", "");
                  setView("email");
                }}
              />
            </div>
          )}

          {view === "whatsapp" && (
            <div>
              <button
                type="button"
                onClick={() => setView("main")}
                className="mb-5 flex items-center gap-0.5 text-[15px] text-white/70 transition-colors hover:text-white"
              >
                <ChevronLeft className="h-5 w-5" />
                Back
              </button>
              <h2 className="mb-4 text-xl font-semibold">Continue with WhatsApp</h2>
              <WhatsAppOtpLogin callbackUrl={callbackUrl} />
            </div>
          )}

          <div className="mt-auto">
            <p className="text-center text-[13px] text-white/40">
              <Link href="/privacy" className="transition-colors hover:text-white/70">
                Privacy policy
              </Link>
              <span className="mx-3 text-white/20">·</span>
              <Link href="/terms" className="transition-colors hover:text-white/70">
                Terms of service
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}