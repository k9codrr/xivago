"use client";

import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Flag, Trash2 } from "lucide-react";

interface ReportMenuProps {
  canDelete: boolean;
  onDelete: () => void;
  onReport: (reason: string) => Promise<void>;
}

const REPORT_REASONS = ["Spam", "Nudity or sexual content", "Hate speech or harassment", "Something else"];

export function ReportMenu({ canDelete, onDelete, onReport }: ReportMenuProps) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setReporting(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function submitReport(reason: string) {
    await onReport(reason);
    toast.success("Thanks — our team will take a look.");
    setOpen(false);
    setReporting(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className=" !h-fit !w-fit text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        aria-label="More options"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
          {!reporting ? (
            <>
              <button
                type="button"
                onClick={() => setReporting(true)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
              >
                <Flag className="h-3.5 w-3.5" /> Report
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete();
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              )}
            </>
          ) : (
            REPORT_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                onClick={() => submitReport(reason)}
                className="block w-full px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-700"
              >
                {reason}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
