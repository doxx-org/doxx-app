"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache for 5 seconds by default
      staleTime: 5 * 1000,
      // Keep in cache for 1 minute
      gcTime: 60 * 1000,
      // Retry failed requests 2 times
      retry: 2,
      // Don't refetch on window focus for blockchain data
      refetchOnWindowFocus: false,
      // Don't refetch on reconnect for blockchain data
      refetchOnReconnect: false,
    },
  },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
