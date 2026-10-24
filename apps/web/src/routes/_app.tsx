import { Code, ConnectError } from "@connectrpc/connect";
import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { ChartColumn, History, Plus, Settings } from "lucide-react";
import logo from "../assets/logo.svg";
import { ServicesStatus } from "../components/services-status";
import { ShareDialog } from "../components/share-dialog";
import { ThemeButton } from "../components/theme-button";
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

// The header's pages, in a row on a wide screen, in the tab bar on a phone.
const pages = [
  { to: "/", label: "History", icon: History },
  { to: "/stats", label: "Stats", icon: ChartColumn },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function AppLayout() {
  const { share } = Route.useSearch();
  const navigate = useNavigate();

  return (
    <ToastProvider>
      <div className="min-h-screen">
        <header className="flex items-center gap-4 border-b border-border bg-surface px-4 py-3 md:gap-6 md:px-6">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 font-display text-lg font-semibold"
          >
            <img src={logo} alt="" className="size-6 shrink-0" />
            Spotarr
          </Link>
          {/* On a phone the pages are in the tab bar, at the bottom. */}
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
          {/* The page's main action, on every page: share a link from the computer.
              Not on a phone, where links are shared through the Shortcut. */}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <ServicesStatus />
            <ThemeButton />
            <Link
              to="."
              search={(previous) => ({ ...previous, share: true })}
              className="hidden h-9 items-center gap-1.5 rounded-md bg-accent px-3 text-sm font-medium text-accent-text sm:flex"
            >
              <Plus aria-hidden className="size-4" />
              Share
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 pb-tab-bar md:p-6 md:pb-tab-bar">
          <Outlet />
        </main>
        <TabBar />
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

// On a phone: the pages at the bottom of the screen, where the thumb is, like
// an iOS app. Its buttons hug the top edge, as Snug's and iOS's do, above the
// iPhone's Home indicator (pb-safe). No Share: on a phone a link is shared from
// the app it is in, through the Shortcut.
function TabBar() {
  // A Share's page belongs to the History: its tab stays lit there.
  const onShare = useLocation({ select: (location) => location.pathname.startsWith("/shares/") });

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface sm:hidden">
      <div className="mx-auto flex max-w-md">
        {pages.map((page) => (
          <Link
            key={page.to}
            to={page.to}
            data-lit={page.to === "/" && onShare}
            className="flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1 text-xs text-text-muted data-[lit=true]:font-medium data-[lit=true]:text-text [&.active]:font-medium [&.active]:text-text"
          >
            <page.icon aria-hidden className="size-6" />
            {page.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
