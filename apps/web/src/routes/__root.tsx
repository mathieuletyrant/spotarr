import { createRootRoute, Outlet } from "@tanstack/react-router";

// Two areas below: /login, alone, and _app, every page behind the sign-in.
export const Route = createRootRoute({ component: Outlet });
