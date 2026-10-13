import { TransportProvider } from "@connectrpc/connect-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { routeTree } from "./gen/routeTree.gen";
import { queryClient, transport } from "./lib/api";
import "./styles.css";

const router = createRouter({ routeTree });

// Lets TanStack Router type every link and route parameter of the app.
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <TransportProvider transport={transport}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        {/* Only in pnpm dev: the build leaves the devtools out. */}
        <ReactQueryDevtools buttonPosition="bottom-left" />
      </QueryClientProvider>
    </TransportProvider>
  </StrictMode>,
);
