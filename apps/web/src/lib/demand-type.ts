interface TypedDemand {
  postType?: "PROMOTE" | "REQUIREMENT" | null;
  requirementRole?: { name: string } | null;
}

/** The short label that says what a post is: "Offer" or "Request". */
export function demandTypeLabel(demand: TypedDemand): string | null {
  if (demand.postType === "PROMOTE") return "Offer";
  if (demand.postType !== "REQUIREMENT") return null;
  return "Request";
}
