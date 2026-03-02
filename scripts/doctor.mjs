import { execSync } from 'node:child_process';

function run(command) {
  try {
    const output = execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
    return { ok: true, output };
  } catch (error) {
    const stderr = error?.stderr?.toString?.().trim() ?? String(error);
    return { ok: false, output: stderr };
  }
}

const checks = [
  ['node', 'node --version'],
  ['npm', 'npm --version'],
  ['playwright', 'npx playwright --version'],
  ['web workspace', 'npm --workspace @earthly/web run -s typecheck'],
  ['server workspace', 'npm --workspace @earthly/server run -s typecheck']
];

let hasFailure = false;

for (const [name, command] of checks) {
  const result = run(command);
  const status = result.ok ? 'OK' : 'FAIL';
  console.log(`[${status}] ${name}`);
  if (result.output) {
    console.log(result.output);
  }
  console.log('');
  if (!result.ok) {
    hasFailure = true;
  }
}

if (hasFailure) {
  process.exit(1);
}
