import { loadRuntimeConfig, RuntimeConfigError } from './config/env.js';
import { createApp } from './app.js';

try {
  const config = loadRuntimeConfig(process.env);
  const app = createApp(config);

  app.listen(config.port, () => {
    console.log(`[earthly-server] listening on http://localhost:${config.port}`);
  });
} catch (error) {
  if (error instanceof RuntimeConfigError) {
    console.error('[earthly-server] startup aborted due to invalid environment config.');
    for (const issue of error.issues) {
      console.error(`  - ${issue}`);
    }
    process.exit(1);
  }

  throw error;
}
