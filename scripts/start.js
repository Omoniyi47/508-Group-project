import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const commands = [
  { name: 'backend', args: ['run', 'start', '--prefix', 'server'] },
  { name: 'frontend', args: ['run', 'dev', '--prefix', 'client'] },
];

let isShuttingDown = false;
const children = commands.map(({ name, args }) => {
  // Windows does not reliably execute .cmd shims through child_process.spawn.
  // Starting npm through cmd.exe makes the root launcher work consistently on
  // Windows while retaining the normal direct npm invocation elsewhere.
  const command = isWindows ? 'cmd.exe' : 'npm';
  const commandArgs = isWindows ? ['/d', '/s', '/c', 'npm', ...args] : args;
  const child = spawn(command, commandArgs, { stdio: 'inherit', windowsHide: true });

  child.on('error', (error) => {
    console.error(`Failed to start the ${name}: ${error.message}`);
    shutdown(1);
  });

  child.on('exit', (code, signal) => {
    if (isShuttingDown) return;
    const reason = signal ? `signal ${signal}` : `exit code ${code}`;
    console.error(`${name} stopped unexpectedly (${reason}).`);
    shutdown(code ?? 1);
  });

  return child;
});

function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  for (const child of children) {
    if (!child.killed) child.kill();
  }

  process.exitCode = exitCode;
}

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
