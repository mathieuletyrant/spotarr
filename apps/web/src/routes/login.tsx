import { useMutation } from "@connectrpc/connect-query";
import { SpotarrService } from "@spotarr/contract";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type SubmitEvent, useState } from "react";
import { queryClient } from "../lib/api";

export const Route = createFileRoute("/login")({ component: Login });

// Asked once: the server checks the API token and keeps it in an HttpOnly
// cookie, which the browser then sends with every call.
function Login() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const login = useMutation(SpotarrService.method.login, {
    // Forget the "not signed in" answers cached before, then go in.
    onSuccess: async () => {
      queryClient.removeQueries();
      await navigate({ to: "/" });
    },
  });

  function submit(event: SubmitEvent) {
    event.preventDefault();
    login.mutate({ token });
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-24 flex max-w-sm flex-col gap-3">
      <p className="flex items-center gap-2 font-semibold">
        <img src="/favicon.svg" alt="" className="size-6" />
        Spotarr
      </p>
      <h1 className="text-xl font-semibold">Sign in</h1>
      <label className="flex flex-col gap-1 text-sm">
        API token
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2"
        />
      </label>
      {login.isError && (
        <p className="text-sm text-status-error">
          Wrong token. Spotarr prints it in its logs at every start.
        </p>
      )}
      <button
        type="submit"
        disabled={login.isPending}
        className="rounded-md bg-accent px-3 py-2 font-medium text-accent-text disabled:opacity-50"
      >
        Sign in
      </button>
    </form>
  );
}
