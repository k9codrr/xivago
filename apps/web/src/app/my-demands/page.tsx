import { redirect } from "next/navigation";

/** Old link target -- "My posts" lives on /explore/sell now. */
export default function MyDemandsRedirect() {
  redirect("/explore/sell");
}
