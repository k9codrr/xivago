"use client"

import * as React from "react"
import { cn } from "cn"
import { Switch as SwitchPrimitive } from "radix-ui"

/**
 * iOS-style switch (Radix primitive).
 *
 * Radix exposes state as `data-state="checked" | "unchecked"` — NOT
 * `data-checked` — so all state styling keys off `data-[state=…]`.
 * Geometry is computed so the thumb sits perfectly centred with an equal
 * 2px inset on every side in both positions.
 *
 *   default: track 51×31, thumb 27 → travel 20px
 *   sm:      track 40×24, thumb 20 → travel 16px
 */
function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full p-[2px] outline-none",
        "transition-colors duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
        // track sizes
        "data-[size=default]:h-[31px] data-[size=default]:w-[51px]",
        "data-[size=sm]:h-6 data-[size=sm]:w-10",
        // track colours — Apple system green / systemFill
        "data-[state=checked]:bg-[#34C759]",
        "data-[state=unchecked]:bg-[#787880]/20 dark:data-[state=unchecked]:bg-[#787880]/35",
        // focus / invalid / disabled
        "focus-visible:ring-4 focus-visible:ring-[#34C759]/30",
        "aria-invalid:ring-4 aria-invalid:ring-destructive/20",
        "disabled:cursor-not-allowed disabled:opacity-40",
        // generous hit area without changing layout
        "after:absolute after:-inset-x-2 after:-inset-y-2",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block rounded-full bg-white",
          "shadow-[0_3px_8px_rgba(0,0,0,0.15),0_3px_1px_rgba(0,0,0,0.06),0_0_0_0.5px_rgba(0,0,0,0.04)]",
          "transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          "group-data-[size=default]/switch:size-[27px] group-data-[size=sm]/switch:size-5",
          "data-[state=unchecked]:translate-x-0",
          "group-data-[size=default]/switch:data-[state=checked]:translate-x-5",
          "group-data-[size=sm]/switch:data-[state=checked]:translate-x-4"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
