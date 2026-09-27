import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import "./styles/globals.css";
import "./i18n";
import { routeTree } from "./routeTree.gen";
import { toApiError } from "./api/problem";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // 4xx are answers, not flakiness — never retry them.
      retry: (count, err) => toApiError(err).status >= 500 && count < 2,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

declare module "@tanstack/history" {
  interface HistoryState {
    /** Set when the Promotions page itself opened `?promo=` — closing the dialog then steps Back instead of leaving a dead entry. */
    promoOpenedHere?: boolean;
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
