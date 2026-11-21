import { Zap } from "lucide-react";

export function PriorityBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-priority-400/15 px-2 py-0.5 text-xs font-bold text-priority-600">
      <Zap className="h-3 w-3 fill-priority-500 text-priority-500" />
      Featured
    </span>
  );
}
