import { Code, ConnectError } from "@connectrpc/connect";
import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { Menu, Plus, X } from "lucide-react";
import { useState } from "react";
import { ServicesStatus } from "../components/services-status";
import { ShareDialog } from "../components/share-dialog";
import { ThemeSwitch } from "../components/theme-switch";
import { ToastProvider } from "../components/toast";
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

// The header's pages, in a row on a wide screen, in the menu on a phone.
const pages = [
  { to: "/", label: "History" },
  { to: "/stats", label: "Stats" },
  { to: "/settings", label: "Settings" },
] as const;

function AppLayout() {
  const { share } = Route.useSearch();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <ToastProvider>
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center gap-4 border-b border-border bg-surface px-4 py-3 md:gap-6 md:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2 font-semibold">
            <img src="/favicon.svg" alt="" className="size-6 shrink-0" />
            Spotarr
          </Link>
          {/* On a phone the pages don't fit beside the actions: they go in the menu below. */}
          <nav className="hidden gap-1 text-sm sm:flex">
            {pages.map((page) => (
              <Link
                key={page.to}
                to={page.to}
                className="rounded-md px-3 py-1.5 text-text-muted [&.active]:bg-text/8 [&.active]:text-text"
              >
                {page.label}
              </Link>
            ))}
          </nav>
          {/* The page's main action, on every page: share a link from the computer. */}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ServicesStatus />
            <Link
              to="."
              search={(previous) => ({ ...previous, share: true })}
              aria-label="Share a link"
              className="flex h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-text"
            >
              <Plus aria-hidden className="size-4" />
              <span className="hidden sm:inline">Share</span>
            </Link>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
              aria-expanded={menuOpen}
              aria-controls="menu"
              className="flex size-9 items-center justify-center rounded-md text-text-muted hover:bg-text/8 hover:text-text sm:hidden"
            >
              {menuOpen ? (
                <X aria-hidden className="size-5" />
              ) : (
                <Menu aria-hidden className="size-5" />
              )}
            </button>
          </div>
        </header>
        {menuOpen && (
          <nav
            id="menu"
            className="flex flex-col gap-1 border-b border-border bg-surface px-4 py-2 sm:hidden"
          >
            {pages.map((page) => (
              <Link
                key={page.to}
                to={page.to}
                onClick={() => setMenuOpen(false)}
                className="rounded-md px-3 py-2.5 text-text-muted [&.active]:bg-text/8 [&.active]:text-text"
              >
                {page.label}
              </Link>
            ))}
          </nav>
        )}
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">
          <Outlet />
        </main>
        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-7xl justify-end p-4 md:px-6">
            <ThemeSwitch />
          </div>
        </footer>
        <ShareDialog
          open={share === true}
          onClose={() =>
            navigate({ to: ".", search: (previous) => ({ ...previous, share: undefined }) })
          }
        />
      </div>
    </ToastProvider>
  );
}
