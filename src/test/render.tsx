import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";
import { SessionProvider, type SessionState } from "@/features/auth/session";

export function createTestQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
}

export function renderWithProviders(ui: ReactElement, options?: RenderOptions & { queryClient?: QueryClient; session?: SessionState; onLost?: () => void }) {
  const qc = options?.queryClient ?? createTestQueryClient();
  const session = options?.session ?? { signedIn: false };
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <SessionProvider state={session} onLost={options?.onLost ?? (() => {})}>{children}</SessionProvider>
    </QueryClientProvider>
  );
  return { qc, ...render(ui, { wrapper: Wrapper, ...options }) };
}
