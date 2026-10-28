import { queryOptions } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { components } from "@/api/schema";
import { applySiteLanguages } from "@/i18n";
import { setSkinCurrency } from "@/lib/money";
import { queryKeys } from "@/lib/queryKeys";

export type SiteConfig = components["schemas"]["SiteConfigResponse"];

/**
 * The site's own settings from the back office (owner 2026-10-13): which languages it offers and which is the
 * default, and its one currency — core's /api/v1/site, read once before the first render (the root loader).
 */
export const siteConfigOptions = () =>
  queryOptions({
    queryKey: queryKeys.site(),
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/site");
      if (error || !data) throw error ?? new Error("No site config");
      return data;
    },
    staleTime: 5 * 60_000,
  });

/** Language set + default and the currency, applied to the running site. */
export function applySiteConfig(config: SiteConfig) {
  setSkinCurrency(config.defaultCurrency);
  applySiteLanguages(config.languages, config.defaultLanguage);
}
