"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  isVerified: boolean;
  isBanned: boolean;
  creditBalance: number;
  consentVersion: string | null;
  consentAcceptedAt: string | null;
  subscription: { plan: string; status: string } | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [q, setQ] = useState("");

  async function load(query?: string) {
    const url = new URL("/api/admin/users", window.location.origin);
    if (query) url.searchParams.set("q", query);
    const res = await fetch(url.toString());
    setUsers(res.ok ? (await res.json()).users : []);
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleBan(user: AdminUser) {
    const res = await fetch(`/api/admin/users/${user.id}/ban`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ banned: !user.isBanned }),
    });
    if (!res.ok) { toast.error("Could not update this user."); return; }
    setUsers((prev) => prev?.map((u) => (u.id === user.id ? { ...u, isBanned: !u.isBanned } : u)) ?? null);
  }

  async function toggleVerified(user: AdminUser) {
    const res = await fetch(`/api/admin/users/${user.id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: !user.isVerified }),
    });
    if (!res.ok) { toast.error("Could not update this user."); return; }
    setUsers((prev) => prev?.map((u) => (u.id === user.id ? { ...u, isVerified: !u.isVerified } : u)) ?? null);
  }

  async function togglePro(user: AdminUser) {
    const nextPlan = user.subscription?.plan === "PRO" ? "FREE" : "PRO";
    const res = await fetch(`/api/admin/users/${user.id}/subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: nextPlan }),
    });
    if (!res.ok) { toast.error("Could not update this subscription."); return; }
    const { subscription } = await res.json();
    setUsers((prev) => prev?.map((u) => (u.id === user.id ? { ...u, subscription } : u)) ?? null);
  }

  async function adjustCredits(user: AdminUser) {
    const raw = window.prompt(`Adjust credits for ${user.name} (current: ${user.creditBalance}). Enter +/- amount:`);
    if (!raw) return;
    const amount = Number(raw);
    if (!Number.isInteger(amount) || amount === 0) {
      toast.error("Enter a non-zero whole number.");
      return;
    }

    const res = await fetch(`/api/admin/users/${user.id}/credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, note: "admin-adjustment" }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data?.error?.message ?? "Could not adjust credits."); return; }
    setUsers((prev) => prev?.map((u) => (u.id === user.id ? { ...u, creditBalance: data.balance } : u)) ?? null);
  }

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold dark:text-neutral-100">Users</h1>

      <div className="mb-4 flex gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load(q)}
          placeholder="Search name or email…"
        />
        <Button variant="outline" onClick={() => load(q)}>
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {users === null ? (
        <div className="flex justify-center py-10 text-neutral-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="card-shell overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-neutral-100 text-xs text-neutral-400 dark:border-neutral-800">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Credits</th>
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Terms accepted</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium dark:text-neutral-100">{u.name}</p>
                    <p className="text-xs text-neutral-400">{u.email}</p>
                  </td>
                  <td className="px-3 py-2 dark:text-neutral-300">{u.role}</td>
                  <td className="px-3 py-2 dark:text-neutral-300">{u.creditBalance}</td>
                  <td className="px-3 py-2 dark:text-neutral-300">{u.subscription?.plan ?? "FREE"}</td>
                  <td className="px-3 py-2">
                    {u.isBanned && <span className="text-xs font-semibold text-red-600">Banned</span>}
                    {!u.isBanned && u.isVerified && <span className="text-xs font-semibold text-mint-deep">Verified</span>}
                    {!u.isBanned && !u.isVerified && <span className="text-xs text-neutral-400">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs dark:text-neutral-300">
                    {u.consentAcceptedAt ? (
                      <>
                        {new Date(u.consentAcceptedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        <p className="font-mono text-[11px] text-neutral-400">v{u.consentVersion}</p>
                      </>
                    ) : (
                      <span className="text-neutral-400">Not yet</span>
                    )}
                  </td>
                  <td className="space-x-2 whitespace-nowrap px-3 py-2">
                    <button onClick={() => toggleBan(u)} className="text-xs font-medium text-red-600 hover:underline">
                      {u.isBanned ? "Unban" : "Ban"}
                    </button>
                    <button onClick={() => toggleVerified(u)} className="text-xs font-medium text-brand-600 hover:underline">
                      {u.isVerified ? "Unverify" : "Verify"}
                    </button>
                    <button onClick={() => togglePro(u)} className="text-xs font-medium text-priority-600 hover:underline">
                      {u.subscription?.plan === "PRO" ? "Revoke PRO" : "Grant PRO"}
                    </button>
                    <button onClick={() => adjustCredits(u)} className="text-xs font-medium text-neutral-600 hover:underline dark:text-neutral-300">
                      Credits
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
