import { render } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { createTestQueryClient } from "./render";

/**
 * Renders the REAL app at a URL: the route tree, its search validation, the root's session probe and the shared
 * auth dialog — against msw. For pages whose behaviour is their URL (filters, `?promo=`), not a component alone.
 */
export function renderRoute(url: string) {
  const queryClient = createTestQueryClient();
  const history = createMemoryHistory({ initialEntries: [url] });
  const router = createRouter({ routeTree, history, context: { queryClient } });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...utils, router, queryClient };
}
