# Redesign do frontend — tema escuro

**Data:** 2026-08-21
**Escopo:** fundação visual + extração de `App.tsx`, tema escuro apenas
**Canvas de referência:** https://claude.ai/code/artifact/4cfa41db-ff48-4e27-b5bd-bcb5198cfebf

## Objetivo

Recriar a camada visual do frontend como um sistema único e escuro, e dissolver
o `App.tsx` de 111 KB em páginas, sem alterar nenhum contrato da API.

O critério de sucesso é o do `current-state.md`: uma pessoa deve conseguir
responder em segundos qual leilão está acontecendo, qual lote está ativo e
quanto custa, e qual é a próxima ação disponível para o papel dela.

## Diagnóstico

Três causas, nesta ordem de impacto:

1. **Peso tipográfico uniforme.** `font-black` (900) aparece em rótulo, valor,
   botão e título ao mesmo tempo. Sem variação de peso não existe hierarquia,
   e é o que faz a interface parecer "sem sal" mesmo com as cores certas.
2. **Forma sem escala.** Cards em `border-radius: 20px`, botões em
   `rounded-full`, sombras de 30–40 px. Lê como landing page, não como
   ferramenta de operação de remate.
3. **Três camadas de estilo concorrentes.** Tailwind 4, componentes shadcn e
   310 classes globais em `App.css` (40 KB) descrevem a mesma tela. Cada tela
   nova nasce num dialeto diferente porque não há fonte única de verdade.

## Decisões fechadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Identidade | Verde mantido | Continuidade com o que já foi apresentado |
| Tema | **Escuro apenas** | Claro fica desenhado e reservado, sem custo de tema duplo |
| Navegação | Continua por `useState` | Trocar por router é mudança independente do visual |
| `components/ui/` | Preservado | Resolve acessibilidade de dialog/select/tooltip |
| Contratos de API | Intocados | Exigência do `agent-handoff.md` |

## Sistema visual

### Tokens

Os tokens entram **pelos nomes que o shadcn já consome**. Trocar os nomes
quebraria os 12 componentes de `src/components/ui/` de uma vez, então só os
valores mudam. `src/index.css` é reescrito; nenhum componente de `ui/` é tocado
nesta etapa.

| Token (existente) | Valor novo | Uso |
|---|---|---|
| `--background` | `#0B120F` | Fundo da aplicação |
| `--foreground` | `#E9EFEB` | Texto principal |
| `--card` | `#121B17` | Superfície de card e painel |
| `--card-foreground` | `#E9EFEB` | Texto sobre card |
| `--popover` | `#18231E` | Menu, dropdown, dialog |
| `--popover-foreground` | `#E9EFEB` | Texto sobre popover |
| `--primary` | `#3FA47B` | Verde da marca, clareado |
| `--primary-foreground` | `#07110C` | Texto sobre o verde |
| `--secondary` | `#18231E` | Botão secundário e superfície 2 |
| `--secondary-foreground` | `#E9EFEB` | Texto sobre secundário |
| `--muted` | `#18231E` | Fundo de bloco de dado |
| `--muted-foreground` | `#9DAAA3` | Texto de apoio |
| `--accent` | `#18231E` | Fundo de hover |
| `--accent-foreground` | `#E9EFEB` | Texto em hover |
| `--destructive` | `#F0483B` | Ação destrutiva e erro |
| `--border` | `#24312B` | Divisor e contorno de superfície |
| `--input` | `#33423A` | Contorno de campo |
| `--ring` | `#3FA47B` | Anel de foco |
| `--live` | `#F0483B` | Estado ao vivo |
| `--scheduled` | `#D8B673` | Estado agendado |
| `--radius` | `12px` | Era 18px |

Tokens novos, que não existem no contrato shadcn:

| Token | Valor | Uso |
|---|---|---|
| `--price` | `#D07E4F` | **Exclusivo de dinheiro** — preço e lance, nada mais |
| `--success` | `#4FB683` | Aprovado, arrematado, conexão estável |
| `--text-subtle` | `#84918A` | Rótulos em caixa alta de 11px |
| `--brand-tint` | `#14281F` | Fundo de destaque de marca |
| `--brand-line` | `#2A4A39` | Contorno de destaque de marca |
| `--placeholder` | `#7C8B83` | Placeholder e desabilitado |

**A regra do cobre:** `--price` é a única cor de `#D07E4F` na interface. Se
qualquer outro elemento usar essa cor, o preço deixa de ser encontrável de
relance e o token perde a função.

Por que o verde muda de `#126246` para `#3FA47B`: o original rende 2.58:1 sobre
`#0B120F` — reprova até o mínimo de 3:1 exigido para componente gráfico, e fica
muito abaixo do 4.5:1 de texto. `#3FA47B` rende 6.15:1.

### Escala de raio

`--radius: 12px` faz a escala derivada de `index.css` cair em 6 / 8 / 12 / 16 /
20 px. Botões usam `rounded-md` (8 px). Status usam 6 px e **deixam de ser
pílula** — `badge.tsx` traz `rounded-full` embutido, então cada uso passa a
sobrescrever com `rounded-md`.

### Tipografia

Archivo para títulos, IBM Plex Sans para dados e interface, IBM Plex Mono para
códigos de lote e horários. Ambas SIL OFL.

Instalação por pacote npm (`@fontsource-variable/archivo`, `@fontsource/ibm-plex-sans`,
`@fontsource/ibm-plex-mono`), não por `<link>` do Google Fonts: a demonstração
do TCC não pode depender de rede, e o handoff exige avaliar peso e fallback.
Importar só os pesos usados — 400/500/600 da Plex Sans, 700 da Archivo,
500 da Mono.

| Papel | Fonte | Tamanho / peso |
|---|---|---|
| Título de página | Archivo | 42 / 700, `-0.025em` |
| Título de seção | Archivo | 24–26 / 700, `-0.015em` |
| Título de item | Plex Sans | 16 / 600 |
| Corpo | Plex Sans | 14 / 400, altura 1.6 |
| Rótulo | Plex Sans | 11 / 600, caixa alta, `+0.1em` |
| Preço | Plex Sans | 34 / 600, `tabular-nums` |
| Código, hora | Plex Mono | 12 / 500 |

`font-black` sai por completo. O peso máximo passa a ser 700, e só em título.

`tabular-nums` no preço não é detalhe estético: sem ele os dígitos têm larguras
diferentes e o valor treme a cada lance recebido pelo socket.

### Movimento

Entrada suave de seção, destaque breve no valor ao mudar de lance, transições
rápidas em drawer e modal. `prefers-reduced-motion` respeitado. `motion` já é
dependência do projeto.

## Arquitetura

```
src/design/
  tokens.css          # reescreve o :root de index.css
  primitives/         # Button, Field, Badge, Status, Money,
                      # Card, DataTable, SectionHeader, EmptyState
  layout/             # PageShell, Topbar, Nav
src/pages/            # uma view por arquivo, extraídas de App.tsx
```

`Money` existe como componente próprio porque preço aparece em oito telas e é o
único lugar onde `--price` e `tabular-nums` podem ser aplicados por engano ou
esquecidos.

### Mudanças em `index.html`

Três, todas necessárias para o tema escuro:

1. `<html lang="pt-BR" class="dark">` — a classe é obrigatória. O
   `@custom-variant dark (&:is(.dark *))` já declarado em `index.css` faz os 10
   utilitários `dark:` de `button`, `badge`, `input`, `select` e
   `dropdown-menu` só resolverem sob um ancestral `.dark`. Sem a classe, esses
   cinco componentes ficam com estados de borda e fundo errados.
2. `<meta name="color-scheme" content="dark">` — sem isso, barra de rolagem,
   controles nativos e o fundo padrão do navegador continuam claros, e há um
   flash branco no carregamento.
3. `lang` de `en` para `pt-BR` — a aplicação é inteiramente em português;
   afeta leitor de tela e hifenização.

Quando o tema claro entrar, a classe `dark` passa a ser alternada em vez de
fixa, e os valores escuros migram de `:root` para um bloco `.dark`. Nenhum
componente muda.

## Estratégia de migração

Strangler por tela. O app fica funcionando o tempo todo e é possível parar em
qualquer ponto com metade migrada sem nada quebrado.

1. `src/design/tokens.css` e as três mudanças de `index.html`
2. Primitivos e layout
3. `Acesso` (login/cadastro)
4. `Home`
5. `AuctionRoom`
6. `RegisterLot`, `CreateAuction`
7. `Sales`, `MyWins`
8. `AccountDetails`, `SellerProfile`
9. `admin/AdminApp.tsx`

Cada extração leva junto o bloco de `App.css` que aquela tela usava. `App.css`
encolhe por consequência da migração, nunca por uma limpeza separada — e só é
apagado quando chegar a zero regras referenciadas.

## Contratos preservados

Não mudam, em nenhuma etapa: rotas da API, formato de payload, chaves do
`localStorage`, nomes de evento do socket, e os estados de loading, erro, vazio,
sucesso e não-autenticado de cada tela.

## Fora de escopo

- Tema claro — desenhado e reservado, não implementado.
- React Router — a navegação continua por `useState`.
- Redesenho de **fluxo**. Formulários longos e o painel administrativo recebem
  o visual novo, mas a sequência de passos e os campos continuam os mesmos.
  Repensar o fluxo de cadastro de lote é trabalho separado.
- Mudanças no `tcc-back`.

## Critérios de aceite

Cada etapa só está pronta quando:

- `npm run build` e `npm run lint` passam;
- a ação principal da tela é identificável em poucos segundos;
- nenhum `font-black` restou na tela migrada;
- não há mistura de raio, sombra ou estilo de botão;
- loading, erro, vazio e sucesso têm aparência definida;
- a tela funciona em 320 px, 768 px e desktop;
- foco de teclado visível em todo controle interativo;
- todo par texto/fundo rende ao menos 4.5:1;
- o fluxo real contra a API continua funcionando.

Os valores da paleta já foram verificados. O par mais apertado é `--placeholder`
sobre `--muted`, em 4.53:1 — passa, mas sem folga, então qualquer ajuste nesses
dois tokens precisa ser remedido.

## Riscos

| Risco | Mitigação |
|---|---|
| `App.tsx` tem estado compartilhado entre views | Extrair a view mas manter o estado em `App.tsx`, passando por props, antes de considerar mover o estado |
| Regra de `App.css` usada por mais de uma tela | Duplicar no primitivo antes de remover do global; só apagar quando a última consumidora migrar |
| `dark:` de shadcn sem a classe `.dark` | Coberto pela mudança 1 em `index.html`, que é a primeira etapa da migração |
| Fonte nova aumenta o bundle | Só os pesos usados; medir o build depois da etapa 1 |
