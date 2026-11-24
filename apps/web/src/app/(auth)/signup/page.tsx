"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { signupSchema, type SignupInput } from "@/lib/validation/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/ui/field-error";
import { ConsentCheckbox } from "@/components/consent-checkbox";
import { savePendingConsent, useConsentCheckbox } from "@/lib/consent-client";

export default function SignupPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const consent = useConsentCheckbox();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { role: "VENDOR" },
  });

  // Invite links look like /signup?ref=CODE
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setValue("referralCode", ref.toUpperCase());
  }, [setValue]);

  async function onSubmit(values: SignupInput) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, consentEvents: consent.events }),
      });
      const data = await res.json();

      if (!res.ok) {
        const message =
          data?.error?.code === "EMAIL_TAKEN"
            ? "An account with this email already exists. Try logging in instead."
            : data?.error?.message ?? "Could not create account.";
        if (data?.error?.code === "INVALID_REFERRAL_CODE") setError("referralCode", { message });
        toast.error(message);
        return;
      }

      const signInResult = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (signInResult?.error) {
        toast.success("Account created — please log in.");
        router.push("/login");
        return;
      }

      toast.success(`Welcome to xivago! You've got welcome credits waiting.`);
      router.push("/onboarding");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col px-6 pb-10 pt-[max(env(safe-area-inset-top),2.5rem)]">
      <div className="mx-auto w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-bold text-neutral-900">Create your account</h1>
        <p className="mb-6 text-sm text-neutral-500">
          Takes less than a minute. Next, a few quick questions to set up your profile.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" autoComplete="name" aria-invalid={Boolean(errors.name)} {...register("name")} />
            <FieldError message={errors.name?.message} />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              {...register("email")}
            />
            <FieldError message={errors.email?.message} />
          </div>

          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.password)}
              {...register("password")}
            />
            <FieldError message={errors.password?.message} />
          </div>

          <div>
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={Boolean(errors.confirmPassword)}
              {...register("confirmPassword")}
            />
            <FieldError message={errors.confirmPassword?.message} />
          </div>

          <div>
            <Label htmlFor="referralCode">Referral code (optional)</Label>
            <Input
              id="referralCode"
              autoComplete="off"
              autoCapitalize="characters"
              placeholder="e.g. KANI7QX2"
              aria-invalid={Boolean(errors.referralCode)}
              {...register("referralCode")}
            />
            <FieldError message={errors.referralCode?.message} />
          </div>

          <div>
            <ConsentCheckbox
              consent={consent}
              onChange={({ terms, age }) => {
                setValue("acceptedTerms", (terms || undefined) as true, { shouldValidate: true });
                setValue("ageConfirmed", (age || undefined) as true, { shouldValidate: true });
              }}
              className="text-neutral-600"
              linkClassName="text-brand-600"
            />
            <FieldError message={errors.ageConfirmed?.message ?? errors.acceptedTerms?.message} />
          </div>

          <Button type="submit" className="w-full" disabled={submitting || !consent.checked}>
            {submitting ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-neutral-400">
          <div className="h-px flex-1 bg-neutral-200" />
          OR
          <div className="h-px flex-1 bg-neutral-200" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={!consent.checked}
          onClick={() => {
            savePendingConsent(consent.events);
            signIn("facebook", { callbackUrl: "/onboarding" });
          }}
        >
          Continue with Facebook
        </Button>

        <p className="mt-6 text-center text-sm text-neutral-500">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-brand-600">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
