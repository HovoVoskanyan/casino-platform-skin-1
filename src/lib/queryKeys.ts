/**
 * The ONLY place query keys are defined (house rule 1). `session.all` is the prefix for everything that depends on
 * who is signed in, so signing out drops it all at once.
 */
export const queryKeys = {
  session: {
    all: ["session"] as const,
    state: () => [...queryKeys.session.all, "state"] as const,
    sessions: () => [...queryKeys.session.all, "sessions"] as const,
    /** The player's ♥ list — under the session prefix, so signing out drops it with everything else that is theirs. */
    favourites: () => [...queryKeys.session.all, "favourites"] as const,
    /** P3-24 — My Account: identity's view of the account (contacts, pending changes, sign-in methods, consent). */
    account: () => [...queryKeys.session.all, "account"] as const,
    /** P3-24 — My Account → Profile on core (display name, city, player number). */
    profile: () => [...queryKeys.session.all, "profile"] as const,
  },
  /**
   * P3-27: the guest's lobby reads. Every key carries the UI language, because core answers each read in the
   * language the request asks for — switching language must not serve the other language's cached copy.
   */
  lobby: {
    all: ["lobby"] as const,
    games: (lang: string, filters: object) => [...queryKeys.lobby.all, lang, "games", filters] as const,
    game: (lang: string, id: string) => [...queryKeys.lobby.all, lang, "game", id] as const,
    categories: (lang: string) => [...queryKeys.lobby.all, lang, "categories"] as const,
    providers: () => [...queryKeys.lobby.all, "providers"] as const,
    banners: (lang: string, placement: string) => [...queryKeys.lobby.all, lang, "banners", placement] as const,
    promotions: (lang: string) => [...queryKeys.lobby.all, lang, "promotions"] as const,
    promotion: (lang: string, id: string) => [...queryKeys.lobby.all, lang, "promotion", id] as const,
  },
} as const;
