"use client";

import { useEffect, useState } from "react";

/**
 * Pins a full-screen page (the chat) to the part of the screen the user can
 * actually see. Mobile browsers handle the on-screen keyboard differently --
 * iOS scrolls the whole page up and often leaves it there after the keyboard
 * closes, which shoved the message box out of place. Following
 * `visualViewport` and locking page scroll keeps the composer glued to the
 * keyboard while it's open and back at the bottom the moment it closes.
 */
export function useVisualViewport() {
  const [box, setBox] = useState<{ height: number; top: number } | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    const html = document.documentElement.style;
    const body = document.body.style;
    const prev = { htmlOverflow: html.overflow, bodyOverflow: body.overflow, overscroll: html.overscrollBehavior };
    html.overflow = "hidden";
    body.overflow = "hidden";
    html.overscrollBehavior = "none";

    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const height = vv ? vv.height : window.innerHeight;
        const top = vv ? vv.offsetTop : 0;
        setBox((b) => (b && b.height === height && b.top === top ? b : { height, top }));
        // Keyboard closed: undo any page scroll the browser did to reveal the field.
        if (!vv || window.innerHeight - vv.height < 80) {
          if (window.scrollY !== 0) window.scrollTo(0, 0);
        }
      });
    };
    const onFocusOut = () => setTimeout(update, 60);

    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      document.removeEventListener("focusout", onFocusOut);
      html.overflow = prev.htmlOverflow;
      body.overflow = prev.bodyOverflow;
      html.overscrollBehavior = prev.overscroll;
    };
  }, []);

  return box;
}
