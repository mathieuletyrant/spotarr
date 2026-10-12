import { Code, ConnectError } from "@connectrpc/connect";
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { queryClient } from "../lib/api";
import { statusQuery } from "../queries/status";

// Every page but /login: the header and the page. Before showing anything, a
// first call checks the API token's cookie; without it, off to /login.
export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    try {
      // Asked once, then kept: a signed-in browser is not checked again on every page.
      await queryClient.query({
        ...statusQuery(),
        staleTime: "static",
        meta: { signInCheck: true },
      });
    } catch (error) {
      if (ConnectError.from(error).code === Code.Unauthenticated) throw redirect({ to: "/login" });
      throw error;
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-4 border-b border-border bg-surface px-4 py-3 md:gap-6 md:px-6">
        <span className="flex items-center gap-2 font-semibold">
          {" "}
          <img src="/favicon.svg" alt="" className="size-6" /> Spotarr{" "}
        </span>
        <nav className="flex gap-1 text-sm">
          <Link
            to="/"
            className="rounded-md px-3 py-1.5 text-text-muted [&.active]:bg-text/8 [&.active]:text-text"
          >
            History
          </Link>
          <Link
            to="/settings"
            className="rounded-md px-3 py-1.5 text-text-muted [&.active]:bg-text/8 [&.active]:text-text"
          >
            Settings
          </Link>
        </nav>
        {/* The page's main action, on every page: share a link from the computer. */}
        <Link
          to="/share"
          className="ml-auto flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-text focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Plus aria-hidden className="size-4" />
          Share
        </Link>
      </header>
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
