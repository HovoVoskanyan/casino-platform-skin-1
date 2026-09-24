import { useSyncExternalStore } from "react";

/**
 * The ONE shared auth dialog (design: Registration opens over whichever page asked for it and remembers the
 * destination). The mode rides in the URL hash — #signin / #register / #reset work on any page and survive a reload —
 * and the return target lives here in memory (the design's `chocho:returnTo`), never in the URL.
 */
export type AuthMode = "signin" | "register" | "reset";

interface AuthDialogState {
  mode: AuthMode | null;
  returnTo: string | null;
}

const HASHES: Record<string, AuthMode> = { "#signin": "signin", "#register": "register", "#reset": "reset" };

let state: AuthDialogState = { mode: null, returnTo: null };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function readHash(): AuthMode | null {
  if (typeof window === "undefined") return null;
  return HASHES[window.location.hash.toLowerCase()] ?? null;
}

if (typeof window !== "undefined") {
  state = { mode: readHash(), returnTo: null };
  window.addEventListener("hashchange", () => {
    const mode = readHash();
    if (mode !== state.mode) {
      state = { ...state, mode };
      emit();
    }
  });
}

export const authDialog = {
  open(mode: AuthMode, returnTo?: string | null) {
    state = { mode, returnTo: returnTo ?? state.returnTo };
    if (typeof window !== "undefined" && window.location.hash.toLowerCase() !== `#${mode}`) {
      history.replaceState(history.state, "", `${window.location.pathname}${window.location.search}#${mode}`);
    }
    emit();
  },
  switchTo(mode: AuthMode) {
    authDialog.open(mode);
  },
  /** Closes the dialog; `keepReturn` when the caller is about to navigate to the remembered destination. */
  close(keepReturn = false) {
    state = { mode: null, returnTo: keepReturn ? state.returnTo : null };
    if (typeof window !== "undefined" && readHash()) {
      history.replaceState(history.state, "", `${window.location.pathname}${window.location.search}`);
    }
    emit();
  },
  consumeReturnTo(): string | null {
    const t = state.returnTo;
    state = { ...state, returnTo: null };
    return t;
  },
  get(): AuthDialogState {
    return state;
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useAuthDialog(): AuthDialogState {
  return useSyncExternalStore(authDialog.subscribe, authDialog.get, () => ({ mode: null, returnTo: null }));
}
