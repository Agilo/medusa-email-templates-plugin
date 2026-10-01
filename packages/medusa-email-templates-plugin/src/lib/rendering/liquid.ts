import { Liquid } from 'liquidjs';

import { DATE_FORMAT_NAMES, formatDate, formatMoney } from './format-value';

/** Tags that read files from disk. Templates are admin-authored, not files. */
const BLOCKED_TAGS = ['include', 'render', 'layout', 'block'];

// Guards against runaway templates (liquidjs "DoS handling" options).
const PARSE_LIMIT = 1_000_000; // characters
const RENDER_LIMIT = 2_000; // ms
const MEMORY_LIMIT = 100_000_000;

const blockedTag = (name: string) => ({
  parse() {
    throw new Error(`The "${name}" tag is not allowed in email templates.`);
  },
  render() {
    throw new Error(`The "${name}" tag is not allowed in email templates.`);
  },
});

const throwOnFileAccess = () => {
  throw new Error('Email templates cannot read files.');
};

const deniedFileSystem = {
  readFile: async () => throwOnFileAccess(),
  readFileSync: () => throwOnFileAccess(),
  exists: async () => false,
  existsSync: () => false,
  contains: async () => false,
  resolve: (_dir: string, file: string) => file,
  dirname: (file: string) => file,
  sep: '/',
};

export type CreateEmailLiquidOptions = {
  escapeOutput?: boolean;
};

export const createEmailLiquid = ({
  escapeOutput = false,
}: CreateEmailLiquidOptions = {}): Liquid => {
  const liquid = new Liquid({
    strictFilters: true,
    ownPropertyOnly: true,
    relativeReference: false,
    parseLimit: PARSE_LIMIT,
    renderLimit: RENDER_LIMIT,
    memoryLimit: MEMORY_LIMIT,
    fs: deniedFileSystem,
    ...(escapeOutput ? { outputEscape: 'escape' as const } : {}),
  });

  BLOCKED_TAGS.forEach((name) => liquid.registerTag(name, blockedTag(name)));
  liquid.registerFilter('money', formatMoney);

  DATE_FORMAT_NAMES.forEach((name) => {
    liquid.registerFilter(name, (value: unknown) => formatDate(value, name));
  });

  return liquid;
};
