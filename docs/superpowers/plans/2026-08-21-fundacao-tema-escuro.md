# Fundação do tema escuro — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estabelecer os tokens do tema escuro, a tipografia e os primitivos-base, de modo que qualquer tela migrada depois herde a hierarquia sem inventar estilo próprio.

**Architecture:** Os tokens entram pelos nomes que o shadcn já consome, então nenhum componente de `src/components/ui/` precisa mudar — só os valores em `:root`. Um script Node verifica presença de token e contraste a cada build, funcionando como o teste de regressão que o projeto não tinha. Os primitivos novos ficam em `src/design/` e consomem exclusivamente os tokens.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind 4, shadcn/Radix, @fontsource

**Spec:** [`docs/superpowers/specs/2026-08-21-redesign-tema-escuro-design.md`](../specs/2026-08-21-redesign-tema-escuro-design.md)

## Status da execução — retomada em 2026-08-21

- Tasks 1–7 implementadas: guard, tokens, documento escuro, fontes locais,
  `Money`, `Status`, `PageShell` e `Topbar`.
- A ponte transitória de `App.css` foi concluída para manter legíveis as telas
  ainda não migradas; os aliases legados saem junto com o CSS antigo.
- A extração também avançou: `AuthPage`, `OfficeInvitePage`, `HomePage` e
  `AccountDetailsPage` já substituem os blocos equivalentes de `App.tsx`.
- `npm run check:tokens`, `npm run lint` e `npm run build` passam.
- Próxima migração: `AuctionRoom`, conforme a spec.

## Global Constraints

- **Tema escuro apenas.** O claro está desenhado e reservado; não implementar.
- **Nomes de token do shadcn são imutáveis.** `--primary`, `--background`, `--muted-foreground`, `--border`, `--input`, `--ring`, `--destructive`, `--card`, `--popover`, `--secondary`, `--accent` mantêm os nomes. Só os valores mudam.
- **Nenhum arquivo em `src/components/ui/` é modificado neste plano.**
- **Contratos de API intocados:** rotas, payloads, chaves do `localStorage`, nomes de evento do socket.
- **`--price` (`#D07E4F`) é exclusivo de dinheiro.** Nenhum outro elemento usa essa cor.
- **Peso tipográfico máximo é 700**, e só em título. `font-black` não entra em código novo.
- **Todo par texto/fundo rende ao menos 4.5:1.**
- Ao fim de cada task: `npm run check:tokens`, `npm run lint` e `npm run build` passam.

**Escopo deste plano:** tokens, tipografia e quatro primitivos — `Money`, `Status`, `PageShell` e `Topbar`.

A spec lista nove primitivos. Os outros cinco ficam de fora deliberadamente, por dois motivos distintos: `Button`, `Field` e `Card` **já existem** em `src/components/ui/` e passam a se comportar corretamente só com os tokens novos, sem código novo; `DataTable`, `SectionHeader` e `EmptyState` são melhor desenhados junto da primeira tela que os consome, e criá-los antes disso é adivinhar a interface.

A extração das 8 views de `App.tsx` ganha um plano próprio, escrito depois que esta fundação existir.

---

### Task 1: Guard de tokens e contraste

O teste vem antes dos tokens. Ele falha porque `tokens.css` ainda não existe.

**Files:**
- Create: `scripts/check-tokens.mjs`
- Modify: `package.json` (bloco `scripts`)

**Interfaces:**
- Consumes: nada
- Produces: comando `npm run check:tokens`, que sai com código 1 e um relatório quando falta token ou um par reprova em contraste. As tasks seguintes dependem dele como porta de verificação.

- [ ] **Step 1: Escrever o guard**

Create `scripts/check-tokens.mjs`:

```js
// Verifica a fundação de cor do tema escuro:
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
```

- [ ] **Step 2: Registrar o script**

Modify `package.json`, no bloco `scripts`, adicionando a linha após `"lint"`:

```json
"check:tokens": "node scripts/check-tokens.mjs",
```

- [ ] **Step 3: Rodar e confirmar que falha**

```bash
npm run check:tokens --prefix tcc-front
```

Esperado: FALHA com `bloco :root nao encontrado` ou erro de arquivo inexistente — `src/design/tokens.css` ainda não existe. Se passar, algo está errado.

- [ ] **Step 4: Commit**

```bash
git add scripts/check-tokens.mjs package.json
git commit -m "test: adiciona guard de tokens e contraste do tema escuro"
```

---

### Task 2: Tokens do tema escuro

**Files:**
- Create: `src/design/tokens.css`
- Modify: `src/index.css` (bloco `:root` inteiro, linhas 34–76)

**Interfaces:**
- Consumes: `npm run check:tokens` da Task 1
- Produces: todos os tokens listados em REQUIRED, disponíveis como variáveis CSS globais e como utilitários Tailwind via o `@theme inline` já existente em `index.css`

- [ ] **Step 1: Criar o arquivo de tokens**

Create `src/design/tokens.css`:

```css
/* Fundacao de cor do tema escuro.
   Os nomes seguem o contrato do shadcn — src/components/ui/ depende deles.
   Verificado por scripts/check-tokens.mjs. */
:root {
  --background: #0b120f;
  --foreground: #e9efeb;
  --card: #121b17;
  --card-foreground: #e9efeb;
  --popover: #18231e;
  --popover-foreground: #e9efeb;
  --primary: #3fa47b;
  --primary-foreground: #07110c;
  --secondary: #18231e;
  --secondary-foreground: #e9efeb;
  --muted: #18231e;
  --muted-foreground: #9daaa3;
  --accent: #18231e;
  --accent-foreground: #e9efeb;
  --destructive: #f0483b;
  --border: #24312b;
  --input: #33423a;
  --ring: #3fa47b;
  --live: #f0483b;
  --scheduled: #d8b673;

  /* Fora do contrato shadcn */
  --price: #d07e4f;
  --success: #4fb683;
  --text-subtle: #84918a;
  --brand-tint: #14281f;
  --brand-line: #2a4a39;
  --placeholder: #7c8b83;

  --radius: 12px;

  --font-display: 'Archivo Variable', 'Helvetica Neue', Arial, sans-serif;
  --font-sans: 'IBM Plex Sans', system-ui, -apple-system, sans-serif;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
}
```

- [ ] **Step 2: Ligar os tokens ao index.css**

Modify `src/index.css`. Trocar a linha 2 e o bloco `:root` inteiro.

Após `@import "tailwindcss";` adicionar:

```css
@import "./design/tokens.css";
```

Depois **remover** todo o bloco `:root { ... }` existente (as declarações de cor clara, `--brand`, `--shadow`, `--bg`, etc.) e substituir por:

```css
:root {
  color-scheme: dark;
  color: var(--foreground);
  background: var(--background);
  font-family: var(--font-sans);
  font-synthesis: none;
  line-height: 1.5;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

O gradiente radial de três camadas do fundo antigo sai: a spec pede fundo calmo e uma superfície por seção.

No bloco `@theme inline`, adicionar as três linhas de token novo após `--color-scheduled`:

```css
  --color-price: var(--price);
  --color-success: var(--success);
  --color-text-subtle: var(--text-subtle);
```

- [ ] **Step 3: Rodar o guard e confirmar que passa**

```bash
npm run check:tokens --prefix tcc-front
```

Esperado: PASSA, com 14 linhas `ok` e `27 tokens presentes, 14 pares em AA.`

- [ ] **Step 4: Confirmar build e lint**

```bash
npm run lint --prefix tcc-front && npm run build --prefix tcc-front
```

Esperado: ambos passam. `App.css` ainda referencia variáveis antigas (`--brand`, `--shadow`) que agora não existem — isso é esperado e não quebra o build; essas regras morrem junto com cada tela migrada.

- [ ] **Step 5: Commit**

```bash
git add src/design/tokens.css src/index.css
git commit -m "feat: tokens do tema escuro pelos nomes do contrato shadcn"
```

---

### Task 3: Ativar o tema escuro no documento

Sem a classe `dark` os 10 utilitários `dark:` de `button`, `badge`, `input`, `select` e `dropdown-menu` nunca disparam, porque `index.css` declara `@custom-variant dark (&:is(.dark *))`.

**Files:**
- Modify: `index.html` (linha 2 e `<head>`)

**Interfaces:**
- Consumes: tokens da Task 2
- Produces: `<html class="dark">`, do qual todo utilitário `dark:` da árvore depende

- [ ] **Step 1: Editar o documento**

Modify `index.html`. Trocar a linha 2:

```html
<html lang="pt-BR" class="dark">
```

E adicionar dentro de `<head>`, após a tag `<meta name="viewport">`:

```html
    <meta name="color-scheme" content="dark" />
```

Três mudanças, cada uma com um motivo distinto: `class="dark"` faz os utilitários `dark:` resolverem; `color-scheme` faz barra de rolagem e controles nativos renderizarem escuros, eliminando o flash branco no carregamento; `lang="pt-BR"` corrige leitor de tela e hifenização numa aplicação inteiramente em português.

- [ ] **Step 2: Verificar no navegador**

```bash
npm run dev --prefix tcc-front
```

Abrir `http://localhost:5173`. Esperado: fundo escuro, sem flash branco ao recarregar, barra de rolagem escura. A tela de acesso ainda está com o layout antigo — só as cores mudaram. Isso é o esperado nesta task.

- [ ] **Step 3: Confirmar build**

```bash
npm run lint --prefix tcc-front && npm run build --prefix tcc-front
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: ativa tema escuro e corrige lang do documento"
```

---

### Task 4: Tipografia

**Files:**
- Modify: `package.json` (dependências)
- Modify: `src/main.tsx` (imports de fonte)
- Modify: `src/index.css` (classes utilitárias de tipo)

**Interfaces:**
- Consumes: `--font-display`, `--font-sans`, `--font-mono` da Task 2
- Produces: as famílias carregadas localmente e as classes `.t-display`, `.t-section`, `.t-label`, `.t-price`, `.t-mono` disponíveis globalmente

- [ ] **Step 1: Instalar as fontes**

```bash
npm install --prefix tcc-front @fontsource-variable/archivo@5.3.0 @fontsource/ibm-plex-sans@5.3.0 @fontsource/ibm-plex-mono@5.3.0
```

Pacotes npm, não `<link>` do Google Fonts: a demonstração do TCC não pode depender de rede.

- [ ] **Step 2: Importar só os pesos usados**

Modify `src/main.tsx`, adicionando no topo, antes do import de `index.css`:

```ts
import '@fontsource-variable/archivo';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/500.css';
```

Archivo é variável, então um import cobre toda a faixa de peso. Da Plex Sans entram só 400, 500 e 600 — 700 não é usado, porque título é Archivo.

- [ ] **Step 3: Declarar a escala**

Modify `src/index.css`, adicionando ao final do arquivo:

```css
/* Escala tipografica — ver a spec do redesign.
   Peso maximo e 700, e so em titulo. font-black nao entra em codigo novo. */
.t-display {
  font-family: var(--font-display);
  font-size: 2.625rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: 1.08;
}

.t-section {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.015em;
  line-height: 1.2;
}

.t-label {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-subtle);
}

.t-price {
  font-size: 2.125rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--price);
  font-variant-numeric: tabular-nums;
}

.t-mono {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 500;
}
```

`tabular-nums` em `.t-price` não é estético: sem ele os dígitos têm larguras diferentes e o valor treme a cada lance recebido pelo socket.

- [ ] **Step 4: Verificar no navegador**

```bash
npm run dev --prefix tcc-front
```

Esperado: o texto da tela de acesso passa a renderizar em IBM Plex Sans, não mais em Inter. Confirmar na aba Network que nenhuma requisição sai para `fonts.googleapis.com`.

- [ ] **Step 5: Medir o custo no bundle**

```bash
npm run build --prefix tcc-front
```

Anotar o tamanho total de `dist/assets`. Se as fontes somarem mais de 200 KB, remover o peso 500 da Plex Sans e usar 400 e 600 apenas.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/main.tsx src/index.css
git commit -m "feat: Archivo e IBM Plex locais, com escala tipografica"
```

---

### Task 5: Primitivo Money

Preço aparece em oito telas. É o único lugar onde `--price` e `tabular-nums` podem ser esquecidos sem ninguém notar até a apresentação.

**Files:**
- Create: `src/design/primitives/Money.tsx`

**Interfaces:**
- Consumes: `--price`, `.t-price` das Tasks 2 e 4
- Produces: `<Money value={number | string | null} size="sm" | "md" | "lg" muted?: boolean />`, renderizando um `<span>`. `size` default `"md"`. `muted` troca a cor por `--muted-foreground`, para valores históricos que não são o lance atual.

- [ ] **Step 1: Escrever o componente**

Create `src/design/primitives/Money.tsx`:

```tsx
import { cn } from '@/lib/utils';

type MoneySize = 'sm' | 'md' | 'lg';

type MoneyProps = {
  value?: number | string | null;
  size?: MoneySize;
  muted?: boolean;
  className?: string;
};

const sizeClasses: Record<MoneySize, string> = {
  sm: 'text-sm font-medium',
  md: 'text-[1.3125rem] font-semibold -tracking-[0.015em]',
  lg: 'text-[2.125rem] font-semibold -tracking-[0.02em] leading-[1.05]',
};

// Formatador criado uma vez — Intl.NumberFormat e caro para instanciar por render.
const formatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function Money({ value, size = 'md', muted = false, className }: MoneyProps) {
  const numeric = typeof value === 'string' ? Number(value) : value;

  if (numeric === null || numeric === undefined || Number.isNaN(numeric)) {
    return (
      <span className={cn(sizeClasses[size], 'text-muted-foreground', className)}>
        &mdash;
      </span>
    );
  }

  return (
    <span
      className={cn(
        sizeClasses[size],
        muted ? 'text-muted-foreground' : 'text-price',
        'tabular-nums',
        className,
      )}
    >
      {formatter.format(numeric)}
    </span>
  );
}
```

O caso nulo devolve um travessão em vez de `R$ 0,00`: lote sem lance e lote com lance de zero são estados diferentes, e a tela precisa distingui-los.

- [ ] **Step 2: Confirmar que `text-price` existe como utilitário**

O utilitário vem de `--color-price: var(--price)` no `@theme inline`, adicionado na Task 2. Confirmar:

```bash
grep -n "color-price" src/index.css
```

Esperado: uma linha. Se não houver, voltar à Task 2 Step 2.

- [ ] **Step 3: Verificar build e lint**

```bash
npm run lint --prefix tcc-front && npm run build --prefix tcc-front
```

Esperado: ambos passam. O componente ainda não é usado por ninguém — isso é esperado; ele entra em uso na Task 7 e na migração das telas.

- [ ] **Step 4: Commit**

```bash
git add src/design/primitives/Money.tsx
git commit -m "feat: primitivo Money com cor e algarismos tabulares"
```

---

### Task 6: Primitivo Status

`badge.tsx` traz `rounded-full` embutido. A spec pede 6 px e proíbe pílula em status, então este primitivo encapsula a sobrescrita num lugar só.

**Files:**
- Create: `src/design/primitives/Status.tsx`

**Interfaces:**
- Consumes: tokens `--live`, `--scheduled`, `--success`, `--muted`, `--destructive` da Task 2
- Produces: `<Status kind={StatusKind} />` onde `StatusKind = 'live' | 'scheduled' | 'approved' | 'finished' | 'blocked'`. Renderiza um `<span>` com rótulo em português e, para `live`, um ponto pulsante.

- [ ] **Step 1: Escrever o componente**

Create `src/design/primitives/Status.tsx`:

```tsx
import { cn } from '@/lib/utils';

export type StatusKind = 'live' | 'scheduled' | 'approved' | 'finished' | 'blocked';

type StatusProps = {
  kind: StatusKind;
  className?: string;
};

const config: Record<StatusKind, { label: string; classes: string }> = {
  live: { label: 'AO VIVO', classes: 'bg-live text-white' },
  scheduled: { label: 'AGENDADO', classes: 'bg-[#241c0c] border border-[#46381a] text-scheduled' },
  approved: { label: 'APROVADO', classes: 'bg-brand-tint border border-brand-line text-success' },
  finished: { label: 'ENCERRADO', classes: 'bg-muted border border-input text-muted-foreground' },
  blocked: { label: 'BLOQUEADO', classes: 'bg-[#2a1210] border border-[#5c2621] text-[#f0776c]' },
};

export function Status({ kind, className }: StatusProps) {
  const { label, classes } = config[kind];

  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-[6px] px-2.5',
        'text-[11px] font-semibold tracking-[0.06em]',
        classes,
        className,
      )}
    >
      {kind === 'live' && (
        <span className="size-1.5 rounded-full bg-current motion-safe:animate-pulse" />
      )}
      {label}
    </span>
  );
}
```

`rounded-[6px]` literal, e não `rounded-md`: com `--radius: 12px` o `md` resolve para 8 px, e a spec pede 6 px em status. Este é o único lugar do sistema que se afasta da escala derivada, e é intencional — status precisa ler mais duro que botão.

`motion-safe:` respeita `prefers-reduced-motion`, conforme a spec.

- [ ] **Step 2: Confirmar os utilitários de token**

```bash
grep -n "color-live\|color-scheduled\|color-success" src/index.css
```

Esperado: três linhas. `bg-brand-tint` e `border-brand-line` exigem duas entradas a mais no `@theme inline` de `index.css`:

```css
  --color-brand-tint: var(--brand-tint);
  --color-brand-line: var(--brand-line);
```

Adicionar se ausentes, e rodar `npm run check:tokens` de novo para confirmar que nada regrediu.

- [ ] **Step 3: Verificar build e lint**

```bash
npm run lint --prefix tcc-front && npm run build --prefix tcc-front
```

- [ ] **Step 4: Commit**

```bash
git add src/design/primitives/Status.tsx src/index.css
git commit -m "feat: primitivo Status sem pilula, com estados do remate"
```

---

### Task 7: PageShell e Topbar

Primeira tela real usando a fundação. É aqui que se descobre se os tokens funcionam em uso, antes de migrar oito views.

**Files:**
- Create: `src/design/layout/PageShell.tsx`
- Create: `src/design/layout/Topbar.tsx`

**Interfaces:**
- Consumes: tokens das Tasks 2 e 4, `Status` da Task 6
- Produces: `<PageShell topbar={ReactNode} children={ReactNode} />` e `<Topbar brand nav account />`, ambos consumidos pelas páginas na migração seguinte

- [ ] **Step 1: Escrever o PageShell**

Create `src/design/layout/PageShell.tsx`:

```tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PageShellProps = {
  topbar?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function PageShell({ topbar, children, className }: PageShellProps) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {topbar}
      <main className={cn('mx-auto w-full max-w-[1360px] px-8 py-9', className)}>
        {children}
      </main>
    </div>
  );
}
```

`min-h-dvh` em vez de `min-h-screen`: em navegador mobile a barra de endereço muda a altura da viewport, e `vh` deixa um vão no rodapé.

- [ ] **Step 2: Escrever o Topbar**

Create `src/design/layout/Topbar.tsx`:

```tsx
import type { ReactNode } from 'react';

type TopbarProps = {
  brand: ReactNode;
  nav?: ReactNode;
  account?: ReactNode;
};

export function Topbar({ brand, nav, account }: TopbarProps) {
  return (
    <header className="flex h-15 items-center justify-between gap-8 border-b border-border bg-card px-8">
      <div className="flex items-center gap-8">
        {brand}
        {nav && <nav className="flex items-center gap-1">{nav}</nav>}
      </div>
      {account}
    </header>
  );
}
```

- [ ] **Step 3: Confirmar a altura**

`h-15` não é uma classe padrão do Tailwind. Confirmar que resolve para 60 px:

```bash
npm run build --prefix tcc-front
```

Se o build reclamar de classe desconhecida, trocar por `h-[60px]`. Tailwind 4 gera a escala dinamicamente, mas o comportamento precisa ser confirmado no build, não presumido.

- [ ] **Step 4: Verificar build e lint**

```bash
npm run lint --prefix tcc-front && npm run build --prefix tcc-front
```

- [ ] **Step 5: Commit**

```bash
git add src/design/layout/PageShell.tsx src/design/layout/Topbar.tsx
git commit -m "feat: PageShell e Topbar sobre os tokens do tema escuro"
```

---

## Definição de pronto

A fundação está completa quando:

- `npm run check:tokens`, `npm run lint` e `npm run build` passam;
- a aplicação abre escura, sem flash branco, com fontes locais;
- nenhuma requisição sai para `fonts.googleapis.com`;
- `src/components/ui/` não foi modificado;
- `Money`, `Status`, `PageShell` e `Topbar` existem e compilam.

A seguir: plano de extração das views de `App.tsx`, começando por `Acesso`.
