import { useMemo } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTranslation } from "react-i18next";
import type { Launch } from "./launch";

/**
 * The provider's own game URL, when the fragment is nothing but a frame onto it (Fundist's usual AuthHTML shape).
 * Parsed with DOMParser, which never runs scripts. null → the fragment is something else (script, form) and stays
 * in the opaque sandbox.
 */
export function providerFrameUrl(html: string): string | null {
  if (typeof DOMParser === "undefined") return null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const frames = doc.querySelectorAll("iframe[src]");
  if (frames.length !== 1 || doc.querySelectorAll("script, form, object, embed").length > 0) return null;
  try {
    const url = new URL(frames[0]!.getAttribute("src")!);
    return url.protocol === "https:" && url.origin !== window.location.origin ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * P3-28 — the game container the design does not have (P3-22 gap 2). Core answers the provider's HTML fragment.
 * - A fragment that is a single frame onto the provider's https URL (the usual shape) → we frame THAT URL. It keeps
 *   its own origin (cross-origin to the skin, so `allow-same-origin` grants it nothing of ours), which the game needs
 *   for its own cookies and storage — a sandbox without same-origin would break those for every nested frame
 *   (review S1).
 * - Anything else (a script, an auto-posted form) runs in a `srcdoc` frame with an OPAQUE origin: it can never read
 *   the skin's cookies, storage or DOM. The real Fundist fragment must be checked in the P6-02 sandbox.
 * - Never `allow-top-navigation`; and no `allow-popups-to-escape-sandbox` — an escaped popup keeps its opener and
 *   could navigate the casino tab (review S2). Popups (rules, help) still open, sandboxed like their opener.
 * Closing returns to the game page; the header balance keeps updating underneath from the hub. Radix gives the
 * focus trap, Escape and focus return.
 */
export function GameContainer({ launch, gameName, onClose }: { launch: Launch; gameName: string; onClose: () => void }) {
  const { t } = useTranslation();
  const direct = useMemo(() => providerFrameUrl(launch.html), [launch.html]);
  const label = t("game.container", { name: gameName });

  return (
    <DialogPrimitive.Root open onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content aria-describedby={undefined} className="fixed inset-0 z-[250] flex flex-col bg-[#0b0414] outline-none">
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          <div className="flex h-12 flex-none items-center justify-between gap-3 border-b border-[rgba(167,139,250,.16)] bg-[#150726] px-3">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[14px] font-extrabold text-cc-ink">{gameName}</span>
              <span className="flex-none rounded-full border border-cc-line-strong px-2 py-[2px] text-[10.5px] font-extrabold tracking-[1px] text-cc-control uppercase">
                {t(launch.mode === "Demo" ? "game.modeDemo" : launch.funding === "bonus" ? "game.modeBonus" : "game.modeReal")}
              </span>
            </span>
            <DialogPrimitive.Close aria-label={t("game.closeGame")}
              className="flex h-9 flex-none items-center gap-2 rounded-cc-md border border-cc-line-strong bg-white/[.06] px-3 text-[13px] font-bold text-[#cbb6e6]">
              ✕ <span aria-hidden className="hidden sm:inline">{t("game.closeGame")}</span>
            </DialogPrimitive.Close>
          </div>
          {direct ? (
            <iframe
              key={launch.launchId}
              title={gameName}
              src={direct}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              allow="autoplay; fullscreen"
              allowFullScreen
              referrerPolicy="no-referrer"
              className="min-h-0 w-full flex-1 border-0 bg-black"
              data-testid="game-frame"
            />
          ) : (
            <iframe
              key={launch.launchId}
              title={gameName}
              srcDoc={launch.html}
              sandbox="allow-scripts allow-forms allow-popups"
              allow="autoplay; fullscreen"
              allowFullScreen
              className="min-h-0 w-full flex-1 border-0 bg-black"
              data-testid="game-frame"
            />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
