**Terminal Agent (CLI) — OpenAI Agents SDK**

- Purpose: Interactive agent that can operate your terminal via natural language using the OpenAI Agents SDK (openai-agents-js).
- Stack: TypeScript + Node.js + `@openai/agents`.

**Setup**

- Requirements: Node.js 18+.
- Copy `.env.example` to `.env` and set `OPENAI_API_KEY`.
- Install deps:
  - `npm install`
  - Optional: choose a model with `AGENT_MODEL` (default `gpt-4o-mini`).

**Run**

- Dev (TS directly): `npm run dev`
- Build: `npm run build`
- Start built: `npm start`

**Usage**

- 例: 「プロジェクト直下のファイル一覧を表示して」
- エージェントは `run_command` ツールを必要時に呼び出し、結果を表示します。
- 危険そうなコマンド（例: `rm -rf`）は実行前に確認ダイアログが出ます。
- 終了は `exit`。

**Safety**

- 危険判定: `rm -rf`、shutdown、mkfs、デバイスへのdd、sudoの危険組み合わせなどを検知し、確認を要求。`src/safety.ts` を参照。

**Implemented with openai-agents-js**

- `@openai/agents` を使用:
  - エージェント: `src/cli.ts` で `new Agent({...})` を作成し、`run(agent, input)` を実行。
  - ターミナルツール: `src/tools/terminal.ts` で `tool({...})` を使い、`src/terminalTool.ts` による実行をラップ。
  - 安全性: 破壊的コマンドはツール内で人間確認。

**Files**

- `src/cli.ts`: Agents SDKベースのCLI
- `src/terminalTool.ts`: コマンド実行（タイムアウト・ストリーム対応）
- `src/safety.ts`: 引数スキーマと危険コマンド検知
- `src/tools/terminal.ts`: Agentsツール定義

