import { z } from "zod";

export const ToolArgsSchema = z.object({
  command: z.string().min(1),
  timeoutMs: z.number().int().positive().max(5 * 60_000).optional(),
  cwd: z.string().optional()
});

const destructivePatterns: RegExp[] = [
  /\brm\b.*\b(-rf|--recursive|--no-preserve-root)\b/i,
  /\bshutdown\b|\bhalt\b|\breboot\b/i,
  /\bmkfs\b|\bmkfs\.\w+/i,
  /\bdd\b.*\bof=\/?dev\//i,
  /\bsudo\b\s+(rm|dd|mkfs|mount|umount|chmod|chown)\b/i,
  /\bchown\b\s+-R\b/i,
  /\bchmod\b\s+-R\s+7[0-7]{2}\b/i,
  /:\/\/.*curl\s+\|\s+sh/i
];

export function isPossiblyDestructive(cmd: string): boolean {
  const s = cmd.trim();
  return destructivePatterns.some((re) => re.test(s));
}

export function summarizeCommand(cmd: string): string {
  return cmd.length > 120 ? cmd.slice(0, 117) + "..." : cmd;
}

