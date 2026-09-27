/** P3-24 — the login the dialog sends: an email as typed, or a PH mobile's ten digits as E.164 (+63…). */
export type Contact = "phone" | "email";

export const toLogin = (contact: Contact, value: string) => (contact === "phone" ? `+63${value.replace(/[\s-]/g, "")}` : value.trim());
