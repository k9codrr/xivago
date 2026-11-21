"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";

interface AdminRole {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  sortOrder: number;
  _count: { demands: number };
}

const INPUT = "w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900";
const BTN = "rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50";
const BTN_QUIET = "rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800";

async function send(url: string, method: string, body?: unknown): Promise<boolean> {
  const res = await fetch(url, {
    method,
    ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  if (res.ok) return true;
  const data = await res.json().catch(() => null);
  toast.error(data?.error?.message ?? "Something went wrong.");
  return false;
}

function RoleRow({ role, onChanged }: { role: AdminRole; onChanged: () => Promise<void> }) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");
  const [sortOrder, setSortOrder] = useState(String(role.sortOrder));
  const [busy, setBusy] = useState(false);

  const dirty =
    name !== role.name || description !== (role.description ?? "") || sortOrder !== String(role.sortOrder);

  async function run(action: () => Promise<boolean>, success: string) {
    setBusy(true);
    try {
      if (await action()) {
        toast.success(success);
        await onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  const url = `/api/admin/requirement-roles/${role.id}`;

  return (
    <li className="space-y-2 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="grid grid-cols-[1fr_5rem] gap-2">
        <input className={INPUT} aria-label="Role name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} />
        <input
          className={INPUT}
          aria-label="Display order"
          type="number"
          min={0}
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        />
      </div>
      <input
        className={INPUT}
        aria-label="Description"
        maxLength={120}
        placeholder="Short description shown when posting (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-neutral-500">
          {role.isActive ? "Shown when posting" : "Hidden from posting"} · {role._count.demands} post(s)
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={BTN}
            disabled={busy || !dirty}
            onClick={() =>
              run(() => send(url, "PATCH", { name, description: description.trim() || null, sortOrder: Number(sortOrder) }), "Role saved.")
            }
          >
            Save
          </button>
          <button
            type="button"
            className={BTN_QUIET}
            disabled={busy}
            onClick={() =>
              run(() => send(url, "PATCH", { isActive: !role.isActive }), role.isActive ? "Role hidden." : "Role shown.")
            }
          >
            {role.isActive ? "Hide" : "Show"}
          </button>
          <button
            type="button"
            aria-label={`Delete ${role.name}`}
            className={BTN_QUIET}
            disabled={busy || role._count.demands > 0}
            title={role._count.demands > 0 ? "In use by posts. Hide it instead." : undefined}
            onClick={() => {
              if (window.confirm(`Delete the "${role.name}" role?`)) void run(() => send(url, "DELETE"), "Role deleted.");
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<AdminRole[] | null>(null);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/requirement-roles");
    if (!res.ok) {
      toast.error("Could not load roles.");
      setRoles((prev) => prev ?? []);
      return;
    }
    setRoles((await res.json()).roles);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function addRole(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const created = await send("/api/admin/requirement-roles", "POST", {
        name: newName,
        description: newDescription.trim() || null,
      });
      if (created) {
        toast.success("Role added.");
        setNewName("");
        setNewDescription("");
        await load();
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">Request roles</h1>
        <p className="mt-1 text-sm text-neutral-500">
          The roles people choose from when posting a request. Lower order numbers show first.
        </p>
      </div>

      <form onSubmit={addRole} className="space-y-2 rounded-xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm font-semibold">Add a role</p>
        <input
          className={INPUT}
          aria-label="New role name"
          placeholder="Role name, e.g. Broker"
          maxLength={40}
          required
          minLength={2}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          className={INPUT}
          aria-label="New role description"
          placeholder="Short description (optional)"
          maxLength={120}
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
        />
        <button type="submit" className={BTN} disabled={adding}>
          {adding ? "Adding…" : "Add role"}
        </button>
      </form>

      {roles === null ? (
        <Loader2 className="h-5 w-5 animate-spin text-neutral-400" aria-label="Loading roles" />
      ) : roles.length === 0 ? (
        <p className="text-sm text-neutral-500">No roles yet. Add the first one above.</p>
      ) : (
        <ul className="space-y-2">
          {roles.map((role) => (
            // Remount after a save so the inputs pick up the stored values.
            <RoleRow key={`${role.id}:${role.name}:${role.description}:${role.sortOrder}`} role={role} onChanged={load} />
          ))}
        </ul>
      )}
    </div>
  );
}
