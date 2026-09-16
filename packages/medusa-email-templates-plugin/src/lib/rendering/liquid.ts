import { Liquid } from 'liquidjs';

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

const formatMoney = (value: unknown, currencyCode?: unknown): string => {
  const amount = typeof value === 'string' ? Number(value) : value;

  if (typeof amount !== 'number' || !Number.isFinite(amount)) {
    return '';
  }

  const currency =
    typeof currencyCode === 'string' && currencyCode.length === 3
      ? currencyCode.toUpperCase()
      : undefined;

  if (!currency) {
    return amount.toFixed(2);
  }

  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(
    amount,
  );
};

export type CreateEmailLiquidOptions = {
  /** HTML-escape output values. Use for HTML bodies, not for subject/text. */
  escapeOutput?: boolean;
};

/**
 * Liquid instance hardened for admin-authored templates: no file access, no
 * unknown filters, prototype properties hidden, and parse/render/memory
 * limits. liquidjs has no eval, so templates cannot execute JavaScript.
 */
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

  return liquid;
};
