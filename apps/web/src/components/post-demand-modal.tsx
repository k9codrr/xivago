// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import { toast } from "sonner";
// import { X, Zap, MessageCircle, Loader2, ChevronRight, Check } from "lucide-react";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { cn } from "@/lib/utils";
// import { countWords } from "@/lib/words";
// import { MAX_SUMMARY_WORDS, MAX_TIMELINE_DAYS, TIMELINE_CHIPS } from "@/lib/validation/demand";
// import { formatBudgetRange } from "@/lib/money";
// import { publicEnv } from "@/lib/env";
// import { CATEGORIES_DATA, ParentCategorySpec, SubCategorySpec } from "@/lib/categories";
// import { MediaUploadField } from "@/components/media-upload-field";

// type Step = "category" | "inputs" | "summary" | "budget" | "timeline" | "options" | "review";
// const STEPS: Step[] = ["category", "inputs", "summary", "budget", "timeline", "options", "review"];

// const STEP_TITLES: Record<Step, string> = {
//   category: "Select Category",
//   inputs: "Category Inputs & Tech",
//   summary: "Describe Your Demand",
//   budget: "Set a Budget",
//   timeline: "Set a Deadline",
//   options: "Boost & Options",
//   review: "Review & Post",
// };

// function addHours(hours: number): Date {
//   return new Date(Date.now() + hours * 60 * 60 * 1000);
// }

// function toLocalDatetimeInputValue(date: Date): string {
//   const pad = (n: number) => String(n).padStart(2, "0");
//   return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
// }

// interface PostDemandModalProps {
//   open: boolean;
//   onClose: () => void;
// }

// export function PostDemandModal({ open, onClose }: PostDemandModalProps) {
//   const router = useRouter();
//   const [step, setStep] = useState<Step>("category");
//   const [submitting, setSubmitting] = useState(false);

//   // Category selection
//   const [selectedParent, setSelectedParent] = useState<ParentCategorySpec | null>(CATEGORIES_DATA[0] ?? null);
//   const [selectedSub, setSelectedSub] = useState<SubCategorySpec | null>(CATEGORIES_DATA[0]?.subCategories[0] ?? null);
//   const [selectedInputs, setSelectedInputs] = useState<Record<string, string[]>>({});

//   // Demand data
//   const [summary, setSummary] = useState("");
//   const [budgetMin, setBudgetMin] = useState("");
//   const [budgetMax, setBudgetMax] = useState("");
//   const [timelineEnd, setTimelineEnd] = useState<Date>(addHours(72));
//   const [isPriority, setIsPriority] = useState(false);
//   const [shareContact, setShareContact] = useState(false);
//   const [mediaUrls, setMediaUrls] = useState<string[]>([]);

//   const [quota, setQuota] = useState<{ used: number; limit: number; remaining: number; unlimited?: boolean } | null>(null);
//   const [creditBalance, setCreditBalance] = useState<number | null>(null);

//   useEffect(() => {
//     if (!open) return;
//     document.body.style.overflow = "hidden";
//     function onKey(e: KeyboardEvent) {
//       if (e.key === "Escape") onClose();
//     }
//     document.addEventListener("keydown", onKey);
//     return () => {
//       document.body.style.overflow = "";
//       document.removeEventListener("keydown", onKey);
//     };
//   }, [open, onClose]);

//   useEffect(() => {
//     if (!open) return;
//     (async () => {
//       const [quotaRes, meRes] = await Promise.all([fetch("/api/my/quota"), fetch("/api/users/me")]);
//       if (quotaRes.ok) setQuota((await quotaRes.json()).quota);
//       if (meRes.ok) setCreditBalance((await meRes.json()).profile.creditBalance);
//     })();
//   }, [open]);

//   if (!open) return null;

//   const wordCount = countWords(summary);
//   const overWordLimit = wordCount > MAX_SUMMARY_WORDS;
//   const boostCost = publicEnv.NEXT_PUBLIC_CREDIT_BOOST_COST;
//   const canAffordBoost = creditBalance == null || creditBalance >= boostCost;
//   const stepIndex = STEPS.indexOf(step);
//   const isLastStep = stepIndex === STEPS.length - 1;
//   const outOfQuota = quota != null && !quota.unlimited && quota.remaining <= 0;

//   function toggleOptionValue(inputLabel: string, option: string) {
//     setSelectedInputs((prev) => {
//       const current = prev[inputLabel] ?? [];
//       const exists = current.includes(option);
//       const updated = exists ? current.filter((o) => o !== option) : [...current, option];
//       return { ...prev, [inputLabel]: updated };
//     });
//   }

//   function goNext() {
//     if (step === "category" && (!selectedParent || !selectedSub)) {
//       toast.error("Please select a parent category and sub-category.");
//       return;
//     }
//     if (step === "summary" && (summary.trim().length === 0 || overWordLimit)) {
//       toast.error(overWordLimit ? `Keep it to ${MAX_SUMMARY_WORDS} words or fewer.` : "Tell vendors what you need first.");
//       return;
//     }
//     if (step === "budget" && budgetMin && budgetMax && Number(budgetMax) < Number(budgetMin)) {
//       toast.error("Maximum budget must be at least the minimum.");
//       return;
//     }
//     if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]!);
//   }

//   function goBack() {
//     if (stepIndex > 0) setStep(STEPS[stepIndex - 1]!);
//   }

//   function handleClose() {
//     if (submitting) return;
//     onClose();
//   }

//   async function submit() {
//     if (outOfQuota) {
//       toast.error("You're out of free demands this month.");
//       return;
//     }
//     setSubmitting(true);
//     try {
//       const res = await fetch("/api/demands", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           summary: summary.trim(),
//           budgetMin: budgetMin ? Number(budgetMin) : undefined,
//           budgetMax: budgetMax ? Number(budgetMax) : undefined,
//           timelineEnd: timelineEnd.toISOString(),
//           isPriority,
//           shareContact,
//           categoryParentId: selectedParent?.id,
//           categorySubId: selectedSub?.id,
//           categoryName: selectedParent?.name,
//           subCategoryName: selectedSub?.name,
//           selectedTechInputs: selectedInputs,
//           mediaUrls,
//         }),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         toast.error(data?.error?.message ?? "Could not post your demand.");
//         return;
//       }
//       toast.success(data.quota.unlimited ? "Posted!" : `Posted! ${data.quota.remaining} of ${data.quota.limit} free demands left this month.`);
//       onClose();
//       router.push(`/demands/${data.demand.id}`);
//     } finally {
//       setSubmitting(false);
//     }
//   }

//   return (
//     <div
//       className="fixed inset-y-5 !mb-20 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
//       onClick={handleClose}
//     >
//       <div
//         role="dialog"
//         aria-modal="true"
//         className="flex max-h-[95dvh] min-h-[90dvh] w-full flex-col overflow-y-scroll rounded-t-3xl bg-white shadow-2xl dark:bg-neutral-900 sm:max-w-lg sm:rounded-3xl"
//         onClick={(e) => e.stopPropagation()}
//       >
//         {/* Header */}
//         <div className="relative border-b border-neutral-100 px-4 pb-3 pt-3 dark:border-neutral-800">
//           <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-neutral-200 dark:bg-neutral-700 sm:hidden" />
//           <div className="flex items-center justify-between">
//             <div className="flex items-center gap-1.5">
//               {stepIndex > 0 && (
//                 <button
//                   onClick={goBack}
//                   aria-label="Back"
//                   className="rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
//                 >
//                   <X className="h-4 w-4 rotate-45" />
//                 </button>
//               )}
//               <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
//                 {STEP_TITLES[step]}
//               </h2>
//             </div>
//             <div className="flex items-center gap-3">
//               {quota && (
//                 <span className="text-xs font-medium text-neutral-400">
//                   {quota.unlimited ? "PRO" : `${quota.remaining}/${quota.limit} left`}
//                 </span>
//               )}
//               <button
//                 onClick={handleClose}
//                 aria-label="Close"
//                 className="rounded-full bg-neutral-100 p-2 text-neutral-500 transition-colors hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
//               >
//                 <X className="h-4 w-4" />
//               </button>
//             </div>
//           </div>
//         </div>

//         {/* Progress */}
//         <div className="flex gap-1.5 px-4 pt-3">
//           {STEPS.map((s, i) => (
//             <div
//               key={s}
//               className={cn(
//                 "h-1 flex-1 rounded-full transition-colors",
//                 i <= stepIndex ? "bg-brand-500" : "bg-neutral-200 dark:bg-neutral-700",
//               )}
//             />
//           ))}
//         </div>

//         {/* Scrollable content */}
//         <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
//           {/* STEP 1: CATEGORY SELECTION */}
//           {step === "category" && (
//             <div className="space-y-4">
//               <div>
//                 <Label className="mb-2 block text-xs font-semibold uppercase text-neutral-400">
//                   1. Parent Category
//                 </Label>
//                 <div className="grid grid-cols-1 gap-2">
//                   {CATEGORIES_DATA.map((cat) => {
//                     const active = selectedParent?.id === cat.id;
//                     return (
//                       <button
//                         key={cat.id}
//                         type="button"
//                         onClick={() => {
//                           setSelectedParent(cat);
//                           setSelectedSub(cat.subCategories[0] ?? null);
//                         }}
//                         className={cn(
//                           "flex items-center justify-between rounded-xl border p-3 text-left transition-all",
//                           active
//                             ? "border-brand-500 bg-brand-500/10 font-semibold text-neutral-900 dark:text-white"
//                             : "border-neutral-200 text-neutral-700 hover:border-neutral-300 dark:border-neutral-800 dark:text-neutral-300"
//                         )}
//                       >
//                         <span className="text-sm">{cat.id}. {cat.name}</span>
//                         {active && <Check className="h-4 w-4 text-brand-500" />}
//                       </button>
//                     );
//                   })}
//                 </div>
//               </div>

//               {selectedParent && (
//                 <div>
//                   <Label className="mb-2 block text-xs font-semibold uppercase text-neutral-400">
//                     2. Sub-Category
//                   </Label>
//                   <div className="space-y-2">
//                     {selectedParent.subCategories.map((sub) => {
//                       const active = selectedSub?.id === sub.id;
//                       return (
//                         <button
//                           key={sub.id}
//                           type="button"
//                           onClick={() => setSelectedSub(sub)}
//                           className={cn(
//                             "flex w-full flex-col rounded-xl border p-3 text-left transition-all",
//                             active
//                               ? "border-brand-500 bg-brand-500/5 ring-1 ring-brand-500"
//                               : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-800"
//                           )}
//                         >
//                           <div className="flex items-center justify-between">
//                             <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
//                               {sub.id} {sub.name}
//                             </span>
//                             {active && <Check className="h-4 w-4 text-brand-500" />}
//                           </div>
//                           <p className="mt-1 text-xs text-neutral-500">{sub.subtitle}</p>

//                           {/* Reference Rates */}
//                           <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
//                             <span className="rounded bg-neutral-100 px-2 py-0.5 font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
//                               Hourly: {sub.rates.hourlyUSD} / {sub.rates.hourlyINR}
//                             </span>
//                             <span className="rounded bg-neutral-100 px-2 py-0.5 font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
//                               Fixed: {sub.rates.fixedUSD} / {sub.rates.fixedINR}
//                             </span>
//                           </div>
//                         </button>
//                       );
//                     })}
//                   </div>
//                 </div>
//               )}
//             </div>
//           )}

//           {/* STEP 2: CATEGORY INPUTS & TECH SELECTORS */}
//           {step === "inputs" && selectedSub && (
//             <div className="space-y-5">
//               <div className="rounded-2xl bg-neutral-50 p-3.5 dark:bg-neutral-800/50">
//                 <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
//                   {selectedParent?.name} › {selectedSub.name}
//                 </span>
//                 <p className="mt-1 text-xs text-neutral-500">{selectedSub.subtitle}</p>

//                 <div className="mt-3 flex flex-wrap gap-1">
//                   {selectedSub.topSkills.map((skill) => (
//                     <span key={skill} className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-neutral-700 shadow-sm dark:bg-neutral-800 dark:text-neutral-200">
//                       ★ {skill}
//                     </span>
//                   ))}
//                 </div>
//               </div>

//               {selectedSub.requiredInputs.map((reqInput) => (
//                 <div key={reqInput.label} className="space-y-2">
//                   <Label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
//                     {reqInput.label}
//                   </Label>
//                   <div className="flex flex-wrap gap-1.5">
//                     {reqInput.options.map((opt) => {
//                       const selected = (selectedInputs[reqInput.label] ?? []).includes(opt);
//                       return (
//                         <button
//                           key={opt}
//                           type="button"
//                           onClick={() => toggleOptionValue(reqInput.label, opt)}
//                           className={cn(
//                             "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
//                             selected
//                               ? "border-brand-500 bg-brand-500 text-white"
//                               : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
//                           )}
//                         >
//                           {selected && "✓ "}
//                           {opt}
//                         </button>
//                       );
//                     })}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}

//           {/* STEP 3: SUMMARY & MEDIA UPLOAD */}
//           {step === "summary" && (
//             <div className="space-y-4">
//               <div>
//                 <textarea
//                   id="summary"
//                   rows={4}
//                   autoFocus
//                   value={summary}
//                   onChange={(e) => setSummary(e.target.value)}
//                   placeholder={`Describe your requirements for ${selectedSub?.name ?? "this demand"}...`}
//                   className={cn(
//                     "w-full resize-none rounded-2xl border bg-transparent px-4 py-3 text-sm leading-6 text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:text-neutral-100",
//                     overWordLimit ? "border-red-400" : "border-neutral-200 dark:border-neutral-700"
//                   )}
//                 />
//                 <p className={cn("mt-1 text-right text-xs", overWordLimit ? "font-semibold text-red-600" : "text-neutral-400")}>
//                   {wordCount}/{MAX_SUMMARY_WORDS} words
//                 </p>
//               </div>

//               {/* Photos & Videos Posting Feature via Cloudflare R2 */}
//               <div className="space-y-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
//                 <Label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
//                   Photos, Images & Videos Attachment (Cloudflare R2)
//                 </Label>
//                 <MediaUploadField value={mediaUrls} onChange={setMediaUrls} maxFiles={5} />
//               </div>
//             </div>
//           )}

//           {/* STEP 4: BUDGET */}
//           {step === "budget" && (
//             <div className="space-y-4">
//               {selectedSub && (
//                 <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-300">
//                   Standard market rates for <b>{selectedSub.name}</b>:
//                   <br />
//                   Hourly: {selectedSub.rates.hourlyUSD} ({selectedSub.rates.hourlyINR})
//                   <br />
//                   Fixed: {selectedSub.rates.fixedUSD} ({selectedSub.rates.fixedINR})
//                 </div>
//               )}
//               <div className="flex gap-3">
//                 <div className="flex-1">
//                   <Label htmlFor="budgetMin">Min budget (₹)</Label>
//                   <Input id="budgetMin" type="number" inputMode="numeric" min={0} value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder="15000" />
//                 </div>
//                 <div className="flex-1">
//                   <Label htmlFor="budgetMax">Max budget (₹)</Label>
//                   <Input id="budgetMax" type="number" inputMode="numeric" min={0} value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="25000" />
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* STEP 5: TIMELINE */}
//           {step === "timeline" && (
//             <div className="space-y-4">
//               <p className="text-sm text-neutral-500 dark:text-neutral-400">
//                 How soon do you need this fulfilled?
//               </p>
//               <div className="flex gap-2">
//                 {TIMELINE_CHIPS.map((chip) => {
//                   const chipDate = addHours(chip.hours);
//                   const active = Math.abs(chipDate.getTime() - timelineEnd.getTime()) < 60_000;
//                   return (
//                     <button
//                       key={chip.label}
//                       type="button"
//                       onClick={() => setTimelineEnd(chipDate)}
//                       className={cn(
//                         "flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors",
//                         active
//                           ? "border-brand-500 bg-brand-500 text-white"
//                           : "border-neutral-200 text-neutral-600 hover:border-neutral-300 dark:border-neutral-700 dark:text-neutral-300",
//                       )}
//                     >
//                       {chip.label}
//                     </button>
//                   );
//                 })}
//               </div>
//               <div>
//                 <Label htmlFor="timelineCustom">Custom date/time</Label>
//                 <Input
//                   id="timelineCustom"
//                   type="datetime-local"
//                   value={toLocalDatetimeInputValue(timelineEnd)}
//                   min={toLocalDatetimeInputValue(addHours(0))}
//                   max={toLocalDatetimeInputValue(addHours(MAX_TIMELINE_DAYS * 24))}
//                   onChange={(e) => {
//                     const next = new Date(e.target.value);
//                     if (!Number.isNaN(next.getTime())) setTimelineEnd(next);
//                   }}
//                 />
//               </div>
//             </div>
//           )}

//           {/* STEP 6: OPTIONS */}
//           {step === "options" && (
//             <div className="space-y-3">
//               <button
//                 type="button"
//                 onClick={() => canAffordBoost && setIsPriority((v) => !v)}
//                 disabled={!canAffordBoost}
//                 className={cn(
//                   "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors disabled:opacity-50",
//                   isPriority
//                     ? "border-brand-500 bg-brand-500/5"
//                     : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-700",
//                 )}
//               >
//                 <span
//                   className={cn(
//                     "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
//                     isPriority ? "bg-brand-500 text-white" : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800",
//                   )}
//                 >
//                   <Zap className="h-4 w-4" />
//                 </span>
//                 <span>
//                   <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">
//                     Featured
//                   </span>
//                   <span className="mt-0.5 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
//                     Pin your demand to the top with a badge. Costs {boostCost} credits.
//                     {!canAffordBoost && " You don't have enough credits."}
//                   </span>
//                 </span>
//               </button>

//               <button
//                 type="button"
//                 onClick={() => setShareContact((v) => !v)}
//                 className={cn(
//                   "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
//                   shareContact
//                     ? "border-brand-500 bg-brand-500/5"
//                     : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-700",
//                 )}
//               >
//                 <span
//                   className={cn(
//                     "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
//                     shareContact ? "bg-brand-500 text-white" : "bg-neutral-100 text-neutral-400 dark:bg-neutral-800",
//                   )}
//                 >
//                   <MessageCircle className="h-4 w-4" />
//                 </span>
//                 <span>
//                   <span className="block text-sm font-semibold text-neutral-900 dark:text-neutral-100">
//                     Allow bidders to reach me on WhatsApp
//                   </span>
//                   <span className="mt-0.5 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
//                     Off by default. In-app chat always works either way.
//                   </span>
//                 </span>
//               </button>
//             </div>
//           )}

//           {/* STEP 7: REVIEW */}
//           {step === "review" && (
//             <div className="space-y-3">
//               <div className="rounded-2xl border border-neutral-200 p-4 dark:border-neutral-700 space-y-2">
//                 <div className="flex items-center justify-between">
//                   <span className="rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-bold text-brand-600 dark:text-brand-400">
//                     {selectedParent?.name} › {selectedSub?.name}
//                   </span>
//                 </div>

//                 <p className="text-sm font-medium leading-6 text-neutral-900 dark:text-neutral-100">{summary}</p>

//                 {mediaUrls.length > 0 && (
//                   <p className="text-xs font-semibold text-neutral-500">
//                     📎 {mediaUrls.length} media attachment(s) uploaded
//                   </p>
//                 )}

//                 <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400">
//                   {formatBudgetRange(budgetMin ? Number(budgetMin) : null, budgetMax ? Number(budgetMax) : null) && (
//                     <span className="font-semibold text-neutral-700 dark:text-neutral-200">
//                       {formatBudgetRange(budgetMin ? Number(budgetMin) : null, budgetMax ? Number(budgetMax) : null)}
//                     </span>
//                   )}
//                   <span>Expires {timelineEnd.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
//                 </div>
//               </div>
//               {outOfQuota && (
//                 <p className="text-center text-sm font-medium text-red-600">
//                   You&apos;re out of free demands this month.
//                 </p>
//               )}
//             </div>
//           )}
//         </div>

//         {/* Footer controls */}
//         <div className="border-t border-neutral-100 px-4 py-3 dark:border-neutral-800">
//           <button
//             type="button"
//             onClick={isLastStep ? submit : goNext}
//             disabled={submitting || (isLastStep && outOfQuota)}
//             className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-600 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
//           >
//             {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
//             {isLastStep ? (submitting ? "Posting…" : "Post demand") : "Continue"}
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }



// "use client";

// import { useEffect, useState } from "react";
// import { useRouter } from "next/navigation";
// import { toast } from "sonner";
// import { X, Zap, MessageCircle, Loader2, Check, Coins, Plus, Minus, Users } from "lucide-react";
// import { Input } from "@/components/ui/input";
// import { Label } from "@/components/ui/label";
// import { cn } from "@/lib/utils";
// import { countWords } from "@/lib/words";
// import { MAX_SUMMARY_WORDS, MAX_TIMELINE_DAYS, TIMELINE_CHIPS } from "@/lib/validation/demand";
// import { formatBudgetRange } from "@/lib/money";
// import { publicEnv } from "@/lib/env";
// import { CATEGORIES_DATA, ParentCategorySpec, SubCategorySpec } from "@/lib/categories";
// import { MediaUploadField } from "@/components/media-upload-field";
// import { useGeolocation } from "@/lib/use-geolocation";
// import { AddCreditsModal } from "@/components/add-credits-modal";
// import { DEMAND_POST_CREDIT_COST, MIN_BID_SLOTS, MAX_BID_SLOTS, calculateSlotPrice } from "@/lib/slot-pricing";
// import { AnimateIcon } from "./animate-ui/icons/icon";
// import {
//   TrophyIcon,
//   RulerIcon,
//   CpuIcon,
//   PaletteIcon,
//   TrendingUpIcon,
//   WorkflowIcon,
//   ClapperboardIcon,
//   LanguagesIcon,
//   StoreIcon,
//   Building2Icon,
//   SparklesIcon,
//   SlidersHorizontalIcon,
// } from "@animateicons/react/lucide";
// import { Layers01Icon, HeartCheckIcon, Analytics01Icon } from "@animateicons/react/huge";
// import {
//   FamilyDrawerAnimatedContent,
//   FamilyDrawerAnimatedWrapper,
//   FamilyDrawerButton,
//   FamilyDrawerClose,
//   FamilyDrawerContent,
//   FamilyDrawerDescription,
//   FamilyDrawerHeader,
//   FamilyDrawerOverlay,
//   FamilyDrawerPortal,
//   FamilyDrawerRoot,
//   FamilyDrawerSecondaryButton,
//   FamilyDrawerTitle,
//   FamilyDrawerTrigger,
//   FamilyDrawerViewContent,
//   useFamilyDrawer,
//   type ViewsRegistry,
// } from "@/components/ui/family-drawer"

// type Step = "category" | "inputs" | "summary" | "budget" | "timeline" | "options" | "review";
// const STEPS: Step[] = ["category", "inputs", "summary", "budget", "timeline", "options", "review"];

// const STEP_TITLES: Record<Step, string> = {
//   category: "What service you want?",
//   inputs: "Category Inputs & Tech",
//   summary: "Describe Your Demand",
//   budget: "Set a Budget",
//   timeline: "Set a Deadline",
//   options: "Boost & Options",
//   review: "Review & Post",
// };

// type IconType = React.ComponentType<{
//   size?: number;
//   className?: string;
//   fill?: string;
//   strokeWidth?: number;
// }>;

// /**
//  * Icon + color per parent category.
//  * Keys must match the `id` in CATEGORIES_DATA — adjust these to your real ids.
//  */
// const CATEGORY_META: Record<string, { icon: IconType; color: string }> = {
//   "1": { icon: RulerIcon, color: "text-sky-400" },              // Legal & Compliance
//   "2": { icon: CpuIcon, color: "text-violet-400" },             // Tech & AI Infrastructure
//   "3": { icon: PaletteIcon, color: "text-fuchsia-400" },        // Brand & Design
//   "4": { icon: TrendingUpIcon, color: "text-emerald-400" },     // Growth & Revenue
//   "5": { icon: WorkflowIcon, color: "text-orange-400" },        // Operations & Scale
//   "6": { icon: ClapperboardIcon, color: "text-rose-400" },      // Creator & Executive Monetization
//   "7": { icon: LanguagesIcon, color: "text-teal-300" },         // Localization & Global Expansion
//   "8": { icon: HeartCheckIcon, color: "text-red-400" },     // Customer Experience & Retention Ops
//   "9": { icon: StoreIcon, color: "text-amber-400" },            // E-Commerce & Digital Storefronts
//   "10": { icon: Analytics01Icon, color: "text-cyan-400" },        // Data Business Intelligence & Analytics
//   "11": { icon: Building2Icon, color: "text-blue-300" },        // Real Estate & Physical Assets
//   "12": { icon: SparklesIcon, color: "text-yellow-300" },       // Strategic Advisory Numerology & Brand Timing
// };
// const FALLBACK_META = { icon: Layers01Icon as IconType, color: "text-brand-400" };

// function metaFor(cat: ParentCategorySpec) {
//   return CATEGORY_META[cat.id] ?? FALLBACK_META;
// }

// function addHours(hours: number): Date {
//   return new Date(Date.now() + hours * 60 * 60 * 1000);
// }

// function toLocalDatetimeInputValue(date: Date): string {
//   const pad = (n: number) => String(n).padStart(2, "0");
//   return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
// }

// interface PostDemandModalProps {
//   open: boolean;
//   onClose: () => void;
// }

// export function PostDemandModal({ open, onClose }: PostDemandModalProps) {
//     // const { setView } = useFamilyDrawer();
//   const router = useRouter();
//   const [step, setStep] = useState<Step>("category");
//   const [submitting, setSubmitting] = useState(false);

//   const [selectedParent, setSelectedParent] = useState<ParentCategorySpec | null>(CATEGORIES_DATA[0] ?? null);
//   const [selectedSub, setSelectedSub] = useState<SubCategorySpec | null>(CATEGORIES_DATA[0]?.subCategories[0] ?? null);
//   const [selectedInputs, setSelectedInputs] = useState<Record<string, string[]>>({});

//   const [summary, setSummary] = useState("");
//   const [budgetMin, setBudgetMin] = useState("");
//   const [budgetMax, setBudgetMax] = useState("");
//   const [timelineEnd, setTimelineEnd] = useState<Date>(addHours(72));
//   const [isPriority, setIsPriority] = useState(false);
//   const [shareContact, setShareContact] = useState(false);
//   const [mediaUrls, setMediaUrls] = useState<string[]>([]);
//   const [maxSlots, setMaxSlots] = useState<number>(MIN_BID_SLOTS);
//   const [showTopUpModal, setShowTopUpModal] = useState<boolean>(false);

//   const [creditBalance, setCreditBalance] = useState<number | null>(null);
//   const { lat: userLat, lng: userLng, requestLocation } = useGeolocation();

//   useEffect(() => {
//     if (!open) return;
//     if (userLat == null && userLng == null) {
//       void requestLocation();
//     }
//   }, [open, userLat, userLng, requestLocation]);

//   useEffect(() => {
//     if (!open) return;
//     document.body.style.overflow = "hidden";
//     function onKey(e: KeyboardEvent) {
//       if (e.key === "Escape") onClose();
//     }
//     document.addEventListener("keydown", onKey);
//     return () => {
//       document.body.style.overflow = "";
//       document.removeEventListener("keydown", onKey);
//     };
//   }, [open, onClose]);

//   useEffect(() => {
//     if (!open) return;
//     (async () => {
//       const meRes = await fetch("/api/users/me");
//       if (meRes.ok) setCreditBalance((await meRes.json()).profile.creditBalance);
//     })();
//   }, [open]);

//   const wordCount = countWords(summary);
//   const overWordLimit = wordCount > MAX_SUMMARY_WORDS;
//   const boostCost = publicEnv.NEXT_PUBLIC_CREDIT_BOOST_COST;
//   const totalCreditCost = DEMAND_POST_CREDIT_COST + (isPriority ? boostCost : 0);
//   const canAffordBoost = creditBalance == null || creditBalance >= boostCost;
//   const canAffordPost = creditBalance == null || creditBalance >= totalCreditCost;
//   const stepIndex = STEPS.indexOf(step);
//   const isLastStep = stepIndex === STEPS.length - 1;

//   function toggleOptionValue(inputLabel: string, option: string) {
//     setSelectedInputs((prev) => {
//       const current = prev[inputLabel] ?? [];
//       const exists = current.includes(option);
//       const updated = exists ? current.filter((o) => o !== option) : [...current, option];
//       return { ...prev, [inputLabel]: updated };
//     });
//   }

//   function startCustom() {
//     setSelectedParent(null);
//     setSelectedSub(null);
//     setStep("summary");
//   }

//   function goNext() {
//     if (step === "category" && (!selectedParent || !selectedSub)) {
//       toast.error("Please select a challenge category.");
//       return;
//     }
//     if (step === "summary" && (summary.trim().length === 0 || overWordLimit)) {
//       toast.error(overWordLimit ? `Keep it to ${MAX_SUMMARY_WORDS} words or fewer.` : "Tell vendors what you need first.");
//       return;
//     }
//     if (step === "budget" && budgetMin && budgetMax && Number(budgetMax) < Number(budgetMin)) {
//       toast.error("Maximum budget must be at least the minimum.");
//       return;
//     }
//     if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1]!);
//   }

//   function goBack() {
//     const prev = STEPS[stepIndex - 1];
//     if (!prev) return;
//     // Custom challenges skip the "inputs" step — never land on an empty step
//     if (prev === "inputs" && !selectedSub) {
//       setStep("category");
//       return;
//     }
//     setStep(prev);
//   }

//   function handleClose() {
//     if (submitting) return;
//     onClose();
//   }

//   async function submit() {
//     if (creditBalance != null && creditBalance < totalCreditCost) {
//       toast.error(`Posting requires ${totalCreditCost} credits. You have ${creditBalance} credits.`);
//       setShowTopUpModal(true);
//       return;
//     }
//     setSubmitting(true);
//     try {
//       const res = await fetch("/api/demands", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           summary: summary.trim(),
//           budgetMin: budgetMin ? Number(budgetMin) : undefined,
//           budgetMax: budgetMax ? Number(budgetMax) : undefined,
//           timelineEnd: timelineEnd.toISOString(),
//           isPriority,
//           shareContact,
//           maxSlots,
//           categoryParentId: selectedParent?.id,
//           categorySubId: selectedSub?.id,
//           categoryName: selectedParent?.name,
//           subCategoryName: selectedSub?.name,
//           selectedTechInputs: selectedInputs,
//           mediaUrls,
//           lat: userLat ?? undefined,
//           lng: userLng ?? undefined,
//         }),
//       });
//       const data = await res.json();
//       if (!res.ok) {
//         if (data?.error?.code === "INSUFFICIENT_CREDITS") {
//           toast.error(data?.error?.message ?? "Insufficient credits to post.");
//           setShowTopUpModal(true);
//           return;
//         }
//         toast.error(data?.error?.message ?? "Could not post your demand.");
//         return;
//       }
//       toast.success("Demand posted successfully!");
//       if (data.creditBalance != null) setCreditBalance(data.creditBalance);
//       onClose();
//       router.push(`/demands/${data.demand.id}`);
//     } finally {
//       setSubmitting(false);
//     }
//   }

//   return (
//     <>
//       <FamilyDrawerRoot
//       open={open}
//       onOpenChange={(o) => {
//         if (!o) onClose(); // user dragged down / pressed escape → close
//       }}
//     >
//       {/* ❌ FamilyDrawerTrigger deleted — no more "Open Drawer" button */}

//       <FamilyDrawerPortal>
//         <FamilyDrawerOverlay className="z-[55]" />
//         <FamilyDrawerContent className="flex z-[60] max-h-[94dvh] min-h-[88dvh] w-full flex-col overflow-hidden mb-5 border-x-0 rounded-t-[2rem] border-t border-white/10 bg-[#080808] shadow-[0_-20px_80px_rgba(0,0,0,.8)] sm:mb-4 sm:max-w-md sm:rounded-[2rem] sm:border">

//           {/* Header */}
//           <div className="relative px-5 pb-4 pt-3">
//             <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-neutral-700/70" />
//             <div className="flex items-center justify-between">
//               <div className="grid place-items-center rounded-full border border-white/10 bg-neutral-900">
//                 <AnimateIcon animateOnHover>
//                   <TrophyIcon size={20} className="text-neutral-200 p-1.5" />
//                 </AnimateIcon>
//               </div>
//               <h2 className="text-base font-medium text-neutral-400">{STEP_TITLES[step]}</h2>
//               <div className="flex items-center gap-2">
//                 {creditBalance != null && (
//                   <span className="flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-400">
//                     <Coins className="h-3 w-3" /> {creditBalance} Credits
//                   </span>
//                 )}
//                 {/* Working close button */}
//                 <FamilyDrawerClose className="static h-9 w-9 border border-white/10 bg-neutral-900 [&>svg]:hidden">
//                   <X className="h-4 w-4 text-neutral-400" />
//                 </FamilyDrawerClose>
//               </div>
//             </div>
//           </div>

//         {/* Progress */}
//         <div className="flex gap-1.5 px-5 pb-2">
//           {STEPS.map((s, i) => (
//             <div
//               key={s}
//               className={cn(
//                 "h-1 flex-1 rounded-full transition-colors",
//                 i <= stepIndex ? "bg-white" : "bg-white/10"
//               )}
//             />
//           ))}
//         </div>

//         {/* Content */}
//         <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
//           {/* STEP 1 — the image design */}
//           {step === "category" && (
//             <div className="space-y-6">
//               <h1 className="text-center text-[26px] font-semibold tracking-tight text-white">
//                 Which category fits best?
//               </h1>

//               <div className="grid grid-cols-2 gap-3">
//                 {CATEGORIES_DATA.map((cat) => {
//                   const active = selectedParent?.id === cat.id;
//                   const meta = metaFor(cat);
//                   const Icon = meta.icon;
//                   return (
//                     <button
//                       key={cat.id}
//                       type="button"
//                       onClick={() => {
//                         setSelectedParent(cat);
//                         setSelectedSub(cat.subCategories[0] ?? null);
//                       }}
//                       className={cn(
//                         "flex flex-col items-center justify-center gap-2.5 rounded-3xl border-l border-bs py-3.5 transition-all active:scale-[0.97]",
//                         active
//                           ? "border-[#222222] bg-[#242424]"
//                           : "border-white/20 bg-[#111] hover:bg-neutral-800/60"
//                       )}
//                     >
                      
//                         <Icon
//                           size={30}
//                           strokeWidth={1.5}
//                           fill="currentColor"
//                           className={cn(meta.color, active && "scale-110")}
//                         />
                      
//                       <span className="text-sm font-semibold w-32 text-center text-neutral-100">{cat.name}</span>
//                     </button>
//                   );
//                 })}
//               </div>

//               {/* Divider */}
//               <div className="flex items-center gap-3 text-neutral-500">
//                 <div className="h-px flex-1 bg-white/10" />
//                 <span className="text-xs">Can’t find it?</span>
//                 <div className="h-px flex-1 bg-white/10" />
//               </div>

//               {/* Custom card */}
//               <button
//                 type="button"
//                 onClick={startCustom}
//                 className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/5 bg-[#151517] p-4 text-left transition-colors hover:bg-neutral-800/60 active:scale-[0.99]"
//               >
//                 <div className="flex items-center gap-3">
//                   <SlidersHorizontalIcon size={28} className="text-neutral-400" />
//                   <div>
//                     <p className="text-base font-semibold text-neutral-100">Custom</p>
//                     <p className="text-xs text-neutral-500">Describe what you need</p>
//                   </div>
//                 </div>
//                 {/* Optional sticker — drop your "own goals" png at /stickers/own-goals.png, or delete this img */}
//                 <img
//                   src="/stickers/own-goals.png"
//                   alt="Own goals"
//                   className="h-16 w-16 rotate-[-8deg] object-contain"
//                   onError={(e) => (e.currentTarget.style.display = "none")}
//                 />
//               </button>
//             </div>
//           )}

//           {/* STEP 2: SUB-CATEGORY + INPUTS */}
//           {step === "inputs" && selectedSub && selectedParent && (
//             <div className="space-y-5">
//               <div className="rounded-2xl border border-white/5 bg-[#151517] p-4">
//                 <span className="text-xs font-semibold text-neutral-400">
//                   {selectedParent.name} › {selectedSub.name}
//                 </span>
//                 <p className="mt-1 text-xs text-neutral-500">{selectedSub.subtitle}</p>
//                 <div className="mt-3 flex flex-wrap gap-1.5">
//                   {selectedSub.topSkills.map((skill) => (
//                     <span key={skill} className="rounded-full border border-white/10 bg-neutral-900 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-300">
//                       ★ {skill}
//                     </span>
//                   ))}
//                 </div>
//               </div>

//               <div className="grid grid-cols-1 gap-2">
//                 {selectedParent.subCategories.map((sub) => {
//                   const active = selectedSub?.id === sub.id;
//                   return (
//                     <button
//                       key={sub.id}
//                       type="button"
//                       onClick={() => setSelectedSub(sub)}
//                       className={cn(
//                         "flex w-full flex-col rounded-2xl border p-4 text-left transition-all",
//                         active
//                           ? "border-white/25 bg-neutral-800"
//                           : "border-white/5 bg-[#151517] hover:bg-neutral-800/60"
//                       )}
//                     >
//                       <div className="flex items-center justify-between">
//                         <span className="text-sm font-semibold text-neutral-100">{sub.name}</span>
//                         {active && <Check className="h-4 w-4 text-white" />}
//                       </div>
//                       <p className="mt-1 text-xs text-neutral-500">{sub.subtitle}</p>
//                       <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
//                         <span className="rounded-full border border-white/10 bg-neutral-900 px-2 py-0.5 font-medium text-neutral-400">
//                           Hourly: {sub.rates.hourlyUSD} / {sub.rates.hourlyINR}
//                         </span>
//                         <span className="rounded-full border border-white/10 bg-neutral-900 px-2 py-0.5 font-medium text-neutral-400">
//                           Fixed: {sub.rates.fixedUSD} / {sub.rates.fixedINR}
//                         </span>
//                       </div>
//                     </button>
//                   );
//                 })}
//               </div>

//               {selectedSub.requiredInputs.map((reqInput) => (
//                 <div key={reqInput.label} className="space-y-2">
//                   <Label className="text-xs font-semibold text-neutral-300">{reqInput.label}</Label>
//                   <div className="flex flex-wrap gap-1.5">
//                     {reqInput.options.map((opt) => {
//                       const selected = (selectedInputs[reqInput.label] ?? []).includes(opt);
//                       return (
//                         <button
//                           key={opt}
//                           type="button"
//                           onClick={() => toggleOptionValue(reqInput.label, opt)}
//                           className={cn(
//                             "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
//                             selected
//                               ? "border-white bg-white text-black"
//                               : "border-white/10 bg-[#151517] text-neutral-300 hover:bg-neutral-800"
//                           )}
//                         >
//                           {selected && "✓ "}
//                           {opt}
//                         </button>
//                       );
//                     })}
//                   </div>
//                 </div>
//               ))}
//             </div>
//           )}

//           {/* STEP 3: SUMMARY */}
//           {step === "summary" && (
//             <div className="space-y-4">
//               {selectedParent && selectedSub && (
//                 <span className="inline-block rounded-full border border-white/10 bg-neutral-900 px-3 py-1 text-xs font-semibold text-neutral-300">
//                   {selectedParent.name} › {selectedSub.name}
//                 </span>
//               )}
//               <textarea
//                 id="summary"
//                 rows={5}
//                 autoFocus
//                 value={summary}
//                 onChange={(e) => setSummary(e.target.value)}
//                 placeholder="What do you want?"
//                 className={cn(
//                   "w-full resize-none rounded-2xl border bg-[#151517] px-4 py-3 text-sm leading-6 text-neutral-100 placeholder:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
//                   overWordLimit ? "border-red-500/60" : "border-white/10"
//                 )}
//               />
//               <p className={cn("-mt-2 text-right text-xs", overWordLimit ? "font-semibold text-red-400" : "text-neutral-600")}>
//                 {wordCount}/{MAX_SUMMARY_WORDS} words
//               </p>

//               <div className="space-y-2 border-t border-white/5 pt-3">
//                 <Label className="text-xs font-semibold text-neutral-300">Photos & Videos</Label>
//                 <MediaUploadField value={mediaUrls} onChange={setMediaUrls} maxFiles={5} />
//               </div>
//             </div>
//           )}

//           {/* STEP 4: BUDGET */}
//           {step === "budget" && (
//             <div className="space-y-4">
//               {selectedSub && (
//                 <div className="rounded-2xl border border-white/5 bg-[#151517] p-4 text-xs leading-5 text-neutral-400">
//                   Standard market rates for <span className="text-neutral-200">{selectedSub.name}</span>:
//                   <br />Hourly: {selectedSub.rates.hourlyUSD} ({selectedSub.rates.hourlyINR})
//                   <br />Fixed: {selectedSub.rates.fixedUSD} ({selectedSub.rates.fixedINR})
//                 </div>
//               )}
//               <div className="flex gap-3">
//                 <div className="flex-1 space-y-1.5">
//                   <Label htmlFor="budgetMin" className="text-neutral-400">Min budget (₹)</Label>
//                   <Input id="budgetMin" type="number" inputMode="numeric" min={0} value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} placeholder="15000"
//                     className="border-white/10 bg-[#151517] text-neutral-100 placeholder:text-neutral-600" />
//                 </div>
//                 <div className="flex-1 space-y-1.5">
//                   <Label htmlFor="budgetMax" className="text-neutral-400">Max budget (₹)</Label>
//                   <Input id="budgetMax" type="number" inputMode="numeric" min={0} value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} placeholder="25000"
//                     className="border-white/10 bg-[#151517] text-neutral-100 placeholder:text-neutral-600" />
//                 </div>
//               </div>
//             </div>
//           )}

//           {/* STEP 5: TIMELINE */}
//           {step === "timeline" && (
//             <div className="space-y-4">
//               <p className="text-sm text-neutral-400">How soon do you need this fulfilled?</p>
//               <div className="flex gap-2">
//                 {TIMELINE_CHIPS.map((chip) => {
//                   const chipDate = addHours(chip.hours);
//                   const active = Math.abs(chipDate.getTime() - timelineEnd.getTime()) < 60_000;
//                   return (
//                     <button
//                       key={chip.label}
//                       type="button"
//                       onClick={() => setTimelineEnd(chipDate)}
//                       className={cn(
//                         "flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors",
//                         active
//                           ? "border-white bg-white text-black"
//                           : "border-white/10 bg-[#151517] text-neutral-300 hover:bg-neutral-800"
//                       )}
//                     >
//                       {chip.label}
//                     </button>
//                   );
//                 })}
//               </div>
//               <div className="space-y-1.5">
//                 <Label htmlFor="timelineCustom" className="text-neutral-400">Custom date/time</Label>
//                 <Input
//                   id="timelineCustom"
//                   type="datetime-local"
//                   value={toLocalDatetimeInputValue(timelineEnd)}
//                   min={toLocalDatetimeInputValue(addHours(0))}
//                   max={toLocalDatetimeInputValue(addHours(MAX_TIMELINE_DAYS * 24))}
//                   onChange={(e) => {
//                     const next = new Date(e.target.value);
//                     if (!Number.isNaN(next.getTime())) setTimelineEnd(next);
//                   }}
//                   className="border-white/10 bg-[#151517] text-neutral-100 [color-scheme:dark]"
//                 />
//               </div>
//             </div>
//           )}

//           {/* STEP 6: OPTIONS */}
//           {step === "options" && (
//             <div className="space-y-3">
//               {/* Response spots: 3 to 100 */}
//               <div className="rounded-2xl border border-white/5 bg-[#151517] p-4">
//                 <div className="flex items-center justify-between mb-3">
//                   <div className="flex items-center gap-2.5">
//                     <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-400/10 text-amber-400 border border-amber-400/20">
//                       <Users className="h-4 w-4" />
//                     </span>
//                     <div>
//                       <span className="block text-sm font-semibold text-neutral-100">Response spots</span>
//                       <span className="block text-xs text-neutral-400">How many providers can respond (3–100)</span>
//                     </div>
//                   </div>
//                   <div className="flex items-center gap-1.5">
//                     <button
//                       type="button"
//                       onClick={() => setMaxSlots((s) => Math.max(MIN_BID_SLOTS, s - 1))}
//                       disabled={maxSlots <= MIN_BID_SLOTS}
//                       className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-30"
//                     >
//                       <Minus className="h-3.5 w-3.5" />
//                     </button>
//                     <input
//                       type="number"
//                       min={MIN_BID_SLOTS}
//                       max={MAX_BID_SLOTS}
//                       value={maxSlots}
//                       onChange={(e) => {
//                         const val = parseInt(e.target.value, 10);
//                         if (!Number.isNaN(val)) setMaxSlots(Math.min(MAX_BID_SLOTS, Math.max(MIN_BID_SLOTS, val)));
//                       }}
//                       className="w-14 rounded-lg bg-black px-2 py-1 text-center text-sm font-bold text-amber-400 outline-none ring-1 ring-white/10"
//                     />
//                     <button
//                       type="button"
//                       onClick={() => setMaxSlots((s) => Math.min(MAX_BID_SLOTS, s + 1))}
//                       disabled={maxSlots >= MAX_BID_SLOTS}
//                       className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-30"
//                     >
//                       <Plus className="h-3.5 w-3.5" />
//                     </button>
//                   </div>
//                 </div>
//                 <input
//                   type="range"
//                   min={MIN_BID_SLOTS}
//                   max={MAX_BID_SLOTS}
//                   value={maxSlots}
//                   onChange={(e) => setMaxSlots(Number(e.target.value))}
//                   className="w-full accent-amber-400 cursor-pointer"
//                 />
//                 <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
//                   <span>3 spots</span>
//                   <span className="text-amber-400 font-semibold">{maxSlots} slots chosen</span>
//                   <span>100 spots</span>
//                 </div>
//               </div>

//               <button
//                 type="button"
//                 onClick={() => canAffordBoost && setIsPriority((v) => !v)}
//                 disabled={!canAffordBoost}
//                 className={cn(
//                   "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors disabled:opacity-50",
//                   isPriority ? "border-white/25 bg-neutral-800" : "border-white/5 bg-[#151517] hover:bg-neutral-800/60"
//                 )}
//               >
//                 <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", isPriority ? "bg-white text-black" : "bg-neutral-900 text-neutral-500")}>
//                   <Zap className="h-4 w-4" />
//                 </span>
//                 <span>
//                   <span className="block text-sm font-semibold text-neutral-100">Featured</span>
//                   <span className="mt-0.5 block text-xs leading-5 text-neutral-500">
//                     Pin your demand to the top with a badge. Costs {boostCost} credits.
//                     {!canAffordBoost && " You don't have enough credits."}
//                   </span>
//                 </span>
//               </button>

//               <button
//                 type="button"
//                 onClick={() => setShareContact((v) => !v)}
//                 className={cn(
//                   "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
//                   shareContact ? "border-white/25 bg-neutral-800" : "border-white/5 bg-[#151517] hover:bg-neutral-800/60"
//                 )}
//               >
//                 <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", shareContact ? "bg-white text-black" : "bg-neutral-900 text-neutral-500")}>
//                   <MessageCircle className="h-4 w-4" />
//                 </span>
//                 <span>
//                   <span className="block text-sm font-semibold text-neutral-100">Allow bidders to reach me on WhatsApp</span>
//                   <span className="mt-0.5 block text-xs leading-5 text-neutral-500">Off by default. In-app chat always works either way.</span>
//                 </span>
//               </button>
//             </div>
//           )}

//           {/* STEP 7: REVIEW */}
//           {step === "review" && (
//             <div className="space-y-3">
//               <div className="space-y-2 rounded-2xl border border-white/5 bg-[#151517] p-4">
//                 {selectedParent && selectedSub && (
//                   <span className="inline-block rounded-full border border-white/10 bg-neutral-900 px-2.5 py-0.5 text-xs font-bold text-neutral-300">
//                     {selectedParent.name} › {selectedSub.name}
//                   </span>
//                 )}
//                 <p className="text-sm font-medium leading-6 text-neutral-100">{summary}</p>
//                 {mediaUrls.length > 0 && (
//                   <p className="text-xs font-semibold text-neutral-500">📎 {mediaUrls.length} media attachment(s) uploaded</p>
//                 )}
//                 <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
//                   {formatBudgetRange(budgetMin ? Number(budgetMin) : null, budgetMax ? Number(budgetMax) : null) && (
//                     <span className="font-semibold text-neutral-200">
//                       {formatBudgetRange(budgetMin ? Number(budgetMin) : null, budgetMax ? Number(budgetMax) : null)}
//                     </span>
//                   )}
//                   <span>Expires {timelineEnd.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
//                   <span className="text-amber-400 font-semibold">{maxSlots} Bid Slots</span>
//                 </div>
//               </div>

//               {/* Posting fee & Credit Summary */}
//               <div className="rounded-2xl border border-neutral-800 bg-[#121214] p-4 space-y-2.5">
//                 <div className="flex items-center justify-between text-xs">
//                   <span className="text-neutral-400">Posting fee</span>
//                   <span className="font-semibold text-white">10 Credits</span>
//                 </div>
//                 {isPriority && (
//                   <div className="flex items-center justify-between text-xs">
//                     <span className="text-neutral-400">Featured boost fee</span>
//                     <span className="font-semibold text-amber-400">+{boostCost} Credits</span>
//                   </div>
//                 )}
//                 <div className="flex items-center justify-between text-xs">
//                   <span className="text-neutral-400">Price per response spot</span>
//                   <span className="font-semibold text-emerald-400">
//                     ₹{calculateSlotPrice(budgetMax ? Number(budgetMax) : null, budgetMin ? Number(budgetMin) : null).rupees} / slot
//                   </span>
//                 </div>
//                 <div className="h-px bg-neutral-800 my-1" />
//                 <div className="flex items-center justify-between text-xs font-bold">
//                   <span className="text-neutral-300">Total Required</span>
//                   <span className="text-amber-400 text-sm">{totalCreditCost} Credits</span>
//                 </div>
//                 <div className="flex items-center justify-between text-xs">
//                   <span className="text-neutral-400">Your Balance</span>
//                   <span className={cn("font-bold", canAffordPost ? "text-emerald-400" : "text-red-400")}>
//                     {creditBalance ?? 0} Credits
//                   </span>
//                 </div>

//                 {!canAffordPost && (
//                   <div className="mt-2 rounded-xl bg-red-950/40 border border-red-900/50 p-2.5 flex items-center justify-between">
//                     <span className="text-xs text-red-300">
//                       Short by {totalCreditCost - (creditBalance ?? 0)} credits
//                     </span>
//                     <button
//                       type="button"
//                       onClick={() => setShowTopUpModal(true)}
//                       className="rounded-lg bg-amber-400 px-2.5 py-1 text-xs font-bold text-black hover:bg-amber-300"
//                     >
//                       Top Up Now
//                     </button>
//                   </div>
//                 )}
//               </div>
//             </div>
//           )}
//         </div>

//         {/* Footer — iOS white pill */}
//         <div className="border-t border-white/5 px-5 py-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
//           {isLastStep && !canAffordPost ? (
//             <button
//               type="button"
//               onClick={() => setShowTopUpModal(true)}
//               className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-amber-400 text-sm font-bold text-black transition-opacity active:scale-[0.98]"
//             >
//               <Coins className="h-4 w-4" />
//               <span>Top Up Credits to Post ({totalCreditCost} Credits)</span>
//             </button>
//           ) : (
//             <button
//               type="button"
//               onClick={isLastStep ? submit : goNext}
//               disabled={submitting}
//               className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-pearl text-sm font-semibold text-slate-navy transition-opacity active:scale-[0.98] disabled:opacity-40"
//             >
//               {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
//               {isLastStep ? (submitting ? "Posting…" : `Post demand (10 Credits)`) : "Continue"}
//             </button>
//           )}
//         </div>
    
//       </FamilyDrawerContent>
//       </FamilyDrawerPortal>
//     </FamilyDrawerRoot>

//     <AddCreditsModal
//       open={showTopUpModal}
//       onClose={() => setShowTopUpModal(false)}
//       requiredCredits={totalCreditCost}
//       currentBalance={creditBalance}
//       onSuccess={(newBal) => {
//         setCreditBalance(newBal);
//         setShowTopUpModal(false);
//       }}
//     />
//     </>
//   );
// }

"use client";

import { BoostDaysPicker, useBoostSettings } from "@/components/boost/boost-days-picker";
import { boostCost as boostCost_, clampBoostDays } from "@/lib/boost-shared";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Zap, MessageCircle, Loader2, Check, Coins, Plus, Minus, Users, ChevronLeft, Megaphone, Search, Pencil, MapPin, IndianRupee, CalendarClock, LayoutGrid, FileText } from "lucide-react";
import { motion } from "motion/react";
import { ServiceAreaPicker, type ServiceAreaValue } from "@/components/service-area-picker";
import { PRICE_UNIT_INFO, priceUnitsFor, withPriceUnit, type PriceUnit } from "@/lib/price-units";
import { DEFAULT_SERVICE_RADIUS_KM, serviceAreaLabel } from "@/lib/service-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { countWords } from "@/lib/words";
import { MAX_SUMMARY_WORDS, MAX_TIMELINE_DAYS, POST_LIFETIME_DAYS, TIMELINE_CHIPS } from "@/lib/validation/demand";
import { formatBudgetRange } from "@/lib/money";
import { CATEGORIES_DATA, ParentCategorySpec, ProviderSpec, SubCategorySpec } from "@/lib/categories";
import { IndustryBadges, TagChips } from "@/components/category-flow/chips";
import { MediaUploadField } from "@/components/media-upload-field";
import { TagPicker } from "@/components/tag-picker";
import { useGeolocation } from "@/lib/use-geolocation";
import { LocationPicker, type PickedLocation } from "@/components/location-picker";
import { celebrate } from "@/components/celebration";
import { AddCreditsModal } from "@/components/add-credits-modal";
import { CreditPaymentDrawer, type PaymentInvoice } from "@/components/credit-payment-drawer";
import type { CreditAuth } from "@/lib/validation/tpin";
import { haptic } from "@/lib/haptics";
import { COMPLETION_LABELS, completionLabel, completionProfileFor, type CompletionCode } from "@/lib/completion-timeline";
import { DEMAND_POST_CREDIT_COST, MIN_BID_SLOTS, MAX_BID_SLOTS, calculateSlotPrice } from "@/lib/slot-pricing";
import {
  RulerIcon,
  CpuIcon,
  PaletteIcon,
  TrendingUpIcon,
  WorkflowIcon,
  ClapperboardIcon,
  LanguagesIcon,
  StoreIcon,
  Building2Icon,
  SparklesIcon,
  SlidersHorizontalIcon,
  HeartPulseIcon,
  WalletIcon,
  ShieldCheckIcon,
  BriefcaseIcon,
  NetworkIcon,
  PartyPopperIcon,
  PlaneIcon,
  GraduationCapIcon,
  HeartIcon,
  PawPrintIcon,
  GemIcon,
} from "@animateicons/react/lucide";
import { Layers01Icon, HeartCheckIcon, Analytics01Icon } from "@animateicons/react/huge";
import {
  FamilyDrawerAnimatedContent,
  FamilyDrawerAnimatedWrapper,
  FamilyDrawerButton,
  FamilyDrawerClose,
  FamilyDrawerContent,
  FamilyDrawerDescription,
  FamilyDrawerHandle,
  FamilyDrawerHeader,
  FamilyDrawerOverlay,
  FamilyDrawerPortal,
  FamilyDrawerRoot,
  FamilyDrawerSecondaryButton,
  FamilyDrawerTitle,
  FamilyDrawerTrigger,
  FamilyDrawerViewContent,
  LIQUID_GLASS_SHEET,
  useFamilyDrawer,
  type ViewsRegistry,
} from "@/components/ui/family-drawer"
import { SnapSheet, SheetScrollArea } from "@/components/ui/snap-sheet";
import { useSheetStyle } from "@/lib/sheet-style";
import { customTagError, normalizeTagInput } from "@/lib/custom-tags";

type PostType = "PROMOTE" | "REQUIREMENT";
type Step = "intent" | "role" | "category" | "sub" | "provider" | "details" | "reach" | "review";
// Offers: no connect-within / delivery timeline / response spots; instead a "reach" step
// for the service area and the featured boost.
const PROMOTE_STEPS: Step[] = ["intent", "category", "sub", "provider", "details", "reach", "review"];
// "role" ("Who are you looking for?") step is disabled for now — re-add it after "intent" to bring it back.
// const REQUIREMENT_STEPS: Step[] = ["intent", "role", "category", "sub", "provider", "details", "review"];
const REQUIREMENT_STEPS: Step[] = ["intent", "category", "sub", "provider", "details", "review"];

const STEP_TITLES: Record<Step, string> = {
  intent: "What do you want to post?",
  role: "Who are you looking for?",
  category: "What are you promoting?",
  sub: "Pick a Sub Category",
  provider: "Service, common needs & tech",
  details: "Put a detailed Description",
  reach: "Service area & Featured",
  review: "Review & Post",
};

interface RoleOption {
  id: string;
  name: string;
  description: string | null;
}

/** Steps that only make sense once a taxonomy sub category is chosen (custom demands skip them). */
const TAXONOMY_STEPS: Step[] = ["sub", "provider"];

const MAX_PROBLEMS = 10;

type IconType = React.ComponentType<{
  size?: number;
  className?: string;
  fill?: string;
  strokeWidth?: number;
}>;

/**
 * Icon + color per parent category.
 * Keys must match the `id` in CATEGORIES_DATA — adjust these to your real ids.
 */
const CATEGORY_META: Record<string, { icon: IconType; color: string }> = {
  "13": { icon: HeartPulseIcon, color: "text-red-400" },        // Health & Wellness
  "14": { icon: RulerIcon, color: "text-sky-400" },             // Legal & Compliance
  "15": { icon: WalletIcon, color: "text-emerald-400" },        // Financial Advisory & Wealth Coaching
  "16": { icon: Building2Icon, color: "text-blue-300" },        // Real Estate
  "17": { icon: LanguagesIcon, color: "text-teal-300" },        // Immigration, Visa & Relocation Consultancy
  "18": { icon: ShieldCheckIcon, color: "text-indigo-300" },    // IP & Patent Law Advisory
  "19": { icon: TrendingUpIcon, color: "text-orange-400" },     // Business
  "20": { icon: BriefcaseIcon, color: "text-lime-300" },        // Career Coaching & Mock Interviews
  "21": { icon: SparklesIcon, color: "text-yellow-300" },       // Spiritual & Puja Services
  "22": { icon: NetworkIcon, color: "text-cyan-300" },          // B2B Strategy & Expert Networks
  "23": { icon: PartyPopperIcon, color: "text-pink-400" },      // Events
  "24": { icon: PlaneIcon, color: "text-sky-300" },             // Travel
  "25": { icon: CpuIcon, color: "text-violet-400" },            // Software and Tech
  "26": { icon: GraduationCapIcon, color: "text-amber-300" },   // Education & Tutoring
  "27": { icon: HeartIcon, color: "text-rose-400" },            // Relationships, Parenting & Family
  "28": { icon: PawPrintIcon, color: "text-orange-300" },       // Pets & Veterinary
  "29": { icon: GemIcon, color: "text-fuchsia-300" },           // Beauty, Fashion & Personal Styling
  "30": { icon: ClapperboardIcon, color: "text-fuchsia-400" },  // Creative, Media & Content Creation
  "8": { icon: HeartCheckIcon, color: "text-red-400" },         // Customers
  "10": { icon: Analytics01Icon, color: "text-cyan-400" },      // Data & Analytics
};
const FALLBACK_META = { icon: Layers01Icon as IconType, color: "text-brand-400" };

function metaFor(cat: ParentCategorySpec) {
  return CATEGORY_META[cat.id] ?? FALLBACK_META;
}

function addHours(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface PostDemandModalProps {
  open: boolean;
  onClose: () => void;
}

export function PostDemandModal({ open, onClose }: PostDemandModalProps) {
  const sheetStyle = useSheetStyle();
    // const { setView } = useFamilyDrawer();
  const router = useRouter();
  const [step, setStep] = useState<Step>("intent");
  const [submitting, setSubmitting] = useState(false);

  const [postType, setPostType] = useState<PostType | null>(null);
  const [roles, setRoles] = useState<RoleOption[] | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const [selectedParent, setSelectedParent] = useState<ParentCategorySpec | null>(CATEGORIES_DATA[0] ?? null);
  const [selectedSub, setSelectedSub] = useState<SubCategorySpec | null>(CATEGORIES_DATA[0]?.subCategories[0] ?? null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderSpec | null>(null);
  // "Custom" in the Who you are / Who should solve it step: a typed provider type.
  const [customProviderOpen, setCustomProviderOpen] = useState(false);
  const [customProvider, setCustomProvider] = useState("");
  const [selectedProblemIds, setSelectedProblemIds] = useState<string[]>([]);
  const [selectedInputs, setSelectedInputs] = useState<Record<string, string[]>>({});
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [summary, setSummary] = useState("");
  const [budget, setBudget] = useState("");
  const [timelineEnd, setTimelineEnd] = useState<Date>(addHours(72));
  const [completion, setCompletion] = useState<CompletionCode | null>(null);
  const [completionDate, setCompletionDate] = useState("");
  const [isPriority, setIsPriority] = useState(false);
  const { config: boostConfig } = useBoostSettings(open);
  const [boostDays, setBoostDays] = useState<number>(boostConfig.minDays);
  const [shareContact, setShareContact] = useState(false);
  const [priceUnit, setPriceUnit] = useState<PriceUnit | null>(null);
  const [serviceArea, setServiceArea] = useState<ServiceAreaValue>({
    type: null,
    areas: [],
    radiusKm: DEFAULT_SERVICE_RADIUS_KM,
    online: false,
  });
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [maxSlots, setMaxSlots] = useState<number>(MIN_BID_SLOTS);
  const [showTopUpModal, setShowTopUpModal] = useState<boolean>(false);

  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const { lat: userLat, lng: userLng } = useGeolocation();
  // Picked in the location search; falls back to the remembered device location (never prompts on open).
  const [place, setPlace] = useState<PickedLocation | null>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const meRes = await fetch("/api/users/me");
      if (meRes.ok) {
        const { profile } = await meRes.json();
        setCreditBalance(profile.creditBalance);
        // "Show my phone on requests" default, chosen during onboarding.
        if (profile.onboarding?.shareContactDefault) setShareContact(true);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const res = await fetch("/api/requirement-roles");
      setRoles(res.ok ? (await res.json()).roles : []);
    })().catch(() => setRoles([]));
  }, [open]);

  const wordCount = countWords(summary);
  const overWordLimit = wordCount > MAX_SUMMARY_WORDS;
  // Featured boost is priced per day (admin → Boosting); days stay inside min..max.
  const boostPick = clampBoostDays(boostConfig, "new", boostDays);
  const boostCost = boostCost_(boostConfig, "new", boostPick);
  const minBoostCost = boostCost_(boostConfig, "new", boostConfig.minDays);
  const totalCreditCost = DEMAND_POST_CREDIT_COST + (isPriority ? boostCost : 0);
  const canAffordBoost = creditBalance == null || creditBalance >= DEMAND_POST_CREDIT_COST + minBoostCost;
  const canAffordPost = creditBalance == null || creditBalance >= totalCreditCost;
  const isRequirement = postType === "REQUIREMENT";
  const STEPS = isRequirement ? REQUIREMENT_STEPS : PROMOTE_STEPS;
  const stepIndex = STEPS.indexOf(step);
  const isLastStep = stepIndex === STEPS.length - 1;
  const selectedRole = roles?.find((r) => r.id === selectedRoleId) ?? null;
  const budgetValue = budget ? Number(budget) : null;
  const completionProfile = completionProfileFor(selectedSub?.id, selectedParent?.id);
  // A pick from another category's list is dropped when the category changes.
  const completionPick = completion && completionProfile.options.includes(completion) ? completion : null;
  const priceUnits = priceUnitsFor(selectedSub?.id, selectedParent?.id);
  const priceUnitPick = priceUnit && priceUnits.includes(priceUnit) ? priceUnit : null;
  const DAY = 24 * 60 * 60 * 1000;
  const featuredDays = isPriority ? boostPick : 0;
  // Every paid post runs 7 days (a request can pick less); featured days always fit inside or stretch it.
  const nowMs = Date.now();
  const featuredEndMs = featuredDays ? nowMs + featuredDays * DAY : null;
  const baseEndMs = isRequirement ? Math.min(timelineEnd.getTime(), nowMs + POST_LIFETIME_DAYS * DAY) : nowMs + POST_LIFETIME_DAYS * DAY;
  const liveEndMs = Math.max(baseEndMs, featuredEndMs ?? 0);
  const liveDays = Math.max(1, Math.round((liveEndMs - nowMs) / DAY));
  const areaLabel = serviceAreaLabel({
    serviceAreaType: serviceArea.type,
    serviceAreas: serviceArea.areas,
    serviceRadiusKm: serviceArea.radiusKm,
    serviceOnline: serviceArea.online,
    locationName: place?.name ?? null,
  });

  // A typed provider type (validated with the custom tag rules) wins over a pick.
  const customProviderTrimmed = customProviderOpen ? customProvider.trim().replace(/\s+/g, " ") : "";
  const customProviderError = customProviderTrimmed ? customTagError(normalizeTagInput(customProviderTrimmed)) : null;
  const customProviderName = customProviderTrimmed && !customProviderError ? customProviderTrimmed : null;
  const providerLabel = customProviderName ?? selectedProvider?.name ?? null;

  function choosePostType(type: PostType) {
    void haptic("medium");
    setPostType(type);
    if (type === "PROMOTE") setSelectedRoleId(null);
    if (!selectedParent) {
      setSelectedParent(CATEGORIES_DATA[0] ?? null);
      selectSub(CATEGORIES_DATA[0]?.subCategories[0] ?? null);
    }
    // Role step disabled — requirements go straight to category like promotions.
    // setStep(type === "REQUIREMENT" ? "role" : "category");
    setStep("category");
  }

  function toggleOptionValue(inputLabel: string, option: string) {
    setSelectedInputs((prev) => {
      const current = prev[inputLabel] ?? [];
      const exists = current.includes(option);
      const updated = exists ? current.filter((o) => o !== option) : [...current, option];
      return { ...prev, [inputLabel]: updated };
    });
  }

  function selectSub(sub: SubCategorySpec | null) {
    setSelectedSub(sub);
    setSelectedProvider(null);
    setSelectedProblemIds([]);
    setCustomProviderOpen(false);
    setCustomProvider("");
  }

  function selectProvider(provider: ProviderSpec | null) {
    setSelectedProvider(provider);
    setSelectedProblemIds([]);
    // Picking from the list replaces a typed one.
    if (provider) {
      setCustomProviderOpen(false);
      setCustomProvider("");
    }
  }

  function toggleProblem(problemId: string) {
    setSelectedProblemIds((prev) => {
      if (prev.includes(problemId)) return prev.filter((id) => id !== problemId);
      if (prev.length >= MAX_PROBLEMS) return prev;
      return [...prev, problemId];
    });
  }

  function startCustom() {
    setSelectedParent(null);
    selectSub(null);
    setStep("details");
  }

  function goNext() {
    if (step === "role" && !selectedRole) {
      void haptic("error");
      toast.error("Please select the role you're looking for.");
      return;
    }
    if (step === "category" && (!selectedParent || !selectedSub)) {
      void haptic("error");
      toast.error("Please select a challenge category.");
      return;
    }
    if (step === "provider" && customProviderOpen && customProviderTrimmed && customProviderError) {
      void haptic("error");
      toast.error(customProviderError.replace(/tags/gi, "names"));
      return;
    }
    if (step === "details" && (summary.trim().length === 0 || overWordLimit)) {
      void haptic("error");
      toast.error(
        overWordLimit
          ? `Keep it to ${MAX_SUMMARY_WORDS} words or fewer.`
          : isRequirement
            ? "Tell people what you need first."
            : "Tell people what you're promoting first.",
      );
      return;
    }
    if (step === "details" && (budgetValue == null || !Number.isFinite(budgetValue) || budgetValue <= 0)) {
      void haptic("error");
      toast.error(isRequirement ? "Add your budget." : "Add your price.");
      return;
    }
    if (step === "details" && !isRequirement && !priceUnitPick) {
      void haptic("error");
      toast.error("Pick how you charge — per unit, per service or the whole package.");
      return;
    }
    if (step === "reach" && !serviceArea.type) {
      void haptic("error");
      toast.error("Pick where you offer this.");
      return;
    }
    if (step === "reach" && serviceArea.type === "REGIONS" && serviceArea.areas.length === 0) {
      void haptic("error");
      toast.error("Add at least one state, district or city.");
      return;
    }
    if (step === "reach" && serviceArea.type === "NEARBY" && !place && (userLat == null || userLng == null)) {
      void haptic("error");
      toast.error("Set your location so nearby people can find you.");
      return;
    }
    if (step === "details" && isRequirement && !completionPick) {
      void haptic("error");
      toast.error(isRequirement ? "Pick when the work should be completed." : "Pick your delivery timeline.");
      return;
    }
    if (step === "details" && isRequirement && completionPick === "DATE" && !completionDate) {
      void haptic("error");
      toast.error("Pick the date.");
      return;
    }
    if (stepIndex < STEPS.length - 1) {
      void haptic("medium");
      setStep(STEPS[stepIndex + 1]!);
    }
  }

  function goBack() {
    const prev = STEPS[stepIndex - 1];
    if (!prev) return;
    void haptic("light");
    // Custom challenges skip the taxonomy steps — never land on an empty step
    if (TAXONOMY_STEPS.includes(prev) && !selectedSub) {
      setStep("category");
      return;
    }
    setStep(prev);
  }

  function handleClose() {
    if (submitting) return;
    onClose();
  }

  async function submit() {
    if (creditBalance != null && creditBalance < totalCreditCost) {
      void haptic("warning");
      toast.error(`Posting requires ${totalCreditCost} credits. You have ${creditBalance} credits.`);
      setShowTopUpModal(true);
      return;
    }
    setSubmitting(true);
  }

  /** Where the post is pinned on the map. Offers available everywhere aren't tied to a point. */
  function postPoint(): { lat?: number; lng?: number; locationName?: string } {
    const placeLabel = place ? [place.name, place.secondary?.split(", ")[0]].filter(Boolean).join(", ") : undefined;
    if (isRequirement || serviceArea.type === "NEARBY") {
      return { lat: place?.lat ?? userLat ?? undefined, lng: place?.lng ?? userLng ?? undefined, locationName: placeLabel };
    }
    if (serviceArea.type === "REGIONS") {
      const first = serviceArea.areas.find((a) => a.lat != null && a.lng != null);
      return first
        ? { lat: first.lat!, lng: first.lng!, locationName: first.name }
        : { lat: userLat ?? undefined, lng: userLng ?? undefined };
    }
    return {};
  }

  function requestPost(auth: CreditAuth) {
    const point = postPoint();
    return fetch("/api/demands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        postType: postType ?? "PROMOTE",
        requirementRoleId: isRequirement ? selectedRoleId ?? undefined : undefined,
        summary: summary.trim(),
        budget: budgetValue ?? undefined,
        ...(isRequirement
          ? {
              timelineEnd: timelineEnd.toISOString(),
              completionTimeline: completionPick ?? undefined,
              completionDate:
                completionPick === "DATE" && completionDate ? new Date(`${completionDate}T12:00:00`).toISOString() : undefined,
              maxSlots,
            }
          : {
              priceUnit: priceUnitPick ?? undefined,
              serviceAreaType: serviceArea.type ?? undefined,
              serviceAreas: serviceArea.type === "REGIONS" ? serviceArea.areas : [],
              serviceRadiusKm: serviceArea.type === "NEARBY" ? serviceArea.radiusKm : undefined,
              serviceOnline: serviceArea.online,
            }),
        isPriority,
        boostDays: isPriority ? boostPick : undefined,
        shareContact,
        categoryParentId: selectedParent?.id,
        categorySubId: selectedSub?.id,
        categoryName: selectedParent?.name,
        subCategoryName: selectedSub?.name,
        categoryProviderId: customProviderName ? undefined : selectedProvider?.id,
        categoryProblemIds: selectedProvider && !customProviderName ? selectedProblemIds : [],
        customProviderName: customProviderName ?? undefined,
        tags: selectedTags,
        selectedTechInputs: selectedInputs,
        mediaUrls,
        ...point,
        auth,
      }),
    });
  }

  function handlePostPaid(data: { demand: { id: string }; creditBalance: number }, toInvoice: boolean) {
    setSubmitting(false);
    setCreditBalance(data.creditBalance);
    // The next post starts again at the Promote / Requirement choice.
    setStep("intent");
    setPostType(null);
    setSelectedRoleId(null);
    setSummary("");
    setBudget("");
    setCompletion(null);
    setCompletionDate("");
    setTimelineEnd(addHours(72));
    setSelectedTags([]);
    setMediaUrls([]);
    setCustomProviderOpen(false);
    setCustomProvider("");
    setIsPriority(false);
    setBoostDays(boostConfig.minDays);
    setPriceUnit(null);
    setServiceArea({ type: null, areas: [], radiusKm: DEFAULT_SERVICE_RADIUS_KM, online: false });
    const wasRequirement = isRequirement;
    const boosted = isPriority;
    setPlace(null);
    onClose();
    if (toInvoice) return;
    // FamPay-style moment, then straight into the new post.
    void celebrate({
      kind: "posted",
      title: wasRequirement ? "Request posted!" : "Offer posted!",
      subtitle: boosted ? "It's featured at the top — responses will start coming in." : "People can respond now. We'll notify you.",
      duration: 2500,
    }).then(() => router.push(`/demands/${data.demand.id}`));
  }

  const dayFmt = (ms: number) => new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

  const featuredToggle = (
    <button
      type="button"
      onClick={() => { if (!canAffordBoost) return; void haptic("medium"); setIsPriority((v) => !v); }}
      disabled={!canAffordBoost}
      className={cn(
        "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors disabled:opacity-50",
        isPriority ? "border-amber-400/40 bg-amber-400/[0.10]" : "border-white/5 bg-white/[0.06] hover:bg-white/10"
      )}
    >
      <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", isPriority ? "bg-amber-400 text-black" : "bg-white/[0.08] text-neutral-500")}>
        <Zap className="h-4 w-4" />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-neutral-100">Featured</span>
        <span className="mt-0.5 block text-xs leading-5 text-neutral-500">
          Rotates at the top of the feed with a Featured badge. {boostConfig.pricePerDay} credits / day,{" "}
          {boostConfig.minDays}–{boostConfig.maxDays} days (from {minBoostCost} credits).
          {!canAffordBoost && " You don't have enough credits."}
        </span>
      </span>
      <span className={cn("mt-1 relative h-6 w-10 shrink-0 rounded-full transition-colors", isPriority ? "bg-amber-400" : "bg-white/15")}>
        <motion.span layout className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow" style={{ left: isPriority ? 18 : 2 }} />
      </span>
    </button>
  );

  // Day-by-day bar: featured days in amber, then the normal days, up to the end of the post.
  const lifetimeBar = (
    <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-3.5">
      <div className="flex gap-1">
        {Array.from({ length: liveDays }).map((_, i) => (
          <motion.span
            key={i}
            layout
            className={cn("h-2 flex-1 rounded-full", i < featuredDays ? "bg-amber-400" : "bg-white/25")}
          />
        ))}
      </div>
      <p className="mt-2.5 text-xs leading-5 text-neutral-400">
        {featuredDays === 0
          ? `Live for ${liveDays} days as a normal post, until ${dayFmt(liveEndMs)}.`
          : featuredDays >= liveDays
            ? `Featured for all ${liveDays} days it's live, until ${dayFmt(liveEndMs)}.`
            : `Featured for ${featuredDays} days, then a normal post for ${liveDays - featuredDays} more — live ${liveDays} days, until ${dayFmt(liveEndMs)}.`}
      </p>
    </div>
  );

  const priceText =
    budgetValue != null
      ? isRequirement
        ? formatBudgetRange(budgetValue, budgetValue)
        : withPriceUnit(formatBudgetRange(budgetValue, budgetValue), priceUnitPick)
      : null;

  const reviewRows: { label: string; value: string; done: boolean; step: Step | null; icon: typeof Check }[] = [
    {
      label: "Category",
      value: selectedParent && selectedSub
        ? `${selectedParent.name} › ${selectedSub.name}${providerLabel ? ` › ${providerLabel}` : ""}`
        : "Custom",
      done: true,
      step: selectedParent ? "category" : null,
      icon: LayoutGrid,
    },
    {
      label: "Description",
      value: summary.trim() ? `${summary.trim().slice(0, 70)}${summary.trim().length > 70 ? "…" : ""}` : "Missing",
      done: summary.trim().length > 0 && !overWordLimit,
      step: "details",
      icon: FileText,
    },
    {
      label: isRequirement ? "Budget" : "Price",
      value: priceText ?? "Missing",
      done: budgetValue != null && budgetValue > 0 && (isRequirement || priceUnitPick != null),
      step: "details",
      icon: IndianRupee,
    },
    ...(isRequirement
      ? [
          {
            label: "Connect within",
            value: `Until ${timelineEnd.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`,
            done: true,
            step: "details" as Step,
            icon: CalendarClock,
          },
          {
            label: "Completion",
            value: completionPick
              ? completionLabel(completionPick, completionPick === "DATE" && completionDate ? `${completionDate}T12:00:00` : null) ?? ""
              : "Missing",
            done: completionPick != null,
            step: "details" as Step,
            icon: CalendarClock,
          },
        ]
      : [
          {
            label: "Service area",
            value: areaLabel ?? "Missing",
            done: areaLabel != null,
            step: "reach" as Step,
            icon: MapPin,
          },
        ]),
    {
      label: "Featured",
      value: isPriority ? `${boostPick} days · ${boostCost} credits` : "Off",
      done: true,
      step: isRequirement ? null : "reach",
      icon: Zap,
    },
  ];

  const nextSteps: { title: string; detail: string; tone: string }[] = [
    { title: "Goes live right away", detail: "As soon as you confirm the payment.", tone: "bg-emerald-400" },
    ...(featuredDays > 0
      ? [{
          title: `Featured for ${featuredDays} days`,
          detail: `Rotates at the top of the feed until ${dayFmt(featuredEndMs!)}.`,
          tone: "bg-amber-400",
        }]
      : []),
    ...(liveDays > featuredDays && featuredDays > 0
      ? [{ title: "Then a normal post", detail: `For ${liveDays - featuredDays} more days.`, tone: "bg-white/60" }]
      : []),
    {
      title: isRequirement ? "Providers respond" : "People connect with you",
      detail: "You'll get a notification for each one, and can chat in the app.",
      tone: "bg-sky-400",
    },
    { title: `Closes ${dayFmt(liveEndMs)}`, detail: "You can feature it again any time from your posts.", tone: "bg-white/30" },
  ];

  return (
    <>
      {/* Opens half way; swipe up for full height. Tapping outside, swiping it down or Escape closes it
          (the draft stays, since the form state lives in this component). */}
      <SnapSheet open={open} onClose={onClose} label="Post a request or offer" theme={sheetStyle}>

          {/* Header */}
          <div className="relative px-5 pb-4 pt-1">
            <div className="flex items-center justify-between">
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  disabled={submitting}
                  aria-label="Back"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.08] text-neutral-300 transition-colors hover:bg-white/10 active:scale-95 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              ) : (
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.08]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo/xivago-transparent-favicon.png" alt="xivago" className="h-5 w-5 object-contain" />
                </div>
              )}
              <h2 className="min-w-0 flex-1 px-2 text-center text-base font-medium text-neutral-400">{stepIndex > 0 ? `${stepIndex}/${STEPS.length - 1} · ${STEP_TITLES[step]}` : STEP_TITLES[step]}</h2>
              <div className="flex shrink-0 items-center gap-2">
                {/* {creditBalance != null && (
                  <span className="flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-400">
                    <Coins className="h-3 w-3" /> {creditBalance} Credits
                  </span>
                )} */}
                {/* Working close button */}
                {/* <FamilyDrawerClose className="static h-9 w-9 shrink-0 border border-white/10 bg-white/[0.08]">
                  <X className="h-4 w-4 text-neutral-400" />
                </FamilyDrawerClose> */}
              </div>
            </div>
          </div>

        {/* Progress */}
        <div className="flex gap-1.5 px-5 pb-2">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= stepIndex ? "bg-white" : "bg-white/10"
              )}
            />
          ))}
        </div>

        {/* Content */}
        <SheetScrollArea className="space-y-5 px-5 py-4">
          {/* FIRST STEP: Promote or Requirement */}
          {step === "intent" && (
            <div className="grid grid-cols-1 gap-3">
              {([
                { type: "PROMOTE", title: "An offer", body: "You provide a service or product. Get found by people who need it.", icon: Megaphone },
                { type: "REQUIREMENT", title: "A request", body: "You need a service or product. Providers respond, you choose.", icon: Search },
              ] as const).map(({ type, title, body, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => choosePostType(type)}
                  aria-pressed={postType === type}
                  className={cn(
                    "flex w-full items-center gap-4 rounded-3xl border p-5 text-left transition-all active:scale-[0.98]",
                    postType === type ? "border-white/25 bg-white/[0.14]" : "border-white/5 bg-white/[0.06] hover:bg-white/10"
                  )}
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/[0.08] text-white">
                    <Icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold text-neutral-100">{title}</span>
                    <span className="mt-0.5 block text-sm leading-5 text-neutral-400">{body}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* REQUIREMENT: pick a role */}
          {step === "role" && (
            <div className="space-y-3">
              {roles === null ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-neutral-400" aria-label="Loading roles" />
              ) : roles.length === 0 ? (
                <p className="rounded-2xl border border-white/5 bg-white/[0.06] p-4 text-center text-sm text-neutral-400">
                  No roles are available right now. Please try again later.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {roles.map((role) => {
                    const active = selectedRoleId === role.id;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => { void haptic("selection"); setSelectedRoleId(role.id); }}
                        aria-pressed={active}
                        className={cn(
                          "flex flex-col gap-1 rounded-2xl border p-3.5 text-left transition-all active:scale-[0.97]",
                          active ? "border-white/25 bg-white/[0.14]" : "border-white/5 bg-white/[0.06] hover:bg-white/10"
                        )}
                      >
                        <span className="flex items-center justify-between gap-2 text-sm font-semibold text-neutral-100">
                          {role.name}
                          {active && <Check className="h-4 w-4 shrink-0 text-white" />}
                        </span>
                        {role.description && <span className="text-xs leading-4 text-neutral-500">{role.description}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* STEP 1 — the image design */}
          {step === "category" && (
            <div className="space-y-6">
              <h1 className="text-center text-[26px] font-semibold tracking-tight text-white">
                Which category fits best?
              </h1>

              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES_DATA.map((cat) => {
                  const active = selectedParent?.id === cat.id;
                  const meta = metaFor(cat);
                  const Icon = meta.icon;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSelectedParent(cat);
                        selectSub(cat.subCategories[0] ?? null);
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center gap-2.5 rounded-3xl border-l border-bs py-3.5 transition-all active:scale-[0.97]",
                        active
                          ? "border-[#222222] bg-white/[0.16]"
                          : "border-white/20 bg-white/[0.05] hover:bg-white/10"
                      )}
                    >
                      
                        <Icon
                          size={30}
                          strokeWidth={1.5}
                          fill="currentColor"
                          className={cn(meta.color, active && "scale-110")}
                        />
                      
                      <span className="text-sm font-semibold w-32 text-center text-neutral-100">{cat.name}</span>
                    </button>
                  );
                })}
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 text-neutral-500">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs">Can’t find it?</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              {/* Custom card */}
              <button
                type="button"
                onClick={startCustom}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/5 bg-white/[0.06] p-4 text-left transition-colors hover:bg-white/10 active:scale-[0.99]"
              >
                <div className="flex items-center gap-3">
                  <SlidersHorizontalIcon size={28} className="text-neutral-400" />
                  <div>
                    <p className="text-base font-semibold text-neutral-100">Custom</p>
                    <p className="text-xs text-neutral-500">Describe what you need</p>
                  </div>
                </div>
                {/* Optional sticker — drop your "own goals" png at /stickers/own-goals.png, or delete this img */}
                <img
                  src="/stickers/own-goals.png"
                  alt="Own goals"
                  className="h-16 w-16 rotate-[-8deg] object-contain"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
              </button>
            </div>
          )}

          {/* STEP 2: SUB-CATEGORY */}
          {step === "sub" && selectedSub && selectedParent && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/5 bg-white/[0.06] p-4">
                <span className="text-xs font-semibold text-neutral-400">
                  {selectedParent.name} › {selectedSub.name}
                </span>
                <p className="mt-1 text-xs text-neutral-500">{selectedSub.subtitle}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedSub.topSkills.map((skill) => (
                    <span key={skill} className="rounded-full border border-white/10 bg-white/[0.08] px-2.5 py-0.5 text-[11px] font-semibold text-neutral-300">
                      ★ {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {selectedParent.subCategories.map((sub) => {
                  const active = selectedSub?.id === sub.id;
                  return (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => { void haptic("selection"); if (sub.id !== selectedSub?.id) selectSub(sub); }}
                      className={cn(
                        "flex w-full flex-col rounded-2xl border p-4 text-left transition-all",
                        active
                          ? "border-white/25 bg-white/[0.14]"
                          : "border-white/5 bg-white/[0.06] hover:bg-white/10"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-neutral-100">{sub.name}</span>
                        {active && <Check className="h-4 w-4 text-white" />}
                      </div>
                      <p className="mt-1 text-xs text-neutral-500">{sub.subtitle}</p>
                      <IndustryBadges industries={sub.industries} tone="dark" className="mt-2.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: PROVIDER + PROBLEMS + INPUTS */}
          {step === "provider" && selectedSub && selectedParent && (
            <div className="space-y-5">
              <span className="inline-block rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-semibold text-neutral-300">
                {selectedParent.name} › {selectedSub.name}
              </span>

              <div className="space-y-2">
                <Label className="text-xs font-semibold text-neutral-300">
                  {isRequirement ? "Who should solve it? (optional)" : "Who you are (optional)"}
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedSub.providers.map((provider) => {
                    const active = selectedProvider?.id === provider.id;
                    return (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => { void haptic("selection"); selectProvider(active ? null : provider); }}
                        aria-pressed={active}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                          active
                            ? "border-white bg-white text-black"
                            : "border-white/10 bg-white/[0.06] text-neutral-300 hover:bg-white/10"
                        )}
                      >
                        {active && "✓ "}
                        {provider.name}
                      </button>
                    );
                  })}
                  {/* Not in the list → type it */}
                  <button
                    type="button"
                    onClick={() => {
                      void haptic("selection");
                      const next = !customProviderOpen;
                      setCustomProviderOpen(next);
                      if (next) selectProvider(null);
                      else setCustomProvider("");
                    }}
                    aria-pressed={customProviderOpen}
                    className={cn(
                      "flex items-center gap-1 rounded-lg border border-dashed px-3 py-1.5 text-xs font-semibold transition-colors",
                      customProviderOpen
                        ? "border-white bg-white text-black"
                        : "border-white/25 bg-transparent text-neutral-300 hover:bg-white/10"
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" /> Custom
                  </button>
                </div>
                {customProviderOpen && (
                  <div className="space-y-1">
                    <Input
                      autoFocus
                      value={customProvider}
                      onChange={(e) => setCustomProvider(e.target.value.slice(0, 40))}
                      maxLength={40}
                      placeholder={isRequirement ? "e.g. Wedding photographer" : "e.g. Certified yoga trainer"}
                      aria-label={isRequirement ? "Who should solve it" : "Who you are"}
                      className="h-11 rounded-xl border-white/10 bg-white/[0.06] text-sm text-neutral-100 placeholder:text-neutral-600"
                    />
                    <p className={cn("text-[11px]", customProviderError ? "text-red-400" : "text-neutral-500")}>
                      {customProviderError
                        ? customProviderError.replace(/tags/gi, "names")
                        : `${isRequirement ? "Type the kind of person you need" : "Type what you are"} · ${customProvider.trim().length}/40`}
                    </p>
                  </div>
                )}
              </div>

              {selectedProvider && !customProviderOpen && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-neutral-300">
                    What problem are you solving? <span className="font-normal text-neutral-500">(pick any)</span>
                  </Label>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedProvider.problems.map((problem) => {
                      const active = selectedProblemIds.includes(problem.id);
                      return (
                        <button
                          key={problem.id}
                          type="button"
                          onClick={() => { void haptic("selection"); toggleProblem(problem.id); }}
                          aria-pressed={active}
                          className={cn(
                            "flex w-full flex-col gap-2 rounded-2xl border p-3.5 text-left transition-all",
                            active ? "border-white/25 bg-white/[0.14]" : "border-white/5 bg-white/[0.06] hover:bg-white/10"
                          )}
                        >
                          <span className="flex items-start justify-between gap-2 text-sm font-medium text-neutral-100">
                            {problem.title}
                            {active && <Check className="h-4 w-4 shrink-0 text-white" />}
                          </span>
                          <TagChips tags={problem.tags} tone="dark" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedSub.requiredInputs.map((reqInput) => (
                <div key={reqInput.label} className="space-y-2">
                  <Label className="text-xs font-semibold text-neutral-300">{reqInput.label}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {reqInput.options.map((opt) => {
                      const selected = (selectedInputs[reqInput.label] ?? []).includes(opt);
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => { void haptic("selection"); toggleOptionValue(reqInput.label, opt); }}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                            selected
                              ? "border-white bg-white text-black"
                              : "border-white/10 bg-white/[0.06] text-neutral-300 hover:bg-white/10"
                          )}
                        >
                          {selected && "✓ "}
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* STEP 4: DETAILS — summary, media, budget, deadline */}
          {step === "details" && (
            <div className="space-y-6">
            <div className="space-y-4">
              {selectedParent && selectedSub && (
                <span className="inline-block rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-semibold text-neutral-300">
                  {selectedParent.name} › {selectedSub.name}
                  {providerLabel && ` › ${providerLabel}`}
                </span>
              )}
              {selectedRole && (
                <span className="inline-block rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-semibold text-neutral-300">
                  Seeking {selectedRole.name}
                </span>
              )}
              <textarea
                id="summary"
                rows={5}
                autoFocus
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder={isRequirement ? "What do you need?" : "What are you offering?"}
                className={cn(
                  "w-full resize-none rounded-2xl border bg-white/[0.06] px-4 py-3 text-sm leading-6 text-neutral-100 placeholder:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
                  overWordLimit ? "border-red-500/60" : "border-white/10"
                )}
              />
              <p className={cn("-mt-2 text-right text-xs", overWordLimit ? "font-semibold text-red-400" : "text-neutral-600")}>
                {wordCount}/{MAX_SUMMARY_WORDS} words
              </p>

              <div className="space-y-2 border-t border-white/5 pt-3">
                <Label className="text-xs font-semibold text-neutral-300">
                  Tags <span className="font-normal text-neutral-500">(up to 5)</span>
                </Label>
                <TagPicker value={selectedTags} onChange={setSelectedTags} subId={selectedSub?.id} allowCustom />
              </div>

              <div className="space-y-2 border-t border-white/5 pt-3">
                <Label className="text-xs font-semibold text-neutral-300">Photos & Videos</Label>
                <MediaUploadField value={mediaUrls} onChange={setMediaUrls} maxFiles={5} />
              </div>
            </div>

            {/* Budget / price: required */}
            <div className="space-y-1.5 border-t border-white/5 pt-4">
              <Label htmlFor="budget" className="text-sm font-semibold text-neutral-200">
                {isRequirement ? "Budget (₹)" : "Price (₹)"} <span className="text-red-400">*</span>
              </Label>
              <Input id="budget" type="number" inputMode="numeric" min={1} required value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="25000"
                className="border-white/10 bg-white/[0.06] text-neutral-100 placeholder:text-neutral-600" />
              <p className="text-xs text-neutral-500">
                {isRequirement ? "What you're ready to spend. Providers see this before they connect." : "What you charge for this service."}
              </p>
            </div>

            {/* Offers: how the price is charged — the choices depend on the category */}
            {!isRequirement && (
              <div className="space-y-2.5">
                <div>
                  <p className="text-sm font-semibold text-neutral-200">
                    How do you charge? <span className="text-red-400">*</span>
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {budgetValue && priceUnitPick
                      ? `Shown as ${withPriceUnit(formatBudgetRange(budgetValue, budgetValue), priceUnitPick)}`
                      : "Pick what your price covers."}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {priceUnits.map((code) => {
                    const active = priceUnitPick === code;
                    return (
                      <motion.button
                        key={code}
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        aria-pressed={active}
                        onClick={() => { void haptic("selection"); setPriceUnit(code); }}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 text-left transition-colors",
                          active ? "border-white bg-white text-black" : "border-white/10 bg-white/[0.06] text-neutral-300 hover:bg-white/10"
                        )}
                      >
                        <span className="block text-sm font-semibold">{PRICE_UNIT_INFO[code].label}</span>
                        <span className={cn("block text-[11px] leading-4", active ? "text-black/55" : "text-neutral-500")}>
                          {PRICE_UNIT_INFO[code].hint}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Requests only — Connect within: how long the post stays open (timelineEnd), up to 7 days */}
            {isRequirement && (
            <div className="space-y-4 border-t border-white/5 pt-4">
              <p className="text-sm font-semibold text-neutral-200">Connect within</p>
              <p className="-mt-2 text-xs text-neutral-500">
                How long providers have to respond and connect with you (up to {MAX_TIMELINE_DAYS} days).
              </p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {TIMELINE_CHIPS.map((chip) => {
                  const chipDate = addHours(chip.hours);
                  const active = Math.abs(chipDate.getTime() - timelineEnd.getTime()) < 60_000;
                  return (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => { void haptic("selection"); setTimelineEnd(chipDate); }}
                      className={cn(
                        "rounded-xl border px-2 py-2.5 text-sm font-semibold transition-colors",
                        active
                          ? "border-white bg-white text-black"
                          : "border-white/10 bg-white/[0.06] text-neutral-300 hover:bg-white/10"
                      )}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-1.5 w-[92%]">
                <Label htmlFor="timelineCustom" className="text-neutral-400">Custom date/time</Label>
                <Input
                  id="timelineCustom"
                  type="datetime-local"
                  value={toLocalDatetimeInputValue(timelineEnd)}
                  min={toLocalDatetimeInputValue(addHours(0))}
                  max={toLocalDatetimeInputValue(addHours(MAX_TIMELINE_DAYS * 24))}
                  onChange={(e) => {
                    const next = new Date(e.target.value);
                    if (!Number.isNaN(next.getTime())) setTimelineEnd(next);
                  }}
                  className="border-white/10 bg-white/[0.06] text-neutral-100 [color-scheme:dark]"
                />
              </div>
            </div>
            )}

            {/* Requests only — Completion: when the work itself should be done; options depend on the category */}
            {isRequirement && (
            <div className="space-y-3 border-t border-white/5 pt-4">
              <div>
                <p className="text-sm font-semibold text-neutral-200">
                  {isRequirement ? "Completion timeline" : "Delivery timeline"} <span className="text-red-400">*</span>
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  {isRequirement ? completionProfile.requestHint : completionProfile.offerHint}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {completionProfile.options.map((code) => (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={completionPick === code}
                    onClick={() => { void haptic("selection"); setCompletion(code); }}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
                      completionPick === code
                        ? "border-white bg-white text-black"
                        : "border-white/10 bg-white/[0.06] text-neutral-300 hover:bg-white/10"
                    )}
                  >
                    {COMPLETION_LABELS[code]}
                  </button>
                ))}
              </div>
              {completionPick === "DATE" && (
                <div className="space-y-1.5 w-[92%]">
                  <Label htmlFor="completionDate" className="text-neutral-400">Date</Label>
                  <Input
                    id="completionDate"
                    type="date"
                    value={completionDate}
                    min={toLocalDatetimeInputValue(addHours(0)).slice(0, 10)}
                    max={toLocalDatetimeInputValue(addHours(730 * 24)).slice(0, 10)}
                    onChange={(e) => setCompletionDate(e.target.value)}
                    className="border-white/10 bg-white/[0.06] text-neutral-100 [color-scheme:dark]"
                  />
                </div>
              )}
            </div>
            )}
            </div>
          )}

          {/* OFFERS: where the service is available + featured boost */}
          {step === "reach" && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-neutral-200">
                  Where do you offer this? <span className="text-red-400">*</span>
                </p>
                <p className="mt-0.5 text-xs text-neutral-500">People searching in these places will find your offer.</p>
              </div>
              <ServiceAreaPicker
                value={serviceArea}
                onChange={setServiceArea}
                place={place}
                onPlaceChange={(p) => { void haptic("light"); setPlace(p); }}
              />
              <div className="space-y-3 border-t border-white/5 pt-4">
                <div>
                  <p className="text-sm font-semibold text-neutral-200">Get featured</p>
                  <p className="mt-0.5 text-xs text-neutral-500">Optional. Featured offers rotate at the top of the feed.</p>
                </div>
                {featuredToggle}
                {isPriority && <BoostDaysPicker config={boostConfig} mode="new" days={boostPick} onChange={setBoostDays} />}
                {lifetimeBar}
              </div>
            </div>
          )}

          {/* LAST STEP: options (requests), live preview, checklist with edit links, what happens next, cost */}
          {step === "review" && (
            <div className="space-y-4">
              {isRequirement && (
                <div className="space-y-3">
                  {/* Response spots: 3 to 100 */}
                  <div className="rounded-2xl border border-white/5 bg-white/[0.06] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-400">
                          <Users className="h-4 w-4" />
                        </span>
                        <div>
                          <span className="block text-sm font-semibold text-neutral-100">Response spots</span>
                          <span className="block text-xs text-neutral-400">How many providers can respond (3–100)</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => { void haptic("selection"); setMaxSlots((s) => Math.max(MIN_BID_SLOTS, s - 1)); }}
                          disabled={maxSlots <= MIN_BID_SLOTS}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.14] text-white hover:bg-neutral-700 disabled:opacity-30"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <input
                          type="number"
                          min={MIN_BID_SLOTS}
                          max={MAX_BID_SLOTS}
                          value={maxSlots}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!Number.isNaN(val)) setMaxSlots(Math.min(MAX_BID_SLOTS, Math.max(MIN_BID_SLOTS, val)));
                          }}
                          className="w-14 rounded-lg bg-black px-2 py-1 text-center text-sm font-bold text-amber-400 outline-none ring-1 ring-white/10"
                        />
                        <button
                          type="button"
                          onClick={() => { void haptic("selection"); setMaxSlots((s) => Math.min(MAX_BID_SLOTS, s + 1)); }}
                          disabled={maxSlots >= MAX_BID_SLOTS}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.14] text-white hover:bg-neutral-700 disabled:opacity-30"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={MIN_BID_SLOTS}
                      max={MAX_BID_SLOTS}
                      value={maxSlots}
                      onChange={(e) => setMaxSlots(Number(e.target.value))}
                      className="w-full cursor-pointer accent-amber-400"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
                      <span>3 spots</span>
                      <span className="font-semibold text-amber-400">{maxSlots} slots chosen</span>
                      <span>100 spots</span>
                    </div>
                  </div>

                  <LocationPicker value={place} onChange={(p) => { void haptic("light"); setPlace(p); }} />
                  {featuredToggle}
                  {isPriority && <BoostDaysPicker config={boostConfig} mode="new" days={boostPick} onChange={setBoostDays} />}
                </div>
              )}

              <button
                type="button"
                onClick={() => { void haptic("light"); setShareContact((v) => !v); }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors",
                  shareContact ? "border-white/25 bg-white/[0.14]" : "border-white/5 bg-white/[0.06] hover:bg-white/10"
                )}
              >
                <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", shareContact ? "bg-white text-black" : "bg-white/[0.08] text-neutral-500")}>
                  <MessageCircle className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-neutral-100">
                    {isRequirement ? "Allow bidders to reach me on WhatsApp" : "Allow people to reach me on WhatsApp"}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-neutral-500">Off by default. In-app chat always works either way.</span>
                </span>
                <span className={cn("mt-1 relative h-6 w-10 shrink-0 rounded-full transition-colors", shareContact ? "bg-emerald-400" : "bg-white/15")}>
                  <motion.span layout className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow" style={{ left: shareContact ? 18 : 2 }} />
                </span>
              </button>

              {/* Live preview: how the post will look in the feed */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Preview</p>
                <motion.div
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border p-4",
                    isPriority ? "border-amber-400/40 bg-gradient-to-br from-amber-400/[0.12] to-white/[0.04]" : "border-white/10 bg-white/[0.06]"
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                      {isRequirement ? "Request" : "Offer"}
                    </span>
                    {isPriority && (
                      <span className="flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
                        <Zap className="h-3 w-3" /> Featured
                      </span>
                    )}
                    {selectedParent && selectedSub && (
                      <span className="truncate text-[11px] font-semibold text-neutral-400">
                        {selectedParent.name} › {selectedSub.name}
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-4 text-sm font-medium leading-6 text-neutral-100">{summary || "Your description shows here"}</p>
                  <TagChips tags={selectedTags} tone="dark" />
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
                    {budgetValue != null && (
                      <span className="text-sm font-bold text-white">
                        {isRequirement ? formatBudgetRange(budgetValue, budgetValue) : withPriceUnit(formatBudgetRange(budgetValue, budgetValue), priceUnitPick)}
                      </span>
                    )}
                    {!isRequirement && areaLabel && (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {areaLabel}</span>
                    )}
                    {isRequirement && place && (
                      <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {place.name}</span>
                    )}
                    {mediaUrls.length > 0 && <span>📎 {mediaUrls.length}</span>}
                  </div>
                </motion.div>
              </div>

              {/* Checklist — tap a row to go back and change it */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Check everything · tap to change</p>
                <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.04]">
                  {reviewRows.map((row, i) => (
                    <motion.button
                      key={row.label}
                      type="button"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      onClick={() => {
                        if (!row.step) return;
                        void haptic("light");
                        setStep(row.step);
                      }}
                      className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:bg-white/5"
                    >
                      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full", row.done ? "bg-emerald-400/15 text-emerald-400" : "bg-red-500/15 text-red-400")}>
                        {row.done ? <Check className="h-4 w-4" strokeWidth={3} /> : <row.icon className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{row.label}</span>
                        <span className="block truncate text-sm text-neutral-100">{row.value}</span>
                      </span>
                      {row.step && <Pencil className="h-3.5 w-3.5 shrink-0 text-neutral-500" />}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* What happens next */}
              <div className="rounded-2xl border border-white/5 bg-white/[0.04] p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">What happens next</p>
                <ol className="relative space-y-3 border-l border-white/10 pl-5">
                  {nextSteps.map((n, i) => (
                    <motion.li
                      key={n.title}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.06 }}
                      className="relative"
                    >
                      <span className={cn("absolute -left-[27px] top-0.5 grid h-3.5 w-3.5 place-items-center rounded-full ring-4 ring-black", n.tone)} />
                      <p className="text-sm font-semibold text-neutral-100">{n.title}</p>
                      <p className="text-xs text-neutral-500">{n.detail}</p>
                    </motion.li>
                  ))}
                </ol>
              </div>

              {/* Posting fee & Credit Summary */}
              <div className="space-y-2.5 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Posting fee · live {POST_LIFETIME_DAYS} days</span>
                  <span className="font-semibold text-white">{DEMAND_POST_CREDIT_COST} Credits</span>
                </div>
                {isPriority && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400">
                      Featured boost ({boostConfig.pricePerDay} × {boostPick} days)
                    </span>
                    <span className="font-semibold text-amber-400">+{boostCost} Credits</span>
                  </div>
                )}
                {isRequirement && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-neutral-400">Price per response spot</span>
                    <span className="font-semibold text-emerald-400">
                      ₹{calculateSlotPrice(budgetValue).rupees} / slot
                    </span>
                  </div>
                )}
                <div className="my-1 h-px bg-white/[0.14]" />
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-neutral-300">Total Required</span>
                  <motion.span key={totalCreditCost} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="text-sm text-amber-400">
                    {totalCreditCost} Credits
                  </motion.span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Your Balance</span>
                  <span className={cn("font-bold", canAffordPost ? "text-emerald-400" : "text-red-400")}>
                    {creditBalance ?? 0} Credits
                  </span>
                </div>

                {!canAffordPost && (
                  <div className="mt-2 flex items-center justify-between rounded-xl border border-red-900/50 bg-red-950/40 p-2.5">
                    <span className="text-xs text-red-300">
                      Short by {totalCreditCost - (creditBalance ?? 0)} credits
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowTopUpModal(true)}
                      className="rounded-lg bg-amber-400 px-2.5 py-1 text-xs font-bold text-black hover:bg-amber-300"
                    >
                      Top Up Now
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetScrollArea>

        {/* Footer — iOS white pill. The first step advances when a card is tapped. */}
        {step !== "intent" && (
        <div className="border-t border-white/5 px-5 py-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          {isLastStep && !canAffordPost ? (
            <button
              type="button"
              onClick={() => setShowTopUpModal(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-amber-400 text-sm font-bold text-black transition-opacity active:scale-[0.98]"
            >
              <Coins className="h-4 w-4" />
              <span>Top Up Credits to Post ({totalCreditCost} Credits)</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={isLastStep ? submit : goNext}
              disabled={submitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-pearl text-sm font-semibold text-slate-navy transition-opacity active:scale-[0.98] disabled:opacity-40"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isLastStep ? (submitting ? "Posting…" : `Post ${isRequirement ? "request" : "offer"} (${totalCreditCost} credits)`) : "Continue"}
            </button>
          )}
        </div>
        )}

      </SnapSheet>

    <AddCreditsModal
      open={showTopUpModal}
      onClose={() => setShowTopUpModal(false)}
      requiredCredits={totalCreditCost}
      currentBalance={creditBalance}
      onSuccess={(newBal) => {
        setCreditBalance(newBal);
        setShowTopUpModal(false);
      }}
    />

    <CreditPaymentDrawer<{ invoice: PaymentInvoice; demand: { id: string }; creditBalance: number }>
      open={submitting}
      onClose={() => setSubmitting(false)}
      title={summary.trim()}
      items={[
        { label: "Posting fee", credits: DEMAND_POST_CREDIT_COST },
        ...(isPriority
          ? [{ label: `Featured boost · ${boostPick} days × ${boostConfig.pricePerDay}`, credits: boostCost }]
          : []),
      ]}
      request={requestPost}
      onDone={handlePostPaid}
    />
    </>
  );
}