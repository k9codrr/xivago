"use client";

import * as React from "react";
import { haptic, type HapticType } from "@/lib/haptics";

export type { HapticType };

/**
 * Hook returning a stable trigger function.
 *
 *   const trigger = useHaptic();
 *   trigger("success");
 *
 * Or bound to a default type:
 *
 *   const tap = useHaptic("heavy");
 *   tap();
 */
export function useHaptic(defaultType: HapticType = "heavy") {
  return React.useCallback(
    (type: HapticType = defaultType) => {
      void haptic(type);
    },
    [defaultType],
  );
}

interface HapticProps {
  /** Feedback strength / kind. Defaults to "light". */
  type?: HapticType;
  /** Which event fires the haptic. Defaults to "onClick". */
  on?: "onClick" | "onPointerDown";
  /** Skip the haptic (e.g. while disabled). */
  disabled?: boolean;
  /** A single element (button, Link, motion.button, …). Its own handler still runs. */
  children: React.ReactElement<Record<string, unknown>>;
}

/**
 * Wrap any pressable element to give it haptic feedback without
 * changing its markup:
 *
 *   <Haptic type="heavy">
 *     <Link href="/chats">Chats</Link>
 *   </Haptic>
 */
export function Haptic({ type = "heavy", on = "onClick", disabled, children }: HapticProps) {
  const child = React.Children.only(children);
  const original = child.props[on] as ((e: unknown) => void) | undefined;
  const childDisabled = Boolean(child.props.disabled);

  return React.cloneElement(child, {
    [on]: (e: unknown) => {
      if (!disabled && !childDisabled) void haptic(type);
      original?.(e);
    },
  });
}
