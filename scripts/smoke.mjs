import { spawn } from 'node:child_process';

const checks = ['http://localhost:4000/api/health', 'http://localhost:5173'];
const requestTimeoutMs = Number(process.env.SMOKE_REQUEST_TIMEOUT_MS ?? 2_500);
const startupTimeoutMs = Number(process.env.SMOKE_STARTUP_TIMEOUT_MS ?? 90_000);
const startupPollMs = Number(process.env.SMOKE_STARTUP_POLL_MS ?? 1_000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probe(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return {
      ok: response.ok,
      status: response.status
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function runChecks() {
  let failures = 0;

  for (const url of checks) {
    const result = await probe(url);
    if (result.ok) {
      console.log(`[OK] ${url} -> ${result.status}`);
      continue;
    }

    if (typeof result.status === 'number') {
      console.log(`[FAIL] ${url} -> ${result.status}`);
    } else {
      console.log(`[FAIL] ${url} -> ${result.error}`);
    }
    failures += 1;
  }

  return failures;
}

async function areServicesReachable() {
  const results = await Promise.all(checks.map((url) => probe(url)));
  return results.every((result) => result.ok);
}

function startDevServices() {
  const child = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
    detached: process.platform !== 'win32'
  });

  return child;
}

async function waitForServices(child) {
  const deadline = Date.now() + startupTimeoutMs;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Dev services exited before startup (code ${child.exitCode})`);
    }

    if (await areServicesReachable()) {
      return;
    }

    await sleep(startupPollMs);
  }

  throw new Error(`Timed out waiting for dev services after ${startupTimeoutMs}ms`);
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    const onExit = () => {
      clearTimeout(timeout);
      resolve(true);
    };
    const timeout = setTimeout(() => {
      child.off('exit', onExit);
      resolve(false);
    }, timeoutMs);

    child.once('exit', onExit);
  });
}

function signalChildTree(child, signal) {
  if (!child?.pid) {
    return;
  }

  try {
    if (process.platform === 'win32') {
      child.kill(signal);
      return;
    }
    process.kill(-child.pid, signal);
  } catch {
    // Ignore missing/already-exited process errors.
  }
}

async function stopChild(child) {
  if (!child || child.killed || child.exitCode !== null) {
    return;
  }

  signalChildTree(child, 'SIGINT');
  if (await waitForExit(child, 4_000)) {
    return;
  }

  signalChildTree(child, 'SIGTERM');
  if (await waitForExit(child, 3_000)) {
    return;
  }

  signalChildTree(child, 'SIGKILL');
  await waitForExit(child, 2_000);
}

async function run() {
  let startedChild = null;

  try {
    if (!(await areServicesReachable())) {
      console.log('[smoke] local services not reachable; starting `npm run dev`');
      startedChild = startDevServices();
      await waitForServices(startedChild);
    }

    const failures = await runChecks();
    if (failures > 0) {
      process.exit(1);
    }
  } finally {
    await stopChild(startedChild);
  }
}

run().catch((error) => {
  console.error(`[smoke] ${String(error)}`);
  process.exit(1);
});
