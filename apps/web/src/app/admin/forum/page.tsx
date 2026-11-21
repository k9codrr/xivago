"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Check, X, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PendingAttachment {
  id: string;
  url: string;
  moderationNote: string | null;
  createdAt: string;
  message: { id: string; text: string; sender: { id: string; name: string; email: string } };
}

interface OpenReport {
  id: string;
  targetType: "MESSAGE" | "COMMENT";
  targetId: string;
  reason: string;
  createdAt: string;
  reporter: { name: string };
  target?: { id: string; text: string; deletedAt: string | null };
}

export default function AdminForumPage() {
  const [attachments, setAttachments] = useState<PendingAttachment[] | null>(null);
  const [reports, setReports] = useState<OpenReport[] | null>(null);

  async function load() {
    const res = await fetch("/api/admin/forum/pending");
    if (res.ok) {
      const data = await res.json();
      setAttachments(data.attachments);
      setReports(data.reports);
    } else {
      setAttachments([]);
      setReports([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function moderateAttachment(id: string, approve: boolean) {
    const res = await fetch(`/api/admin/forum/attachments/${id}/moderate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve }),
    });
    if (!res.ok) { toast.error("Could not update this attachment."); return; }
    setAttachments((prev) => prev?.filter((a) => a.id !== id) ?? null);
    toast.success(approve ? "Approved — now visible to everyone." : "Rejected.");
  }

  async function resolveReport(id: string, action: "dismiss" | "remove_content") {
    const res = await fetch(`/api/admin/forum/reports/${id}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) { toast.error("Could not update this report."); return; }
    setReports((prev) => prev?.filter((r) => r.id !== id) ?? null);
    toast.success(action === "remove_content" ? "Content removed." : "Report dismissed.");
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="mb-1 text-xl font-bold dark:text-neutral-100">Feed moderation</h1>
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
          Attachments stay hidden from everyone but their author until approved here (see fail-closed default).
        </p>

        <h2 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Pending attachments {attachments && `(${attachments.length})`}
        </h2>
        {attachments === null ? (
          <div className="flex justify-center py-6 text-neutral-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : attachments.length === 0 ? (
          <p className="card-shell p-4 text-sm text-neutral-400">Nothing pending.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {attachments.map((a) => (
              <div key={a.id} className="card-shell overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt="" className="h-48 w-full object-cover" />
                <div className="p-3">
                  <p className="mb-1 line-clamp-2 text-xs text-neutral-600 dark:text-neutral-300">{a.message.text}</p>
                  <p className="mb-2 text-[11px] text-neutral-400">
                    {a.message.sender.name} · {a.message.sender.email}
                    {a.moderationNote && <span className="block">Note: {a.moderationNote}</span>}
                  </p>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => moderateAttachment(a.id, true)}>
                      <Check className="h-3.5 w-3.5" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => moderateAttachment(a.id, false)}>
                      <X className="h-3.5 w-3.5" /> Reject
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          Open reports {reports && `(${reports.length})`}
        </h2>
        {reports === null ? (
          <div className="flex justify-center py-6 text-neutral-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <p className="card-shell p-4 text-sm text-neutral-400">No open reports.</p>
        ) : (
          <div className="card-shell divide-y divide-neutral-100 dark:divide-neutral-800">
            {reports.map((r) => (
              <div key={r.id} className="p-3.5">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-semibold text-red-600">{r.reason}</span>
                  <span className="text-[11px] text-neutral-400">reported by {r.reporter.name}</span>
                </div>
                <p className="mb-2 line-clamp-2 text-sm text-neutral-700 dark:text-neutral-200">
                  {r.target?.deletedAt ? <em className="text-neutral-400">Already deleted</em> : r.target?.text ?? "(content not found)"}
                </p>
                <div className="flex gap-2">
                  {!r.target?.deletedAt && (
                    <Button size="sm" variant="destructive" onClick={() => resolveReport(r.id, "remove_content")}>
                      <Trash2 className="h-3.5 w-3.5" /> Remove content
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => resolveReport(r.id, "dismiss")}>
                    <XCircle className="h-3.5 w-3.5" /> Dismiss
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
