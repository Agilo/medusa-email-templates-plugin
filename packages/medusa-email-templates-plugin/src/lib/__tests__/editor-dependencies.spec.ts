import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

type PackageJson = { dependencies: Record<string, string> };

const readPackage = (path: string): PackageJson =>
  JSON.parse(readFileSync(path, 'utf8')) as PackageJson;

const pluginPackage = readPackage(resolve(__dirname, '../../../package.json'));
// The editor's exports map has no "./package.json"; resolve its CommonJS entry
// (dist/index.cjs) and step up to the package root.
const editorPackage = readPackage(
  join(dirname(require.resolve('@react-email/editor')), '../package.json'),
);

// The admin imports these at runtime alongside @react-email/editor. A range
// that differs from the editor's lets a host install a second copy, and the
// editor and Inspector then read different Tiptap contexts (`editor` is null).
describe('Tiptap dependencies', () => {
  it.each(['@tiptap/pm', '@tiptap/react'])(
    'declares %s with the same range as @react-email/editor',
    (name) => {
      expect(pluginPackage.dependencies[name]).toBe(
        editorPackage.dependencies[name],
      );
    },
  );
});
