import { Code, ConnectError } from "@connectrpc/connect";
import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
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
      <header className="flex items-center gap-6 border-b border-border bg-surface px-6 py-3">
        <span className="font-semibold">Spotarr</span>
        <nav className="flex gap-1 text-sm">
          <Link
            to="/"
            className="rounded-md px-3 py-1.5 text-text-muted [&.active]:bg-text/8 [&.active]:text-text"
          >
            History
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
