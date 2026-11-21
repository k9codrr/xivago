import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getOptionalUser } from "@/lib/guards";
import { AdminShell } from "./admin-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getOptionalUser();
  if (!user) redirect("/login?callbackUrl=/admin");
  if (!user.isAdmin) redirect("/");

  // Persisted by the sidebar itself, so the collapsed state survives reloads
  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  return <AdminShell defaultOpen={defaultOpen}>{children}</AdminShell>;
}
