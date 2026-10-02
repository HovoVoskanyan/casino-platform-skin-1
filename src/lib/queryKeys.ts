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
    /** P3-28 — bonus's catalogue (what can be claimed) and the player's bonuses, for the balance panel's counts. */
    bonusCatalog: () => [...queryKeys.session.all, "bonus", "catalog"] as const,
    bonusActive: () => [...queryKeys.session.all, "bonus", "active"] as const,
    /** P3-29 — My bonuses: free rounds held, and the free-rounds campaigns a claim would accept now. */
    bonusFreeBets: () => [...queryKeys.session.all, "bonus", "freebets"] as const,
    bonusClaimableSpins: () => [...queryKeys.session.all, "bonus", "freebets-claimable"] as const,
    /** Everything bonus answers for this player — a claim or a grant refreshes it all. */
    bonusAll: () => [...queryKeys.session.all, "bonus"] as const,
    /** P3-28 — whether a launch of this game may be bonus-funded (the "play with your bonus?" prompt). */
    launchEligibility: (gameId: string) => [...queryKeys.session.all, "bonus", "launch-eligibility", gameId] as const,
    /** P3-28 — payments: the methods (per direction) and the player's history (per filter). */
    paymentMethods: (direction: "deposit" | "withdraw") => [...queryKeys.session.all, "payments", "methods", direction] as const,
    paymentHistory: (type: string) => [...queryKeys.session.all, "payments", "history", type] as const,
    /** P3-31 — the support panel's tappable questions, per language. (The thread itself is the hub-fed support store.) */
    supportCanned: (language: string) => [...queryKeys.session.all, "support", "canned", language] as const,
    supportCannedAll: () => [...queryKeys.session.all, "support", "canned"] as const,
    /** P3-30 — in-site notifications: the drawer's pages and the bell's count (both fed live by the notifications hub). */
    notificationsAll: () => [...queryKeys.session.all, "notifications"] as const,
    notifications: () => [...queryKeys.session.all, "notifications", "list"] as const,
    notificationsUnread: () => [...queryKeys.session.all, "notifications", "unread"] as const,
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
