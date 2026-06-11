import { spawn } from 'node:child_process';

const commands = [
  { name: 'api', cmd: 'npm', args: ['run', 'server'] },
  { name: 'web', cmd: 'npm', args: ['run', 'dev'] },
];

const children = commands.map(({ name, cmd, args }) => {
  const child = spawn(cmd, args, { stdio: 'pipe', shell: true });
  child.stdout.on('data', (data) => process.stdout.write(`[${name}] ${data}`));
  child.stderr.on('data', (data) => process.stderr.write(`[${name}] ${data}`));
  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
      process.exitCode = code;
    }
  });
  return child;
});

const stop = () => {
  for (const child of children) child.kill('SIGTERM');
};

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
