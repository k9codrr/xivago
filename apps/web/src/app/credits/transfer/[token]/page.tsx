import { redirect } from "next/navigation";

// Sending and receiving credits is paused. To restore: delete this stub and uncomment below.
export default function ConfirmTransferPaused() {
  redirect("/activity");
}

// --- Original implementation, commented out while credit sending/receiving is paused ---

// "use client";

// import { useEffect, useState, use as usePromise } from "react";
// import { useRouter } from "next/navigation";
// import { useSession } from "next-auth/react";
// import { toast } from "sonner";
// import { Loader2, Coins, CheckCircle2 } from "lucide-react";
// import { AddCreditsModal } from "@/components/add-credits-modal";

// interface TransferInfo {
//   requester: { id: string; name: string; avatarUrl: string | null; companyName: string | null };
//   amount: number | null;
// }

// export default function ConfirmTransferPage({ params }: { params: Promise<{ token: string }> }) {
//   const { token } = usePromise(params);
//   const router = useRouter();
//   const { data: session, status } = useSession();
//   const [info, setInfo] = useState<TransferInfo | null>(null);
//   const [error, setError] = useState<string | null>(null);
//   const [amount, setAmount] = useState("");
//   const [confirming, setConfirming] = useState(false);
//   const [done, setDone] = useState(false);
//   const [topUpOpen, setTopUpOpen] = useState(false);

//   useEffect(() => {
//     if (status === "unauthenticated") {
//       router.push(`/login?callbackUrl=/credits/transfer/${token}`);
//       return;
//     }
//     if (status !== "authenticated") return;
//     (async () => {
//       const res = await fetch(`/api/credits/transfer/${token}`);
//       const data = await res.json();
//       if (!res.ok) {
//         setError(data?.error?.message ?? "This QR code isn't valid.");
//         return;
//       }
//       setInfo(data);
//     })();
//   }, [token, status, router]);

//   async function handleConfirm() {
//     if (confirming) return;
//     const amt = info?.amount ?? (amount.trim() ? parseInt(amount, 10) : undefined);
//     if (!amt) {
//       toast.error("Enter how many credits to send.");
//       return;
//     }
//     setConfirming(true);
//     try {
//       const res = await fetch(`/api/credits/transfer/${token}`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({ amount: amt }),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         toast.error(data?.error?.message ?? "Could not complete this transfer.");
//         return;
//       }
//       setDone(true);
//     } finally {
//       setConfirming(false);
//     }
//   }

//   if (status === "loading" || (!info && !error)) {
//     return (
//       <main className="flex min-h-dvh items-center justify-center bg-black">
//         <Loader2 className="h-6 w-6 animate-spin text-neutral-500" />
//       </main>
//     );
//   }

//   if (error) {
//     return (
//       <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-black px-6 text-center">
//         <p className="text-sm text-neutral-400">{error}</p>
//         <button type="button" onClick={() => router.push("/")} className="text-sm font-semibold text-amber-400">
//           Go home
//         </button>
//       </main>
//     );
//   }

//   if (done) {
//     return (
//       <main className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-black px-6 text-center">
//         <CheckCircle2 className="h-12 w-12 text-green-500" />
//         <p className="text-lg font-bold text-white">Credits sent!</p>
//         <button type="button" onClick={() => router.push("/")} className="text-sm font-semibold text-amber-400">
//           Done
//         </button>
//       </main>
//     );
//   }

//   return (
//     <main className="flex min-h-dvh flex-col items-center gap-5 bg-black px-6 pt-16 text-center">
//       {/* eslint-disable-next-line @next/next/no-img-element */}
//       <img
//         src={info!.requester.avatarUrl ?? "/icons/avatar-placeholder.svg"}
//         alt={info!.requester.name}
//         className="h-20 w-20 rounded-full bg-neutral-800 object-cover"
//       />
//       <div>
//         <p className="text-lg font-bold text-white">{info!.requester.companyName ?? info!.requester.name}</p>
//         <p className="text-sm text-neutral-400">is requesting credits</p>
//       </div>

//       {info!.amount ? (
//         <p className="flex items-center gap-1.5 text-2xl font-extrabold text-amber-400">
//           <Coins className="h-6 w-6" /> {info!.amount} credits
//         </p>
//       ) : (
//         <input
//           value={amount}
//           onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
//           placeholder="How many credits?"
//           className="w-full rounded-xl bg-neutral-900 px-3.5 py-2.5 text-center text-sm text-white placeholder:text-neutral-500 outline-none"
//         />
//       )}

//       <button
//         type="button"
//         onClick={handleConfirm}
//         disabled={confirming}
//         className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-400 py-3.5 text-sm font-bold text-black disabled:opacity-50"
//       >
//         {confirming ? <Loader2 className="h-5 w-5 animate-spin" /> : `Send${info!.amount ? ` ${info!.amount} credits` : ""}`}
//       </button>

//       <button type="button" onClick={() => setTopUpOpen(true)} className="text-xs text-neutral-500 underline">
//         Not enough credits? Add via UPI / Card
//       </button>

//       {session?.user && <AddCreditsModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />}
//     </main>
//   );
// }
