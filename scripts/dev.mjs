import { spawn } from 'node:child_process';

const commands = [
  {
    name: 'server',
    cmd: 'npm',
    args: ['--workspace', '@earthly/server', 'run', 'dev']
  },
  {
    name: 'web',
    cmd: 'npm',
    args: ['--workspace', '@earthly/web', 'run', 'dev']
  }
];

const children = [];

for (const command of commands) {
  const child = spawn(command.cmd, command.args, {
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32'
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`\n[earthly] ${command.name} exited with code ${code}`);
      shutdown(code);
    }
  });

  children.push(child);
}

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGINT');
    }
  }

  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
