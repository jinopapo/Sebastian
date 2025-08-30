import { spawn } from "node:child_process";

export type TerminalResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export async function runTerminal(command: string, opts?: { cwd?: string; timeoutMs?: number; streamToStdout?: boolean; }): Promise<TerminalResult> {
  const timeoutMs = opts?.timeoutMs ?? 60_000;
  const cwd = opts?.cwd ?? process.cwd();

  // If we're streaming to stdout, also echo the command so users can see it.
  // Write to stderr to avoid polluting stdout for command consumers.
  if (opts?.streamToStdout) {
    const ts = new Date().toISOString();
    try { process.stderr.write(`[${ts}] ${cwd}$ ${command}\n`); } catch {}
  }

  const proc = spawn("bash", ["-lc", command], {
    cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  let done = false;
  let timedOut = false;

  if (proc.stdout) {
    proc.stdout.on("data", (chunk) => {
      const text = String(chunk);
      stdout += text;
      if (opts?.streamToStdout) process.stdout.write(text);
    });
  }
  if (proc.stderr) {
    proc.stderr.on("data", (chunk) => {
      const text = String(chunk);
      stderr += text;
      if (opts?.streamToStdout) process.stderr.write(text);
    });
  }

  const exitCode: number | null = await new Promise((resolve) => {
    const to = setTimeout(() => {
      timedOut = true;
      try { proc.kill("SIGKILL"); } catch {}
    }, timeoutMs);
    proc.on("close", (code) => {
      clearTimeout(to);
      done = true;
      resolve(code);
    });
  });

  return { exitCode, stdout, stderr, timedOut };
}
