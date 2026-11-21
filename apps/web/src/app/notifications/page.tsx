import { redirect } from "next/navigation";

/** Old bell link target -- the inbox lives on /activity now. */
export default function NotificationsRedirect() {
  redirect("/activity");
}
