import { TransportProvider } from "@connectrpc/connect-query";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
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
        {/* Only in pnpm dev: the devtools Vite plugin removes them from the build. */}
        <TanStackDevtools
          plugins={[
            { name: "TanStack Query", render: <ReactQueryDevtoolsPanel /> },
            { name: "TanStack Router", render: <TanStackRouterDevtoolsPanel router={router} /> },
          ]}
        />
      </QueryClientProvider>
    </TransportProvider>
  </StrictMode>,
);
