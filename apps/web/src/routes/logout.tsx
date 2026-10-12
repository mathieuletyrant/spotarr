import { createClient } from "@connectrpc/connect";
import { SpotarrService } from "@spotarr/contract";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { queryClient, transport } from "../lib/api";

// Signs the web UI out: the server drops the cookie, the cache is emptied,
// then off to the sign-in page.
export const Route = createFileRoute("/logout")({
  beforeLoad: async () => {
    await createClient(SpotarrService, transport)
      .logout({})
      .catch(() => {}); // already signed out: fine
    queryClient.removeQueries();
    throw redirect({ to: "/login" });
  },
});
