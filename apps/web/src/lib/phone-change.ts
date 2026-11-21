import "server-only";
import { prisma } from "@/lib/db";
import { CreditPaymentError, checkTpinIfSet } from "@/lib/credit-payment";
import { verifyOtp } from "@/lib/otp";

/**
 * Changes the account's number, which also moves its WhatsApp login and T-PIN
 * reset to that number. So it takes two proofs: the OTP shows the caller owns
 * the new number, and the current T-PIN shows they own the account. The OTP
 * alone would let a stolen session swap in its own number and reset the T-PIN.
 */
export async function changeVerifiedPhone(userId: string, phoneE164: string, code: string, tpin: string | undefined) {
  await checkTpinIfSet(userId, tpin);

  const otp = await verifyOtp(phoneE164, code);
  if (!otp.ok) throw new CreditPaymentError(403, otp.code, otp.message);

  const whatsappId = phoneE164.replace(/^\+/, "");
  await prisma.$transaction(async (tx) => {
    // Checked only after the OTP, so this can't be used to probe which numbers have accounts.
    const taken = await tx.metaAccountLink.findFirst({
      where: { whatsappId, NOT: { userId } },
      select: { id: true },
    });
    if (taken) throw new CreditPaymentError(409, "PHONE_IN_USE", "This number is already linked to another account.");

    await tx.user.update({ where: { id: userId }, data: { phone: phoneE164 } });
    await tx.metaAccountLink.upsert({
      where: { userId },
      update: { whatsappId },
      create: { userId, whatsappId },
    });
  });
}
