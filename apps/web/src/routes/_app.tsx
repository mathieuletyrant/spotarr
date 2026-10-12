import { Code, ConnectError } from "@connectrpc/connect";
import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { ShareDialog } from "../components/share-dialog";
import { ThemeButton } from "../components/theme-button";
import { queryClient } from "../lib/api";
import { statusQuery } from "../queries/status";

// Every page but /login: the header and the page. Before showing anything, a
// first call checks the API token's cookie; without it, off to /login.
export const Route = createFileRoute("/_app")({
  // ?share=true opens the Share dialog over any page.
  validateSearch: (search: Record<string, unknown>): { share?: true } =>
    search.share === true || search.share === "true" ? { share: true } : {},
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
  const { share } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-4 border-b border-border bg-surface px-4 py-3 md:gap-6 md:px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <img src="/favicon.svg" alt="Spotarr" className="size-6" />
          <span className="hidden sm:inline">Spotarr</span>
        </Link>
        <nav className="flex gap-1 text-sm">
          <Link
            to="/"
            className="rounded-md px-3 py-1.5 text-text-muted [&.active]:bg-text/8 [&.active]:text-text"
          >
            History
          </Link>
          <Link
            to="/stats"
            className="rounded-md px-3 py-1.5 text-text-muted [&.active]:bg-text/8 [&.active]:text-text"
          >
            Stats
          </Link>
          <Link
            to="/settings"
            className="rounded-md px-3 py-1.5 text-text-muted [&.active]:bg-text/8 [&.active]:text-text"
          >
            Settings
          </Link>
        </nav>
        {/* The page's main action, on every page: share a link from the computer. */}
        <div className="ml-auto flex items-center gap-1">
          <ThemeButton />
          <Link
            to="."
            search={(previous) => ({ ...previous, share: true })}
            aria-label="Share a link"
            className="flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-text"
          >
            <Plus aria-hidden className="size-4" />
            <span className="hidden sm:inline">Share</span>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl p-4 md:p-6">
        <Outlet />
      </main>
      <ShareDialog
        open={share === true}
        onClose={() =>
          navigate({ to: ".", search: (previous) => ({ ...previous, share: undefined }) })
        }
      />
    </div>
  );
}
