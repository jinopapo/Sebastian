import { tool } from "@openai/agents";
import { z } from "zod";
import readline from "node:readline";
import { runTerminal } from "./terminalTool.js";
import { isPossiblyDestructive } from "./safety.js";

function askYN(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase().startsWith("y"));
    });
  });
}

const TOOL_NAME = "run_command" as const;

export const terminalTool = tool({
  name: TOOL_NAME,
  description: "Execute a shell command and return stdout/stderr. Use carefully; ask for confirmation for destructive operations.",
  strict: true,
  parameters: z.object({
    command: z.string().min(1),
    timeoutMs: z.number().int().positive().max(5 * 60_000).nullable(),
    cwd: z.string().nullable()
  }),
  execute: async (input) => {
    if (isPossiblyDestructive(input.command)) {
      const ok = await askYN(`Potentially destructive command detected:\n  ${input.command}\nProceed? [y/N] `);
      if (!ok) return { cancelled: true, message: "Execution cancelled by user." };
    }

    const cwd = input.cwd ?? undefined;
    // Do not stream raw output; we will print a concise summary after.
    const result = await runTerminal(input.command, { cwd, timeoutMs: input.timeoutMs ?? undefined, streamToStdout: false });

    // Minimal operator output: show only the command and first 100 chars of output
    const maxLen = 100;
    const cut = (s: string) => (s.length > maxLen ? s.slice(0, maxLen) + "…" : s);
    const primary = result.stdout?.trim() ? result.stdout : result.stderr ?? "";
    const snippet = cut(primary);
    try {
      // Separate from AI output and bracket with start/end separators
      process.stderr.write(`\n`);
      process.stderr.write(`-----${TOOL_NAME}------\n`);
      process.stderr.write(`$ ${input.command}\n`);
      process.stderr.write(`${snippet}\n`);
      process.stderr.write(`-----${TOOL_NAME}------\n`);
    } catch {}
    return {
      command: input.command,
      cwd: cwd ?? process.cwd(),
      exitCode: result.exitCode,
      timedOut: result.timedOut,
      stdout: result.stdout.slice(-8000),
      stderr: result.stderr.slice(-8000)
    };
  }
});
