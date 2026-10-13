import { createRootRoute, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";

// Two areas below: /login, alone, and _app, every page behind the sign-in.
export const Route = createRootRoute({ component: Root });

function Root() {
  return (
    <>
      <Outlet />
      {/* Only in pnpm dev: the build leaves the devtools out. */}
      <TanStackRouterDevtools position="bottom-right" />
    </>
  );
}
