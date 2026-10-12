import { SpotarrError } from "../errors";

// Runs a command line program and returns what it printed. Throws when it
// fails (with its last error line) or when it takes longer than `timeoutMs`.
export async function run(command: string[], timeoutMs: number): Promise<string> {
  const child = Bun.spawn(command, { stdout: "pipe", stderr: "pipe", timeout: timeoutMs });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);

  const program = command[0];
  if (child.signalCode)
    throw new SpotarrError("timeout", `${program} took more than ${timeoutMs / 1000} s`);
  if (exitCode !== 0) {
    const lastLine = stderr.trim().split("\n").at(-1);
    throw new SpotarrError("unavailable", `${program} failed: ${lastLine}`);
  }
  return stdout;
}
