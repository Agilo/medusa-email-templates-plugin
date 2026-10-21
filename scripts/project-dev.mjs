import { spawn } from 'node:child_process';
import { existsSync, rmSync, watch } from 'node:fs';
import { relative, resolve } from 'node:path';
import process from 'node:process';

const cwd = process.cwd();
const backendDir = resolve(cwd, 'apps/dev-app');
const medusaCliPath = resolve(backendDir, 'node_modules/@medusajs/cli/cli.js');
const viteCacheDir = resolve(backendDir, 'node_modules/.vite');
const projectDevSignalFile = '.plugin-dev-reload';
const watchRoot = backendDir;

if (!existsSync(backendDir)) {
  console.error('[project:dev] Backend directory not found.');
  process.exit(1);
}

if (!existsSync(medusaCliPath)) {
  console.error('[project:dev] Medusa CLI entrypoint not found.');
  process.exit(1);
}

let activeChild = null;
let isRestarting = false;
let rerunRequested = false;
let shutdownRequested = false;
let queuedReason = null;
let queuedFileName = null;
let activeFileName = null;
let debounceTimer = null;
let watcher = null;

const log = (message) => {
  console.log(`[project:dev] ${message}`);
};

const normalizePath = (value) => value.split('\\').join('/');
const pluginPackageSignalFiles = new Set([
  projectDevSignalFile,
  '.yalc/@agilo/medusa-email-templates-plugin/yalc.sig',
  'node_modules/@agilo/medusa-email-templates-plugin/yalc.sig',
]);

const isPluginPackageSignalFile = (filePath) =>
  pluginPackageSignalFiles.has(normalizePath(filePath));

const clearAdminViteCache = () => {
  if (!existsSync(viteCacheDir)) {
    return;
  }

  rmSync(viteCacheDir, { force: true, recursive: true });
  log(
    `Cleared ${relative(cwd, viteCacheDir)} to refresh plugin admin dependencies.`,
  );
};

const shouldHandlePath = (filePath) => {
  const normalized = normalizePath(filePath);

  if (!normalized || normalized === 'yalc.lock') {
    return false;
  }

  if (normalized.startsWith('.medusa/')) {
    return false;
  }

  if (normalized.startsWith('src/')) {
    return true;
  }

  if (
    normalized === 'medusa-config.ts' ||
    normalized === 'package.json' ||
    normalized === 'tsconfig.json' ||
    normalized === '.env'
  ) {
    return true;
  }

  if (isPluginPackageSignalFile(normalized)) {
    return true;
  }

  return false;
};

const startServer = () => {
  const child = spawn(process.execPath, [medusaCliPath, 'start'], {
    cwd: backendDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });

  activeChild = child;

  child.on('error', (error) => {
    console.error(`[project:dev] Server failed to start: ${error.message}`);
  });

  child.on('exit', (code, signal) => {
    if (activeChild === child) {
      activeChild = null;
    }

    if (
      !shutdownRequested &&
      !isRestarting &&
      code !== 0 &&
      signal !== 'SIGINT'
    ) {
      console.error(
        `[project:dev] Server exited unexpectedly with ${signal ? `signal ${signal}` : `exit code ${code ?? 'unknown'}`}.`,
      );
    }
  });
};

const stopServer = () =>
  new Promise((resolve) => {
    if (!activeChild) {
      resolve();
      return;
    }

    const child = activeChild;
    const finish = () => {
      clearTimeout(forceKillTimer);
      if (activeChild === child) {
        activeChild = null;
      }
      resolve();
    };

    const forceKillTimer = setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }, 10000);

    child.once('exit', finish);

    if (process.platform === 'win32') {
      child.kill('SIGTERM');
    } else {
      child.kill('SIGINT');
    }
  });

const scheduleRestart = (reason, fileName = null) => {
  queuedReason = reason;
  queuedFileName = fileName;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    // eslint-disable-next-line no-void
    void restartServer(queuedReason ?? 'file change', queuedFileName);
    queuedReason = null;
    queuedFileName = null;
  }, 1000);
};

const restartServer = async (reason, fileName = null) => {
  if (shutdownRequested) {
    return;
  }

  if (isRestarting) {
    rerunRequested = true;
    queuedReason = reason;
    queuedFileName = fileName;
    return;
  }

  isRestarting = true;
  rerunRequested = false;
  activeFileName = fileName;

  log(
    reason === 'startup'
      ? 'Starting backend dev server...'
      : `Change detected (${reason}). Restarting backend dev server...`,
  );

  try {
    if (
      reason === 'startup' ||
      (fileName && isPluginPackageSignalFile(fileName))
    ) {
      clearAdminViteCache();
    }

    if (activeChild) {
      await stopServer();
    }

    if (!shutdownRequested) {
      startServer();
    }
  } finally {
    isRestarting = false;
    activeFileName = null;

    if (rerunRequested && !shutdownRequested) {
      const rerunReason = queuedReason ?? 'queued file changes';
      const rerunFileName = queuedFileName;
      queuedReason = null;
      queuedFileName = null;
      scheduleRestart(rerunReason, rerunFileName);
    }
  }
};

const closeWatcher = () => {
  watcher?.close();
  watcher = null;
};

const requestShutdown = async (signal) => {
  if (shutdownRequested) {
    return;
  }

  shutdownRequested = true;
  log(`Stopping watcher (${signal})...`);

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  closeWatcher();
  await stopServer();
  process.exit(0);
};

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    // eslint-disable-next-line no-void
    void requestShutdown(signal);
  });
}

process.on('exit', closeWatcher);

watcher = watch(watchRoot, { recursive: true }, (eventType, filename) => {
  const name = filename ? normalizePath(filename.toString()) : null;

  if (!name || !shouldHandlePath(name)) {
    return;
  }

  if (isRestarting && name === activeFileName) {
    return;
  }

  scheduleRestart(`${eventType} ${name}`, name);
});

watcher.on('error', (error) => {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    error.code === 'ENOENT'
  ) {
    return;
  }

  console.error(`[project:dev] Watcher error: ${error.message}`);
});

log(
  `Watching ${relative(cwd, watchRoot)} for backend and plugin package changes.`,
);
await restartServer('startup');
log('Waiting for changes.');
