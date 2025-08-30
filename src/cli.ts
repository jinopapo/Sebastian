import 'dotenv/config';
import readline from 'node:readline';
import { Agent, run } from '@openai/agents';
import { terminalTool } from './tools/terminal/terminal.js';

function ensureEnv() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY. Copy .env.example to .env and set it.');
    process.exit(1);
  }
}

async function main() {
  ensureEnv();
  const model = process.env.AGENT_MODEL || 'gpt-4o-mini';

  const agent = new Agent({
    name: 'Terminal Agent',
    instructions: 'You are a careful terminal assistant. Use the run_command tool to execute shell commands when necessary, explain your plan briefly, and avoid destructive actions unless explicitly confirmed.',
    model,
    tools: [terminalTool],
    // If you want provider-specific settings (e.g., GPT-5 reasoning/verbosity),
    // put them under providerData. Kept empty for broad compatibility.
    modelSettings: { providerData: {} },
  });

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log("Terminal Agent (openai-agents) ready. Type your request, or 'exit' to quit.\n");

  async function question(q: string) {
    return new Promise<string>((resolve) => rl.question(q, resolve));
  }

  while (true) {
    const input = await question('> ');
    if (!input) continue;
    if (input.trim().toLowerCase() === 'exit') break;

    try {
      // Stream model tokens and tool events
      const streamed = await run(agent, input, { stream: true });
      const textStream = streamed.toTextStream({ compatibleWithNodeStreams: true });

      await new Promise<void>((resolve, reject) => {
        textStream.on('data', (chunk: Buffer | string) => {
          process.stdout.write(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
        });
        textStream.on('end', () => resolve());
        textStream.on('error', (e: unknown) => reject(e));
      });

      await streamed.completed;
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
