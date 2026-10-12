import { useMutation } from "@connectrpc/connect-query";
import { SpotarrService } from "@spotarr/contract";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, KeyRound, LibraryBig, ScanSearch, Share } from "lucide-react";
import { type ReactNode, type SubmitEvent, useState } from "react";
import { queryClient } from "../lib/api";

export const Route = createFileRoute("/login")({ component: Login });

// The first page anyone sees: what Spotarr does on one side, the sign-in on
// the other. Asked once: the server checks the API token and keeps it in an
// HttpOnly cookie, which the browser then sends with every call.
function Login() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <Showcase />
      <div className="flex items-center justify-center p-6 sm:p-10">
        <SignInForm />
      </div>
    </div>
  );
}

function Showcase() {
  return (
    <div className="flex flex-col justify-center gap-10 border-b border-border bg-surface p-8 sm:p-12 lg:border-r lg:border-b-0 lg:p-16">
      <div className="flex items-center gap-3">
        <img src="/favicon.svg" alt="" className="size-12 lg:size-16" />
        <span className="text-3xl font-semibold lg:text-4xl">Spotarr</span>
      </div>
      <div className="flex flex-col gap-3">
        <p className="text-2xl font-semibold lg:text-3xl">Share a reel. Get the film.</p>
        <p className="max-w-md text-text-muted">
          Spotarr finds the movies and shows a video is about, and adds them to your library.
        </p>
      </div>
      <ul className="hidden flex-col gap-4 sm:flex">
        <Point icon={<Share aria-hidden className="size-4" />}>
          Share an Instagram reel from your iPhone, or paste a link.
        </Point>
        <Point icon={<ScanSearch aria-hidden className="size-4" />}>
          An LLM watches the frames and hears the sound; TMDB confirms the titles.
        </Point>
        <Point icon={<LibraryBig aria-hidden className="size-4" />}>
          Pick the right one, and Seerr adds it to your library.
        </Point>
      </ul>
    </div>
  );
}

function Point({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
        {icon}
      </span>
      <span className="pt-1 text-sm">{children}</span>
    </li>
  );
}

function SignInForm() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [shown, setShown] = useState(false);
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
    <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-text-muted">Paste your API token. You only do it once here.</p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">API token</span>
        <span className="relative flex items-center">
          <KeyRound aria-hidden className="absolute left-3 size-4 text-text-muted" />
          <input
            type={shown ? "text" : "password"}
            required
            value={token}
            onChange={(e) => setToken(e.target.value)}
            spellCheck={false}
            autoComplete="current-password"
            className="h-11 w-full rounded-md border border-border bg-surface pr-10 pl-9 font-mono text-sm"
          />
          <button
            type="button"
            onClick={() => setShown(!shown)}
            aria-label={shown ? "Hide the token" : "Show the token"}
            className="absolute right-0 flex h-11 w-10 items-center justify-center text-text-muted hover:text-text"
          >
            {shown ? (
              <EyeOff aria-hidden className="size-4" />
            ) : (
              <Eye aria-hidden className="size-4" />
            )}
          </button>
        </span>
        {login.isError && (
          <span className="text-sm text-status-error">This is not Spotarr's token.</span>
        )}
      </label>

      <button
        type="submit"
        disabled={login.isPending}
        className="h-11 rounded-md bg-accent font-medium text-accent-text"
      >
        {login.isPending ? "Signing in…" : "Sign in"}
      </button>

      <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-sm">
        <p className="font-medium">Where is my token?</p>
        <p className="text-text-muted">
          Spotarr generated it on its first start. You never choose it: you copy it.
        </p>
        <ul className="flex flex-col gap-1 text-text-muted">
          <li>
            <span className="font-medium text-text">On Umbrel:</span> it is the default password
            shown on Spotarr's page in umbrelOS.
          </li>
          <li>
            <span className="font-medium text-text">With Docker:</span> Spotarr prints it in its
            logs at every start,{" "}
            <code className="font-mono text-xs">docker compose logs spotarr</code>.
          </li>
        </ul>
      </div>
    </form>
  );
}
