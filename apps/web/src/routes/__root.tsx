import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({ component: Layout });

function Layout() {
  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-6 border-b border-border px-6 py-3">
        <span className="font-semibold">Spotarr</span>
        <nav className="flex gap-1 text-sm">
          <Link
            to="/"
            className="rounded-md px-3 py-1.5 text-text-muted [&.active]:bg-surface [&.active]:text-text"
          >
            Historique
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl p-6">
        <Outlet />
      </main>
    </div>
  );
}
