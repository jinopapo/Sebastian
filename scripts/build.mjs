import { build } from 'esbuild';

const watch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const config = {
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  target: ['node18'],
  format: 'cjs',
  outfile: 'dist/ff.cjs',
  sourcemap: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
  logLevel: 'info',
};

async function run() {
  if (watch) {
    const ctx = await (await import('esbuild')).context(config);
    await ctx.watch();
    console.log('esbuild watching...');
  } else {
    await build(config);
    console.log('Build complete. Output: dist/ff.cjs');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
