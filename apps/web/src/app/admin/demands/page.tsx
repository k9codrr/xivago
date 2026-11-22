"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronDown, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBudgetRange } from "@/lib/money";
import { PRICE_UNITS, PRICE_UNIT_INFO, priceUnitsFor, withPriceUnit, type PriceUnit } from "@/lib/price-units";
import {
  AREA_KIND_LABEL,
  DEFAULT_SERVICE_RADIUS_KM,
  INDIA_STATES,
  SERVICE_AREA_TYPES,
  SERVICE_AREA_TYPE_INFO,
  SERVICE_RADIUS_CHOICES,
  parseServiceAreas,
  serviceAreaLabel,
  type AreaKind,
  type ServiceArea,
  type ServiceAreaType,
} from "@/lib/service-area";
import { COMPLETION_CODES, COMPLETION_LABELS, type CompletionCode } from "@/lib/completion-timeline";

type PostType = "PROMOTE" | "REQUIREMENT";
type Status = "OPEN" | "EXPIRED" | "FILLED" | "CANCELLED";

interface AdminDemand {
  id: string;
  postType: PostType;
  summary: string;
  status: Status;
  isPriority: boolean;
  priorityExpiresAt: string | null;
  timelineEnd: string;
  createdAt: string;
  budgetMin: number | null;
  budgetMax: number | null;
  priceUnit: string | null;
  serviceAreaType: string | null;
  serviceAreas: unknown;
  serviceRadiusKm: number | null;
  serviceOnline: boolean;
  completionTimeline: string | null;
  maxSlots: number;
  shareContact: boolean;
  tags: string[];
  categoryName: string | null;
  subCategoryName: string | null;
  categoryParentId: string | null;
  categorySubId: string | null;
  customProviderName: string | null;
  locationName: string | null;
  mediaUrls: string[];
  author: { id: string; name: string; email: string };
  _count: { bids: number; engagements: number };
}

interface AdminReport {
  id: string;
  reference: string;
  targetType: "DEMAND" | "USER";
  reason: string;
  details: string | null;
  createdAt: string;
  demand: { id: string; summary: string; status: string } | null;
  reportedUser: { id: string; name: string; email: string; isBanned: boolean } | null;
  reporter: { id: string; name: string };
}

interface Filters {
  type: "" | PostType;
  status: "" | Status;
  area: "" | ServiceAreaType;
  featured: boolean;
  q: string;
}

const INPUT =
  "w-full rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100";
const SELECT = INPUT;
const LABEL = "block space-y-1 text-xs font-medium text-neutral-600 dark:text-neutral-400";
const CHIP = "rounded-full px-2 py-0.5 text-[10.5px] font-bold";

const isFeatured = (d: AdminDemand) =>
  d.isPriority && (!d.priorityExpiresAt || new Date(d.priorityExpiresAt).getTime() > Date.now());

export default function AdminDemandsPage() {
  const [demands, setDemands] = useState<AdminDemand[] | null>(null);
  const [counts, setCounts] = useState<{ postType: PostType; status: Status; count: number }[]>([]);
  const [reports, setReports] = useState<AdminReport[] | null>(null);
  const [filters, setFilters] = useState<Filters>({ type: "", status: "", area: "", featured: false, q: "" });
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (f: Filters) => {
    setDemands(null);
    const sp = new URLSearchParams();
    if (f.type) sp.set("type", f.type);
    if (f.status) sp.set("status", f.status);
    if (f.area) sp.set("area", f.area);
    if (f.featured) sp.set("featured", "1");
    if (f.q) sp.set("q", f.q);
    const res = await fetch(`/api/admin/demands?${sp}`);
    if (!res.ok) {
      setDemands([]);
      return;
    }
    const data = await res.json();
    setDemands(data.demands);
    setCounts(data.counts ?? []);
  }, []);

  useEffect(() => {
    void load(filters);
  }, [filters, load]);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/admin/reports");
      setReports(res.ok ? (await res.json()).reports : []);
    })();
  }, []);

  // Debounced search box.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === query.trim() ? f : { ...f, q: query.trim() })), 350);
    return () => clearTimeout(t);
  }, [query]);

  async function resolveReport(id: string, action: "resolve" | "dismiss") {
    const res = await fetch(`/api/admin/reports/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) { toast.error("Could not update this report."); return; }
    setReports((prev) => prev?.filter((r) => r.id !== id) ?? null);
    toast.success(action === "resolve" ? "Report marked resolved." : "Report dismissed.");
  }

  async function forceExpire(id: string) {
    const res = await fetch(`/api/admin/demands/${id}/force-expire`, { method: "POST" });
    if (!res.ok) { toast.error("Could not close this post."); return; }
    setDemands((prev) => prev?.map((d) => (d.id === id ? { ...d, status: "EXPIRED" } : d)) ?? null);
  }

  async function deleteDemand(id: string) {
    if (!window.confirm("Permanently delete this post and all its responses and chats? This can't be undone.")) return;
    const res = await fetch(`/api/admin/demands/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Could not delete this post."); return; }
    setDemands((prev) => prev?.filter((d) => d.id !== id) ?? null);
  }

  async function patch(id: string, body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch(`/api/admin/demands/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error(data?.error?.message ?? "Could not save this post.");
      return false;
    }
    toast.success("Post updated.");
    await load(filters);
    return true;
  }

  const count = (t: PostType, s?: Status) =>
    counts.filter((c) => c.postType === t && (!s || c.status === s)).reduce((n, c) => n + c.count, 0);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold dark:text-neutral-100">Posts</h1>

      {/* ── Totals ── */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Offers (all)" value={count("PROMOTE")} />
        <Stat label="Offers live" value={count("PROMOTE", "OPEN")} />
        <Stat label="Requests (all)" value={count("REQUIREMENT")} />
        <Stat label="Requests live" value={count("REQUIREMENT", "OPEN")} />
      </div>

      <h2 className="mb-2 text-sm font-semibold text-neutral-500">
        Open reports {reports && `(${reports.length})`}
      </h2>
      {reports === null ? (
        <div className="mb-6 flex justify-center py-6 text-neutral-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : reports.length === 0 ? (
        <p className="card-shell mb-6 p-4 text-sm text-neutral-400">No open reports.</p>
      ) : (
        <div className="card-shell mb-6 divide-y divide-neutral-100 dark:divide-neutral-800">
          {reports.map((r) => (
            <div key={r.id} className="space-y-1.5 p-3.5">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-bold",
                    r.targetType === "USER" ? "bg-purple-100 text-purple-700" : "bg-red-100 text-red-700",
                  )}
                >
                  {r.targetType === "USER" ? "USER" : "POST"}
                </span>
                <span className="font-mono text-neutral-500">{r.reference}</span>
                <span className="text-neutral-400">
                  by {r.reporter.name} · {new Date(r.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm font-semibold dark:text-neutral-100">{r.reason}</p>
              {r.details && <p className="text-xs text-neutral-600 dark:text-neutral-400">{r.details}</p>}
              <p className="text-xs text-neutral-500">
                {r.demand ? (
                  <Link href={`/demands/${r.demand.id}`} className="text-brand-600 hover:underline">
                    {r.demand.summary.slice(0, 80)}
                  </Link>
                ) : (
                  "Post deleted"
                )}
                {r.reportedUser && (
                  <>
                    {" · "}
                    <Link href={`/u/${r.reportedUser.id}`} className="hover:underline">
                      {r.reportedUser.name} ({r.reportedUser.email})
                    </Link>
                    {r.reportedUser.isBanned && <span className="ml-1 font-semibold text-red-600">banned</span>}
                  </>
                )}
              </p>
              <div className="flex gap-3 pt-1">
                <button onClick={() => resolveReport(r.id, "resolve")} className="text-xs font-medium text-brand-600 hover:underline">
                  Mark resolved
                </button>
                <button onClick={() => resolveReport(r.id, "dismiss")} className="text-xs font-medium text-neutral-500 hover:underline">
                  Dismiss
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold text-neutral-500">All posts</h2>

      {/* ── Filters ── */}
      <div className="card-shell mb-3 grid gap-2 p-3 sm:grid-cols-5">
        <label className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            className={cn(INPUT, "pl-8")}
            placeholder="Search text, author, email or id"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select className={SELECT} value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value as Filters["type"] }))}>
          <option value="">Offers & requests</option>
          <option value="PROMOTE">Offers</option>
          <option value="REQUIREMENT">Requests</option>
        </select>
        <select className={SELECT} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as Filters["status"] }))}>
          <option value="">Any status</option>
          {(["OPEN", "EXPIRED", "FILLED", "CANCELLED"] as const).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className={SELECT} value={filters.area} onChange={(e) => setFilters((f) => ({ ...f, area: e.target.value as Filters["area"] }))}>
          <option value="">Any service area</option>
          {SERVICE_AREA_TYPES.map((t) => (
            <option key={t} value={t}>{SERVICE_AREA_TYPE_INFO[t].label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300 sm:col-span-5">
          <input type="checkbox" checked={filters.featured} onChange={(e) => setFilters((f) => ({ ...f, featured: e.target.checked }))} />
          Featured right now only
        </label>
      </div>

      {demands === null ? (
        <div className="flex justify-center py-10 text-neutral-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : demands.length === 0 ? (
        <p className="card-shell p-4 text-sm text-neutral-400">No posts match these filters.</p>
      ) : (
        <div className="card-shell divide-y divide-neutral-100 dark:divide-neutral-800">
          {demands.map((d) => {
            const open = expanded === d.id;
            const price = withPriceUnit(formatBudgetRange(d.budgetMin, d.budgetMax), d.priceUnit);
            const area = serviceAreaLabel(d, 2);
            return (
              <div key={d.id}>
                <div className="flex items-start justify-between gap-3 p-3.5">
                  <button type="button" onClick={() => setExpanded(open ? null : d.id)} className="min-w-0 flex-1 text-left">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <span className={cn(CHIP, d.postType === "PROMOTE" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700")}>
                        {d.postType === "PROMOTE" ? "OFFER" : "REQUEST"}
                      </span>
                      {isFeatured(d) && <span className={cn(CHIP, "bg-amber-100 text-amber-700")}>FEATURED</span>}
                      <span className={cn(CHIP, d.status === "OPEN" ? "bg-brand-500/10 text-brand-600" : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800")}>
                        {d.status}
                      </span>
                      {d.subCategoryName && <span className="truncate text-[11px] text-neutral-400">{d.categoryName} › {d.subCategoryName}</span>}
                    </div>
                    <p className="truncate text-sm font-medium dark:text-neutral-100">{d.summary}</p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {d.author.name} · {price ?? "No price"} · {d._count.bids}/{d.maxSlots} spots · {d._count.engagements} views
                      {area && ` · ${area}`} · ends {new Date(d.timelineEnd).toLocaleDateString()}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-2">
                    {d.status === "OPEN" && (
                      <button onClick={() => forceExpire(d.id)} className="text-xs font-medium text-amber-600 hover:underline">
                        Force-expire
                      </button>
                    )}
                    <button onClick={() => deleteDemand(d.id)} className="text-xs font-medium text-red-600 hover:underline">
                      Delete
                    </button>
                    <button
                      type="button"
                      aria-label={open ? "Hide options" : "Show all options"}
                      onClick={() => setExpanded(open ? null : d.id)}
                      className="rounded p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    >
                      <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
                    </button>
                  </div>
                </div>
                {open && <PostEditor demand={d} onSave={(body) => patch(d.id, body)} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card-shell p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-xl font-bold tabular-nums dark:text-neutral-100">{value}</p>
    </div>
  );
}

/* ───────── Every option on one post ───────── */

function PostEditor({ demand, onSave }: { demand: AdminDemand; onSave: (body: Record<string, unknown>) => Promise<boolean> }) {
  const [postType, setPostType] = useState<PostType>(demand.postType);
  const [status, setStatus] = useState<Status>(demand.status);
  const [summary, setSummary] = useState(demand.summary);
  const [budget, setBudget] = useState(demand.budgetMax != null ? String(demand.budgetMax) : "");
  const [priceUnit, setPriceUnit] = useState<string>(demand.priceUnit ?? "");
  const [areaType, setAreaType] = useState<string>(demand.serviceAreaType ?? "");
  const [areas, setAreas] = useState<ServiceArea[]>(parseServiceAreas(demand.serviceAreas));
  const [radius, setRadius] = useState(String(demand.serviceRadiusKm ?? DEFAULT_SERVICE_RADIUS_KM));
  const [online, setOnline] = useState(demand.serviceOnline);
  const [completion, setCompletion] = useState<string>(demand.completionTimeline ?? "");
  const [maxSlots, setMaxSlots] = useState(String(demand.maxSlots));
  const [shareContact, setShareContact] = useState(demand.shareContact);
  const [tags, setTags] = useState(demand.tags.join(", "));
  const [customProvider, setCustomProvider] = useState(demand.customProviderName ?? "");
  const [locationName, setLocationName] = useState(demand.locationName ?? "");
  const [extendDays, setExtendDays] = useState("");
  const [featuredDays, setFeaturedDays] = useState("");
  const [newArea, setNewArea] = useState<{ kind: AreaKind; name: string; state: string }>({ kind: "STATE", name: "", state: "" });
  const [saving, setSaving] = useState(false);

  // The category's usual price types first, then the rest.
  const suggested = priceUnitsFor(demand.categorySubId, demand.categoryParentId);
  const unitOptions: PriceUnit[] = [...suggested, ...PRICE_UNITS.filter((u) => !suggested.includes(u))];

  async function save() {
    setSaving(true);
    const body: Record<string, unknown> = {
      postType,
      // Only when changed, so extending an expired post can re-open it.
      ...(status !== demand.status ? { status } : {}),
      summary,
      budget: budget ? Number(budget) : null,
      priceUnit: priceUnit || null,
      serviceAreaType: areaType || null,
      serviceAreas: areaType === "REGIONS" ? areas : [],
      serviceRadiusKm: areaType === "NEARBY" ? Number(radius) || DEFAULT_SERVICE_RADIUS_KM : null,
      serviceOnline: areaType === "ONLINE" ? true : online,
      completionTimeline: completion || null,
      maxSlots: Number(maxSlots) || demand.maxSlots,
      shareContact,
      tags: tags.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 5),
      customProviderName: customProvider.trim() || null,
      locationName: locationName.trim() || null,
    };
    if (extendDays) body.extendDays = Number(extendDays);
    if (featuredDays !== "") body.featuredDays = Number(featuredDays);
    const ok = await onSave(body);
    setSaving(false);
    if (ok) {
      setExtendDays("");
      setFeaturedDays("");
    }
  }

  function addArea() {
    const name = newArea.name.trim();
    if (!name) return;
    setAreas((prev) => [...prev, { kind: newArea.kind, name, state: newArea.kind === "STATE" ? null : newArea.state || null }].slice(0, 20));
    setNewArea((a) => ({ ...a, name: "" }));
  }

  return (
    <div className="space-y-4 border-t border-neutral-100 bg-neutral-50/60 p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
        <span>ID <span className="font-mono">{demand.id}</span></span>
        <span>Author <Link href={`/u/${demand.author.id}`} className="text-brand-600 hover:underline">{demand.author.name}</Link> ({demand.author.email})</span>
        <span>Posted {new Date(demand.createdAt).toLocaleString()}</span>
        <span>Live until {new Date(demand.timelineEnd).toLocaleString()}</span>
        {isFeatured(demand) && demand.priorityExpiresAt && <span>Featured until {new Date(demand.priorityExpiresAt).toLocaleString()}</span>}
        <Link href={`/demands/${demand.id}`} className="text-brand-600 hover:underline">Open post →</Link>
      </div>

      {demand.mediaUrls.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {demand.mediaUrls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" className="h-16 w-16 shrink-0 rounded-md object-cover" />
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className={LABEL}>
          <span>Type</span>
          <select className={SELECT} value={postType} onChange={(e) => setPostType(e.target.value as PostType)}>
            <option value="PROMOTE">Offer</option>
            <option value="REQUIREMENT">Request</option>
          </select>
        </label>
        <label className={LABEL}>
          <span>Status</span>
          <select className={SELECT} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {(["OPEN", "EXPIRED", "FILLED", "CANCELLED"] as const).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          <span>{postType === "PROMOTE" ? "Who they are (custom)" : "Who should solve it (custom)"}</span>
          <input className={INPUT} value={customProvider} maxLength={40} onChange={(e) => setCustomProvider(e.target.value)} placeholder="Empty = picked from list" />
        </label>
      </div>

      <label className={LABEL}>
        <span>Description</span>
        <textarea className={cn(INPUT, "min-h-[72px]")} value={summary} maxLength={500} onChange={(e) => setSummary(e.target.value)} />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className={LABEL}>
          <span>{postType === "PROMOTE" ? "Price (₹)" : "Budget (₹)"}</span>
          <input className={INPUT} type="number" min={1} value={budget} onChange={(e) => setBudget(e.target.value)} />
        </label>
        <label className={LABEL}>
          <span>Price type</span>
          <select className={SELECT} value={priceUnit} onChange={(e) => setPriceUnit(e.target.value)}>
            <option value="">None</option>
            {unitOptions.map((u) => (
              <option key={u} value={u}>
                {PRICE_UNIT_INFO[u].label}{suggested.includes(u) ? " ★" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          <span>Completion timeline</span>
          <select className={SELECT} value={completion} onChange={(e) => setCompletion(e.target.value)}>
            <option value="">None</option>
            {COMPLETION_CODES.map((c) => (
              <option key={c} value={c}>{COMPLETION_LABELS[c as CompletionCode]}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Service area */}
      <div className="space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
        <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">Service area</p>
        <div className="flex flex-wrap gap-1.5">
          <AreaChip active={areaType === ""} onClick={() => setAreaType("")} label="Not set" />
          {SERVICE_AREA_TYPES.map((t) => (
            <AreaChip key={t} active={areaType === t} onClick={() => setAreaType(t)} label={SERVICE_AREA_TYPE_INFO[t].label} />
          ))}
        </div>
        {areaType === "NEARBY" && (
          <label className={cn(LABEL, "max-w-[200px]")}>
            <span>Radius (km)</span>
            <select className={SELECT} value={radius} onChange={(e) => setRadius(e.target.value)}>
              {[...new Set([...SERVICE_RADIUS_CHOICES.map(String), radius])].map((r) => (
                <option key={r} value={r}>{r} km</option>
              ))}
            </select>
          </label>
        )}
        {areaType === "REGIONS" && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {areas.length === 0 && <span className="text-xs text-neutral-400">No areas yet.</span>}
              {areas.map((a, i) => (
                <span key={`${a.kind}-${a.name}-${i}`} className="flex items-center gap-1 rounded-full bg-neutral-200 px-2 py-0.5 text-xs dark:bg-neutral-800 dark:text-neutral-200">
                  {AREA_KIND_LABEL[a.kind]}: {a.name}{a.state ? `, ${a.state}` : ""}
                  <button type="button" aria-label={`Remove ${a.name}`} onClick={() => setAreas((prev) => prev.filter((_, j) => j !== i))} className="text-neutral-500 hover:text-red-600">×</button>
                </span>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              <select className={SELECT} value={newArea.kind} onChange={(e) => setNewArea((a) => ({ ...a, kind: e.target.value as AreaKind }))}>
                <option value="STATE">State</option>
                <option value="DISTRICT">District</option>
                <option value="CITY">City</option>
              </select>
              {newArea.kind === "STATE" ? (
                <select className={cn(SELECT, "sm:col-span-2")} value={newArea.name} onChange={(e) => setNewArea((a) => ({ ...a, name: e.target.value }))}>
                  <option value="">Pick a state</option>
                  {INDIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <>
                  <input className={INPUT} placeholder="Name" value={newArea.name} onChange={(e) => setNewArea((a) => ({ ...a, name: e.target.value }))} />
                  <select className={SELECT} value={newArea.state} onChange={(e) => setNewArea((a) => ({ ...a, state: e.target.value }))}>
                    <option value="">State (optional)</option>
                    {INDIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </>
              )}
              <button type="button" onClick={addArea} className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium dark:border-neutral-700 dark:text-neutral-200">
                Add area
              </button>
            </div>
          </div>
        )}
        {(areaType === "NEARBY" || areaType === "REGIONS") && (
          <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} /> Also available online
          </label>
        )}
        <label className={cn(LABEL, "max-w-md")}>
          <span>Location label</span>
          <input className={INPUT} value={locationName} maxLength={200} onChange={(e) => setLocationName(e.target.value)} />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <label className={LABEL}>
          <span>Response spots</span>
          <input className={INPUT} type="number" min={1} max={100} value={maxSlots} onChange={(e) => setMaxSlots(e.target.value)} />
        </label>
        <label className={LABEL}>
          <span>Extend live time by (days)</span>
          <input className={INPUT} type="number" min={1} max={365} placeholder="e.g. 7" value={extendDays} onChange={(e) => setExtendDays(e.target.value)} />
        </label>
        <label className={LABEL}>
          <span>Feature for (days from now)</span>
          <input className={INPUT} type="number" min={0} max={365} placeholder="0 = remove Featured" value={featuredDays} onChange={(e) => setFeaturedDays(e.target.value)} />
        </label>
        <label className="flex items-end gap-2 pb-1.5 text-sm text-neutral-600 dark:text-neutral-300">
          <input type="checkbox" checked={shareContact} onChange={(e) => setShareContact(e.target.checked)} /> Share contact
        </label>
      </div>

      <label className={LABEL}>
        <span>Tags (comma separated, up to 5)</span>
        <input className={INPUT} value={tags} onChange={(e) => setTags(e.target.value)} />
      </label>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function AreaChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium",
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300",
      )}
    >
      {label}
    </button>
  );
}
