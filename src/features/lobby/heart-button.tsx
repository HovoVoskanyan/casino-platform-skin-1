import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { toApiError } from "@/api/problem";
import { authDialog } from "@/features/auth/auth-dialog-state";
import { useSession } from "@/features/auth/session";
import { cn } from "@/lib/utils";
import { useFavouriteIds, useToggleFavourite, type GameCard } from "./api";

/**
 * The ♥ on a game card (design: 30px glass circle, rose when on). A guest's tap opens sign-in and comes back to this
 * page; a player's tap flips it at once (optimistic) and core confirms — or it flips back and says why. It sits over
 * the card's link (a sibling, never inside it).
 */
export function HeartButton({ game, className }: { game: GameCard; className?: string }) {
  const { t } = useTranslation();
  const { signedIn } = useSession();
  const ids = useFavouriteIds();
  const toggle = useToggleFavourite();
  const on = ids.has(game.id);

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? t("lobby.unfavourite", { name: game.name }) : t("lobby.favourite", { name: game.name })}
      onClick={() => {
        if (!signedIn) {
          authDialog.open("signin", window.location.pathname + window.location.search);
          return;
        }
        toggle.mutate({ game, on: !on }, { onError: (err) => toast.error(t(toApiError(err).errorCode === "CONFLICT" ? "lobby.favouritesFull" : "lobby.favouriteFailed")) });
      }}
      className={cn("flex h-[30px] w-[30px] items-center justify-center rounded-full border bg-[rgba(9,3,16,.55)] backdrop-blur-sm transition-colors", on ? "border-[rgba(255,93,125,.65)]" : "border-white/25 hover:border-white/50", className)}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden fill={on ? "var(--cc-rose)" : "none"} stroke={on ? "var(--cc-rose)" : "rgba(255,255,255,.85)"} strokeWidth={on ? 1.4 : 1.9} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20s-7-4.4-7-9.2A4 4 0 0112 8.6a4 4 0 017 2.2C19 15.6 12 20 12 20z" />
      </svg>
    </button>
  );
}
