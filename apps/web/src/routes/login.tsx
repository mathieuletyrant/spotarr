import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";

export const Route = createFileRoute("/login")({ component: Login });

// Asked once: the server checks the API token and keeps it in an HttpOnly
// cookie, which the browser then sends with every call.
function Login() {
  const navigate = useNavigate();
  const [token, setToken] = useState("");
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const res = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.trim() }),
    });
    if (res.ok) await navigate({ to: "/" });
    else setError("Wrong token. Spotarr prints it in its logs at first start.");
  }

  return (
    <form onSubmit={submit} className="mx-auto mt-24 flex max-w-sm flex-col gap-3">
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
      {error && <p className="text-sm text-status-error">{error}</p>}
      <button type="submit" className="rounded-md bg-accent px-3 py-2 font-medium text-accent-text">
        Sign in
      </button>
    </form>
  );
}
