import { redirect } from "next/navigation";

/** Old link target -- "My responses" (orders) lives on /explore/buy now. */
export default function MySlotsRedirect() {
  redirect("/explore/buy");
}
