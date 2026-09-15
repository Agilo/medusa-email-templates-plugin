import { spawn } from 'node:child_process';
import { existsSync, statSync, watch, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';

const cwd = process.cwd();
const once = process.argv.includes('--once');
const pluginDir = resolve(cwd, 'packages/medusa-email-templates-plugin');
const backendDir = resolve(cwd, 'apps/dev-app');
const projectDevSignalPath = resolve(backendDir, '.plugin-dev-reload');
const watchTargets = ['src', 'package.json', 'tsconfig.json']
  .map((target) => resolve(pluginDir, target))
  .filter((target) => existsSync(target));
const ignoredGeneratedFiles = new Set(['admin/__admin-extensions__.js']);

const watchers = [];
let activeChild = null;
let isSyncing = false;
let rerunRequested = false;
let shutdownRequested = false;
let queuedReason = null;
let queuedFileName = null;
let activeFileName = null;
let debounceTimer = null;

const log = (message) => {
  console.log(`[plugin:dev] ${message}`);
};

const writeProjectDevSignal = () => {
  if (!existsSync(backendDir)) {
    return;
  }

  writeFileSync(
    projectDevSignalPath,
    `${Date.now()}-${Math.random()}\n`,
    'utf8',
  );
};

const runCommand = (command, args, label, { cwd: commandCwd = cwd } = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: commandCwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    activeChild = child;

    child.on('error', (error) => {
      if (activeChild === child) {
        activeChild = null;
      }
      reject(error);
    });

    child.on('exit', (code, signal) => {
      if (activeChild === child) {
        activeChild = null;
      }

      if (code === 0) {
        resolve();
        return;
      }

      const detail = signal
        ? `signal ${signal}`
        : `exit code ${code ?? 'unknown'}`;
      reject(new Error(`${label} failed with ${detail}`));
    });
  });

const scheduleSync = (reason, fileName = null) => {
  queuedReason = reason;
  queuedFileName = fileName;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    // eslint-disable-next-line no-void
    void syncPlugin(queuedReason ?? 'file change', queuedFileName);
    queuedReason = null;
    queuedFileName = null;
  }, 150);
};

const syncPlugin = async (reason, fileName = null) => {
  if (shutdownRequested) {
    return;
  }

  if (isSyncing) {
    rerunRequested = true;
    queuedReason = reason;
    queuedFileName = fileName;
    return;
  }

  isSyncing = true;
  rerunRequested = false;
  activeFileName = fileName;

  log(
    reason === 'startup'
      ? 'Initial build and local package push...'
      : `Change detected (${reason}). Rebuilding and pushing local package...`,
  );

  try {
    await runCommand('yarn', ['plugin:build'], 'yarn plugin:build', {
      cwd: pluginDir,
    });
    await runCommand(
      'yarn',
      ['yalc', 'push', '--replace'],
      'yarn yalc push --replace',
      { cwd: pluginDir },
    );
    writeProjectDevSignal();
    log('Plugin package updated for local installations.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[plugin:dev] ${message}`);
  } finally {
    isSyncing = false;
    activeFileName = null;

    if (rerunRequested && !shutdownRequested) {
      const rerunReason = queuedReason ?? 'queued file changes';
      const rerunFileName = queuedFileName;
      queuedReason = null;
      queuedFileName = null;
      scheduleSync(rerunReason, rerunFileName);
    }
  }
};

const closeWatchers = () => {
  for (const watcher of watchers) {
    watcher.close();
  }
  watchers.length = 0;
};

const requestShutdown = (signal) => {
  if (shutdownRequested) {
    return;
  }

  shutdownRequested = true;
  log(`Stopping watcher (${signal})...`);

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  closeWatchers();

  if (activeChild) {
    activeChild.kill(signal);
    return;
  }

  process.exit(0);
};

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => requestShutdown(signal));
}

process.on('exit', closeWatchers);

const watchForChanges = () => {
  for (const target of watchTargets) {
    const stats = statSync(target);
    const watcher = watch(
      target,
      { recursive: stats.isDirectory() },
      (eventType, filename) => {
        const name = filename ? filename.toString() : target;

        if (ignoredGeneratedFiles.has(name)) {
          return;
        }

        if (isSyncing && name === activeFileName) {
          return;
        }

        scheduleSync(`${eventType} ${name}`, name);
      },
    );

    watcher.on('error', (error) => {
      console.error(
        `[plugin:dev] Watcher error for ${target}: ${error.message}`,
      );
    });

    watchers.push(watcher);
  }

  log(
    `Watching ${watchTargets.map((target) => target.replace(`${pluginDir}/`, '')).join(', ')} for changes.`,
  );
};

if (watchTargets.length === 0) {
  console.error('[plugin:dev] No watch targets were found.');
  process.exit(1);
}

watchForChanges();
await syncPlugin('startup');

if (once) {
  closeWatchers();
  process.exit(0);
}

log('Waiting for changes.');
