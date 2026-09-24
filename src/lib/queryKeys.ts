/**
 * The ONLY place query keys are defined (house rule 1). `session.all` is the prefix for everything that depends on
 * who is signed in, so signing out drops it all at once.
 */
export const queryKeys = {
  session: {
    all: ["session"] as const,
    state: () => [...queryKeys.session.all, "state"] as const,
    sessions: () => [...queryKeys.session.all, "sessions"] as const,
  },
} as const;
