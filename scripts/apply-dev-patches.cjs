const fs = require('node:fs');
const cp = require('node:child_process');

if (!fs.existsSync('patches')) {
  process.exit(0);
}

const command =
  process.platform === 'win32' ? 'patch-package.cmd' : 'patch-package';
const result = cp.spawnSync(command, { stdio: 'inherit', shell: true });

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
