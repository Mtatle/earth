const checks = [
  'http://localhost:4000/api/health',
  'http://localhost:5173'
];

async function run() {
  let failures = 0;

  for (const url of checks) {
    try {
      const response = await fetch(url);
      const status = response.status;
      const ok = response.ok;
      console.log(`[${ok ? 'OK' : 'FAIL'}] ${url} -> ${status}`);
      if (!ok) {
        failures += 1;
      }
    } catch (error) {
      console.log(`[FAIL] ${url} -> ${String(error)}`);
      failures += 1;
    }
  }

  if (failures > 0) {
    process.exit(1);
  }
}

run();
