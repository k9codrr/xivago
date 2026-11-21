"use client"

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { Slot } from "@radix-ui/react-slot"
import { AnimatePresence, motion } from "motion/react"
import useMeasure from "react-use-measure"
import { Drawer } from "vaul"

import { cn } from "@/lib/utils"

/** Apple-style liquid glass sheet: tinted, blurred, hairline border, lit top edge. */
const LIQUID_GLASS_SHEET =
  "rounded-[2rem] border border-white/[0.14] bg-neutral-900/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_-20px_80px_rgba(0,0,0,0.6)] backdrop-blur-2xl backdrop-saturate-[1.8]"

// ============================================================================
// Types
// ============================================================================

type ViewComponent = React.ComponentType<Record<string, unknown>>

interface ViewsRegistry {
  [viewName: string]: ViewComponent
}

// ============================================================================
// Context
// ============================================================================

interface FamilyDrawerContextValue {
  isOpen: boolean
  view: string
  setView: (view: string) => void
  opacityDuration: number
  elementRef: ReturnType<typeof useMeasure>[0]
  bounds: ReturnType<typeof useMeasure>[1]
  views: ViewsRegistry | undefined
}

const FamilyDrawerContext = createContext<FamilyDrawerContextValue | undefined>(
  undefined
)

function useFamilyDrawer() {
  const context = useContext(FamilyDrawerContext)
  if (!context) {
    throw new Error(
      "FamilyDrawer components must be used within FamilyDrawerRoot"
    )
  }
  return context
}

// ============================================================================
// Root Component
// ============================================================================

interface FamilyDrawerRootProps {
  children: ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  defaultView?: string
  onViewChange?: (view: string) => void
  views?: ViewsRegistry
  /** Only `FamilyDrawerHandle` starts a drag, so gestures in the body can't dismiss. */
  handleOnly?: boolean
}

function FamilyDrawerRoot({
  children,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  defaultView = "default",
  onViewChange,
  views: customViews,
  handleOnly,
}: FamilyDrawerRootProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const [view, setView] = useState(defaultView)
  const [elementRef, bounds] = useMeasure()
  const previousHeightRef = useRef<number>(0)

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen
  const setIsOpen = onOpenChange || setInternalOpen

  // Overscroll on the root drives pull-to-refresh, which would reload the page
  // from under an open drawer. The body's overscroll setting doesn't cover it.
  useEffect(() => {
    if (!isOpen) return
    document.documentElement.style.overscrollBehaviorY = "none"
    return () => {
      document.documentElement.style.overscrollBehaviorY = ""
    }
  }, [isOpen])

  const opacityDuration = useMemo(() => {
    const currentHeight = bounds.height
    const previousHeight = previousHeightRef.current

    const MIN_DURATION = 0.15
    const MAX_DURATION = 0.27

    if (!previousHeightRef.current) {
      previousHeightRef.current = currentHeight
      return MIN_DURATION
    }

    const heightDifference = Math.abs(currentHeight - previousHeight)
    previousHeightRef.current = currentHeight

    const duration = Math.min(
      Math.max(heightDifference / 500, MIN_DURATION),
      MAX_DURATION
    )

    return duration
  }, [bounds.height])

  const handleViewChange = (newView: string) => {
    setView(newView)
    onViewChange?.(newView)
  }

  // Use custom views if provided, otherwise pass undefined
  const views =
    customViews && Object.keys(customViews).length > 0 ? customViews : undefined

  const contextValue: FamilyDrawerContextValue = {
    isOpen,
    view,
    setView: handleViewChange,
    opacityDuration,
    elementRef,
    bounds,
    views,
  }

  return (
    <FamilyDrawerContext.Provider value={contextValue}>
      <Drawer.Root open={isOpen} onOpenChange={setIsOpen} handleOnly={handleOnly}>
        {children}
      </Drawer.Root>
    </FamilyDrawerContext.Provider>
  )
}

// ============================================================================
// Trigger Component
// ============================================================================

interface FamilyDrawerTriggerProps {
  children: ReactNode
  asChild?: boolean
  className?: string
}

function FamilyDrawerTrigger({
  children,
  asChild = false,
  className,
}: FamilyDrawerTriggerProps) {
  if (asChild) {
    return (
      <Drawer.Trigger asChild>
        <Slot>{children}</Slot>
      </Drawer.Trigger>
    )
  }

  return (
    <Drawer.Trigger asChild>
      <button
        className={cn(
          "bg-background text-foreground hover:bg-accent focus-visible:shadow-focus-ring-button fixed top-1/2 left-1/2 h-[44px] -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border px-4 py-2 font-medium antialiased transition-colors md:font-medium",
          className
        )}
        type="button"
      >
        {children}
      </button>
    </Drawer.Trigger>
  )
}

// ============================================================================
// Portal Component
// ============================================================================

function FamilyDrawerPortal({ children }: { children: ReactNode }) {
  return <Drawer.Portal>{children}</Drawer.Portal>
}

// ============================================================================
// Overlay Component
// ============================================================================

interface FamilyDrawerOverlayProps {
  className?: string
  onClick?: () => void
}

function FamilyDrawerOverlay({ className, onClick }: FamilyDrawerOverlayProps) {
  const { setView } = useFamilyDrawer()

  return (
    <Drawer.Overlay
      className={cn("fixed inset-0 z-50 bg-black/30", className)}
      onClick={onClick || (() => setView("default"))}
    />
  )
}

// ============================================================================
// Content Component
// ============================================================================

interface FamilyDrawerContentProps {
  children: ReactNode
  className?: string
  asChild?: boolean
  /** Keep the drawer open when the user taps outside it. */
  disableOutsideDismiss?: boolean
  /** For tall sheets with inputs: fit the sheet into the space above the on-screen keyboard. */
  keyboardAware?: boolean
}

const preventDismiss = (e: Event) => e.preventDefault()

/** Gap between a keyboard-fitted sheet and the screen edge / keyboard, in px. */
const KEYBOARD_FIT_GAP = 8
/** Viewport shrink (px) that means a keyboard, not just browser chrome moving. */
const KEYBOARD_MIN_HEIGHT = 120

/** The bottom offset and height that fit a sheet above the keyboard, or null when it's closed. */
export function useKeyboardFit(enabled: boolean) {
  const [fit, setFit] = useState<{ bottom: number; height: number } | null>(null)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!enabled || !viewport) return

    const update = () => {
      if (window.innerHeight - viewport.height < KEYBOARD_MIN_HEIGHT) {
        setFit(null)
        return
      }
      const keyboard = window.innerHeight - (viewport.offsetTop + viewport.height)
      setFit({
        bottom: Math.max(keyboard, 0) + KEYBOARD_FIT_GAP,
        height: viewport.height - KEYBOARD_FIT_GAP * 2,
      })
    }

    update()
    viewport.addEventListener("resize", update)
    viewport.addEventListener("scroll", update)
    return () => {
      viewport.removeEventListener("resize", update)
      viewport.removeEventListener("scroll", update)
      setFit(null)
    }
  }, [enabled])

  // Keep the field being typed in on screen, including when moving between fields.
  const keyboardOpen = fit !== null
  useEffect(() => {
    if (!keyboardOpen) return
    const reveal = () => {
      requestAnimationFrame(() => {
        const field = document.activeElement
        const sheet = field?.closest("[data-vaul-drawer],[data-app-sheet]")
        if (field?.matches("input, textarea") && sheet) {
          field.scrollIntoView({ block: "center" })
          // Only the list inside should scroll: vaul's ::after makes the sheet itself scrollable too.
          sheet.scrollTop = 0
        }
      })
    }
    reveal()
    document.addEventListener("focusin", reveal)
    return () => document.removeEventListener("focusin", reveal)
  }, [keyboardOpen, fit?.height])

  return fit
}

function FamilyDrawerContent({
  children,
  className,
  asChild = false,
  disableOutsideDismiss = false,
  keyboardAware = false,
}: FamilyDrawerContentProps) {
  const { bounds, isOpen } = useFamilyDrawer()
  const fit = useKeyboardFit(keyboardAware && isOpen)

  // !important on purpose: vaul writes its own inline bottom/height when the
  // keyboard opens, and those push a tall sheet off the top of the screen.
  const keyboardClasses = !keyboardAware
    ? undefined
    : fit
      ? "!bottom-[var(--keyboard-fit-bottom)] !mb-0 !h-[var(--keyboard-fit-height)] !min-h-[var(--keyboard-fit-height)] !max-h-[var(--keyboard-fit-height)] [&_[data-vaul-handle]]:pointer-events-none"
      : "!bottom-4"
  const keyboardStyle = fit
    ? ({
        "--keyboard-fit-bottom": `${fit.bottom}px`,
        "--keyboard-fit-height": `${fit.height}px`,
      } as React.CSSProperties)
    : undefined

  const content = (
    <motion.div
      animate={{
        height: bounds.height,
        transition: {
          duration: 0.27,
          ease: [0.25, 1, 0.5, 1],
        },
      }}
   onClick={(e) => e.stopPropagation()}>
      {children}
    </motion.div>
  )

  if (asChild) {
    return (
      <Drawer.Content
        asChild
        className={cn(
          "bg-background fixed inset-x-4 bottom-4 z-50 mx-auto max-w-[361px] overflow-hidden rounded-[36px] outline-none md:mx-auto md:w-full",
          className
        )}
     onClick={(e) => e.stopPropagation()} >
        <Slot>{content}</Slot>
      </Drawer.Content>
    )
  }

  return (
    <Drawer.Content
      asChild
      className={cn(
        "bg-background fixed inset-x-4 bottom-4 z-50 mx-auto max-w-[361px] overflow-hidden rounded-[36px] outline-none md:mx-auto md:w-full",
        className,
        keyboardClasses
      )}
      style={keyboardStyle}
      onInteractOutside={disableOutsideDismiss ? preventDismiss : undefined}
    >
      {content}
    </Drawer.Content>
  )
}

// ============================================================================
// Handle Component
// ============================================================================

function FamilyDrawerHandle({ className }: { className?: string }) {
  return <Drawer.Handle className={className} />
}

// ============================================================================
// Animated Wrapper Component
// ============================================================================

interface FamilyDrawerAnimatedWrapperProps {
  children: ReactNode
  className?: string
}

function FamilyDrawerAnimatedWrapper({
  children,
  className,
}: FamilyDrawerAnimatedWrapperProps) {
  const { elementRef } = useFamilyDrawer()

  return (
    <div
      ref={elementRef}
      className={cn("px-6 pt-2.5 pb-6 antialiased", className)}
    >
      {children}
    </div>
  )
}

// ============================================================================
// Animated Content Component
// ============================================================================

interface FamilyDrawerAnimatedContentProps {
  children: ReactNode
}

function FamilyDrawerAnimatedContent({
  children,
}: FamilyDrawerAnimatedContentProps) {
  const { view, opacityDuration } = useFamilyDrawer()

  return (
    <AnimatePresence initial={false} mode="popLayout" custom={view}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        key={view}
        transition={{
          duration: opacityDuration,
          ease: [0.26, 0.08, 0.25, 1],
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

// ============================================================================
// Close Component
// ============================================================================

interface FamilyDrawerCloseProps {
  children?: ReactNode
  asChild?: boolean
  className?: string
}

function FamilyDrawerClose({
  children,
  asChild = false,
  className,
}: FamilyDrawerCloseProps) {
  const defaultClose = (
    <button
      data-vaul-no-drag=""
      className={cn(
        "bg-muted text-muted-foreground focus-visible:shadow-focus-ring-button absolute top-7 right-8 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-transform focus:scale-95 active:scale-75",
        className
      )}
      type="button"
    >
      {children || <CloseIcon />}
    </button>
  )

  if (asChild) {
    return (
      <Drawer.Close asChild>
        <Slot>{defaultClose}</Slot>
      </Drawer.Close>
    )
  }

  return <Drawer.Close asChild>{defaultClose}</Drawer.Close>
}

// ============================================================================
// Helper Components
// ============================================================================

type FamilyDrawerTitleProps = React.ComponentProps<typeof Drawer.Title>

/**
 * Accessible title for the drawer. Every view must render one (directly or via
 * `FamilyDrawerHeader`) so screen readers can announce the dialog.
 */
function FamilyDrawerTitle({ className, ...props }: FamilyDrawerTitleProps) {
  return (
    <Drawer.Title
      data-slot="family-drawer-title"
      className={cn(
        "text-foreground text-[22px] font-semibold md:font-medium",
        className
      )}
      {...props}
    />
  )
}

type FamilyDrawerDescriptionProps = React.ComponentProps<
  typeof Drawer.Description
>

function FamilyDrawerDescription({
  className,
  ...props
}: FamilyDrawerDescriptionProps) {
  return (
    <Drawer.Description
      data-slot="family-drawer-description"
      className={cn(
        "text-muted-foreground text-[17px] leading-[24px] font-medium md:font-normal",
        className
      )}
      {...props}
    />
  )
}

interface FamilyDrawerHeaderProps {
  icon: ReactNode
  title: string
  description: string
  className?: string
}

function FamilyDrawerHeader({
  icon,
  title,
  description,
  className,
}: FamilyDrawerHeaderProps) {
  return (
    <header className={cn("mt-[21px]", className)}>
      {icon}
      <FamilyDrawerTitle className="mt-2.5">{title}</FamilyDrawerTitle>
      <FamilyDrawerDescription className="mt-3">
        {description}
      </FamilyDrawerDescription>
    </header>
  )
}

interface FamilyDrawerButtonProps {
  children: ReactNode
  onClick: () => void
  className?: string
  asChild?: boolean
}

function FamilyDrawerButton({
  children,
  onClick,
  className,
  asChild = false,
}: FamilyDrawerButtonProps) {
  const button = (
    <button
      data-vaul-no-drag=""
      className={cn(
        "bg-muted text-foreground focus-visible:shadow-focus-ring-button flex h-12 w-full cursor-pointer items-center gap-[15px] rounded-[16px] px-4 text-[17px] font-semibold transition-transform focus:scale-95 active:scale-95 md:font-medium",
        className
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  )

  if (asChild) {
    return <Slot>{button}</Slot>
  }

  return button
}

interface FamilyDrawerSecondaryButtonProps {
  children: ReactNode
  onClick: () => void
  className: string
  asChild?: boolean
}

function FamilyDrawerSecondaryButton({
  children,
  onClick,
  className,
  asChild = false,
}: FamilyDrawerSecondaryButtonProps) {
  const button = (
    <button
      data-vaul-no-drag=""
      type="button"
      className={cn(
        "focus-visible:shadow-focus-ring-button flex h-12 w-full cursor-pointer items-center justify-center gap-[15px] rounded-full text-center text-[19px] font-semibold transition-transform focus:scale-95 active:scale-95 md:font-medium",
        className
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )

  if (asChild) {
    return <Slot>{button}</Slot>
  }

  return button
}

// ============================================================================
// View Content Renderer
// ============================================================================

interface FamilyDrawerViewContentProps {
  views?: ViewsRegistry
}

function FamilyDrawerViewContent(
  {
    views: propViews,
  }: FamilyDrawerViewContentProps = {} as FamilyDrawerViewContentProps
) {
  const { view, views: contextViews } = useFamilyDrawer()

  // Use prop views first, then context views
  const views = propViews || contextViews

  if (!views) {
    throw new Error(
      "FamilyDrawerViewContent requires views to be provided via props or FamilyDrawerRoot"
    )
  }

  const ViewComponent = views[view]

  if (!ViewComponent) {
    // Fallback to default view if view not found
    const DefaultComponent = views.default
    return DefaultComponent ? <DefaultComponent /> : null
  }

  return <ViewComponent />
}

// ============================================================================
// Icons
// ============================================================================

function CloseIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Close Icon</title>
      <path
        d="M10.4854 1.99998L2.00007 10.4853"
        stroke="#999999"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.4854 10.4844L2.00007 1.99908"
        stroke="#999999"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// ============================================================================
// Exports
// ============================================================================

export {
  LIQUID_GLASS_SHEET,
  FamilyDrawerRoot,
  FamilyDrawerTrigger,
  FamilyDrawerPortal,
  FamilyDrawerOverlay,
  FamilyDrawerContent,
  FamilyDrawerHandle,
  FamilyDrawerAnimatedWrapper,
  FamilyDrawerAnimatedContent,
  FamilyDrawerClose,
  FamilyDrawerHeader,
  FamilyDrawerTitle,
  FamilyDrawerDescription,
  FamilyDrawerButton,
  FamilyDrawerSecondaryButton,
  FamilyDrawerViewContent,
  useFamilyDrawer,
  type ViewsRegistry,
  type ViewComponent,
}
