// Verifica a fundacao de cor do tema escuro:
// 1. todo token exigido existe em src/design/tokens.css
// 2. todo par texto/fundo documentado rende >= 4.5:1 (WCAG AA, texto normal)
import { readFileSync } from 'node:fs';

const TOKENS_PATH = new URL('../src/design/tokens.css', import.meta.url);

const REQUIRED = [
  'background', 'foreground', 'card', 'card-foreground',
  'popover', 'popover-foreground', 'primary', 'primary-foreground',
  'secondary', 'secondary-foreground', 'muted', 'muted-foreground',
  'accent', 'accent-foreground', 'destructive', 'border', 'input', 'ring',
  'live', 'scheduled', 'radius',
  'price', 'success', 'text-subtle', 'brand-tint', 'brand-line', 'placeholder',
];

// [token de texto, token de fundo]
const PAIRS = [
  ['foreground', 'background'],
  ['foreground', 'card'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['text-subtle', 'card'],
  ['text-subtle', 'background'],
  ['price', 'muted'],
  ['price', 'card'],
  ['success', 'brand-tint'],
  ['primary', 'background'],
  ['primary-foreground', 'primary'],
  ['destructive', 'background'],
  ['placeholder', 'muted'],
  ['placeholder', 'background'],
];

const MIN_RATIO = 4.5;

function parseTokens(css) {
  const root = css.match(/:root\s*\{([\s\S]*?)\n\}/);
  if (!root) throw new Error('bloco :root nao encontrado em tokens.css');
  const found = new Map();
  for (const line of root[1].split('\n')) {
    const m = line.match(/^\s*--([a-z0-9-]+)\s*:\s*([^;]+);/i);
    if (m) found.set(m[1], m[2].trim());
  }
  return found;
}

function luminance(hex) {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const failures = [];
let tokens;

try {
  tokens = parseTokens(readFileSync(TOKENS_PATH, 'utf8'));
} catch (error) {
  console.error(`FALHA: ${error.message}`);
  process.exit(1);
}

for (const name of REQUIRED) {
  if (!tokens.has(name)) failures.push(`token ausente: --${name}`);
}

for (const [fg, bg] of PAIRS) {
  const a = tokens.get(fg);
  const b = tokens.get(bg);
  if (!a || !b) continue;
  if (!/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) {
    failures.push(`par --${fg} / --${bg}: esperado hex de 6 digitos`);
    continue;
  }
  const ratio = contrast(a, b);
  const label = `--${fg} sobre --${bg}`;
  if (ratio < MIN_RATIO) {
    failures.push(`contraste ${ratio.toFixed(2)}:1 (minimo ${MIN_RATIO}) em ${label}`);
  } else {
    console.log(`ok  ${ratio.toFixed(2).padStart(5)}:1  ${label}`);
  }
}

if (failures.length > 0) {
  console.error(`\n${failures.length} falha(s):`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}

console.log(`\nok: ${REQUIRED.length} tokens presentes, ${PAIRS.length} pares em AA.`);
