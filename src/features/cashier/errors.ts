import type { TFunction } from "i18next";

/** Payments' refusals → the cashier's copy (`cashier.error.*`), the generic line for anything unnamed. */
export const cashierError = (t: TFunction, code: string | undefined) =>
  t(`cashier.error.${code ?? "UNKNOWN"}`, { defaultValue: t("cashier.error.UNKNOWN") });
