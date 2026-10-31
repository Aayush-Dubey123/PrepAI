"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function NavigationProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<"idle" | "running" | "completing">("idle");
  const [progress, setProgress] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMountRef = useRef(true);

  // When pathname or searchParams change, mark navigation as completing
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    if (state === "running") {
      if (timerRef.current) clearInterval(timerRef.current);
      setState("completing");
      setProgress(100);

      const fadeTimer = setTimeout(() => {
        setState("idle");
        setProgress(0);
      }, 250);

      return () => clearTimeout(fadeTimer);
    }
  }, [pathname, searchParams, state]);

  // Click interceptor for all internal <a> links
  useEffect(() => {
    const startProgress = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);

      setState("running");
      setProgress(20);

      // Increment progress progressively
      timerRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev < 45) return prev + 12;
          if (prev < 70) return prev + 6;
          if (prev < 88) return prev + 2;
          return prev;
        });
      }, 100);

      // Safety timeout: auto-dismiss after 6s in case navigation is cancelled or errors
      safetyTimeoutRef.current = setTimeout(() => {
        setState("idle");
        setProgress(0);
        if (timerRef.current) clearInterval(timerRef.current);
      }, 6000);
    };

    const handleDocumentClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement)?.closest?.("a");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Ignore external, new tab, download, modified clicks (ctrl/cmd/shift/alt)
      if (
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey ||
        e.button !== 0 ||
        e.defaultPrevented
      ) {
        return;
      }

      // Ignore anchor fragments or protocol links
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
        return;
      }

      const currentPathAndSearch = window.location.pathname + window.location.search;
      let targetPathAndSearch = href;

      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return; // External host
        targetPathAndSearch = url.pathname + url.search;
      } catch {
        // Fallback relative resolution
      }

      // If navigating to the exact same URL, skip
      if (targetPathAndSearch === currentPathAndSearch) return;

      startProgress();
    };

    const handleCustomStart = () => startProgress();
    const handleCustomComplete = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      setState("completing");
      setProgress(100);
      setTimeout(() => {
        setState("idle");
        setProgress(0);
      }, 250);
    };

    window.addEventListener("click", handleDocumentClick, true);
    window.addEventListener("navigation-start", handleCustomStart);
    window.addEventListener("navigation-complete", handleCustomComplete);

    return () => {
      window.removeEventListener("click", handleDocumentClick, true);
      window.removeEventListener("navigation-start", handleCustomStart);
      window.removeEventListener("navigation-complete", handleCustomComplete);
      if (timerRef.current) clearInterval(timerRef.current);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    };
  }, []);

  if (state === "idle" && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none transition-opacity duration-200"
      style={{
        opacity: state === "completing" ? 0 : 1,
      }}
    >
      <div
        className="h-[2.5px] bg-gradient-to-r from-[#4f46e5] via-[#6366f1] to-[#8b5cf6] shadow-[0_0_10px_rgba(99,102,241,0.6)] transition-all ease-out"
        style={{
          width: `${progress}%`,
          transitionDuration: state === "completing" ? "160ms" : "180ms",
        }}
      />
    </div>
  );
}

export function NavigationProgressBar() {
  return (
    <Suspense fallback={null}>
      <NavigationProgressBarInner />
    </Suspense>
  );
}

