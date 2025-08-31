import 'dotenv/config';
import readline from 'node:readline';
import { Agent, run, webSearchTool, user, AgentInputItem } from '@openai/agents';
import { terminalTool } from './tools/terminal/terminal.js';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

function ensureEnv() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY. Copy .env.example to .env and set it.');
    process.exit(1);
  }
}

async function main() {
  ensureEnv();
  const model = process.env.AGENT_MODEL || 'gpt-4o-mini';
  const instructionsPath = resolve(
    process.cwd(),
    process.env.INSTRUCTIONS_PATH || 'src/promts/terminal-agent.mdx',
  );
  let instructions = 'You are a careful terminal assistant. Use the run_command tool to execute shell commands when necessary, explain your plan briefly, and avoid destructive actions unless explicitly confirmed.';
  try {
    const raw = await readFile(instructionsPath, 'utf8');
    if (extname(instructionsPath).toLowerCase() === '.mdx' || extname(instructionsPath).toLowerCase() === '.md') {
      // Strip YAML frontmatter if present (--- ... --- at file start)
      const fm = /^---[\r\n]([\s\S]*?)[\r\n]---[\r\n]?/;
      instructions = raw.replace(fm, '').trim();
    } else {
      instructions = raw;
    }
  } catch {
    // Fallback to embedded default if file not found
  }

  const agent = new Agent({
    name: 'Terminal Agent',
    instructions,
    model,
    tools: [
      terminalTool,
      webSearchTool()
    ],
    // If you want provider-specific settings (e.g., GPT-5 reasoning/verbosity),
    // put them under providerData. Kept empty for broad compatibility.
    modelSettings: {
      reasoning: { effort: 'minimal' },
      text: { verbosity: 'low' },
    },
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("Terminal Agent (openai-agents) ready. Type your request, or 'exit' to quit.\n");

  async function question(q: string) {
    return new Promise<string>((resolve) => rl.question(q, resolve));
  }

  // Accumulate conversation for the current process lifetime
  let history: AgentInputItem[] = [];
  // Track token usage across turns in this process
  let sessionUsage = { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  const tokenLimit = Number(process.env.TOKEN_LIMIT || '') || undefined;

  while (true) {
    const prompt = `> [in:${sessionUsage.inputTokens}] `;
    const input = await question(prompt);
    if (!input) continue;
    if (input.trim().toLowerCase() === 'exit') break;

    try {
      history.push(user(input));

      // Stream model tokens
      const streamed = await run(agent, history, { stream: true });
      const textStream = streamed.toTextStream({ compatibleWithNodeStreams: true });

      await new Promise<void>((resolve, reject) => {
        textStream.on('data', (chunk: Buffer | string) => {
          process.stdout.write(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
        });
        textStream.on('end', () => resolve());
        textStream.on('error', (e: unknown) => reject(e));
      });

      await streamed.completed;
      // Update in-memory history for the next turn
      history = streamed.history;
      // Aggregate usage for this run and session
      const runUsage = (streamed.rawResponses || []).reduce(
        (acc: any, r: any) => {
          const u = r?.usage || {};
          acc.requests += u.requests ?? 0;
          acc.inputTokens += u.inputTokens ?? u.input_tokens ?? 0;
          acc.outputTokens += u.outputTokens ?? u.output_tokens ?? 0;
          acc.totalTokens += u.totalTokens ?? u.total_tokens ?? 0;
          return acc;
        },
        { requests: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      );
      sessionUsage.requests += runUsage.requests;
      sessionUsage.inputTokens += runUsage.inputTokens;
      sessionUsage.outputTokens += runUsage.outputTokens;
      sessionUsage.totalTokens += runUsage.totalTokens;

      // Print a concise usage summary to stderr
      // try {
      //   const pct = tokenLimit ? Math.round((sessionUsage.totalTokens / tokenLimit) * 100) : undefined;
      //   process.stderr.write(`\n[usage] run: in=${runUsage.inputTokens} out=${runUsage.outputTokens} total=${runUsage.totalTokens} req=${runUsage.requests}\n`);
      //   process.stderr.write(`[usage] session: in=${sessionUsage.inputTokens} out=${sessionUsage.outputTokens} total=${sessionUsage.totalTokens} req=${sessionUsage.requests}` + (pct !== undefined ? ` (${pct}% of limit ${tokenLimit})` : '') + `\n`);
      //   if (pct !== undefined && pct >= 80) {
      //     process.stderr.write(`[usage] warning: approaching token limit (${pct}%)\n`);
      //   }
      // } catch {}
      process.stdout.write('\n');
    } catch (err) {
      console.error(err);
    }
  }

  rl.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
