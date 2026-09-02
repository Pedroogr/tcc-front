# Estado atual do frontend

**Data do snapshot:** 2026-08-20
**Stack:** React 19 + TypeScript + Vite
**API:** `http://localhost:3000`
**Branch:** `master`

## O que já existe

- cadastro e login de comprador e vendedor;
- cadastro de casa de leilão por convite;
- home pública com filtros e cards de leilões;
- criação de leilão pelo escritório;
- criação, edição, imagens e revisão de lotes;
- sala do leilão com vídeo/live, lotes e lances;
- painel de compradores e aprovação de inscrições;
- vendas e meus arremates;
- perfil do usuário e do escritório;
- painel administrativo;
- componentes locais de botão, input, card, select, sheet, dialog, avatar,
  badge, skeleton e tooltip.

## Diagnóstico técnico relevante

- `src/App.tsx` tem aproximadamente 111 KB e concentra muitos fluxos;
- `src/App.css` tem aproximadamente 40 KB de estilos globais;
- Tailwind, CSS global e classes utilitárias são usados ao mesmo tempo;
- a identidade atual usa verde escuro, fundos claros, sombras e muitos
  elementos arredondados;
- o build atual passa, mas a consistência visual e a manutenção tendem a cair
  quando uma nova tela é adicionada sem tokens/componentes comuns.

## Diagnóstico visual

A interface já tem uma identidade rural/verde, mas ainda parece uma coleção de
telas de produto em vez de uma plataforma de remates com personalidade. Os
principais pontos a resolver são:

- hierarquia fraca entre ação principal, informação operacional e conteúdo
  secundário;
- excesso de superfícies, pills, sombras e bordas competindo pela atenção;
- home, formulários e sala do leilão não parecem partes do mesmo sistema;
- sala de leilão precisa priorizar vídeo, lote ativo e lance atual;
- formulários longos precisam de agrupamento, progressão e feedback mais claro;
- navegação precisa comunicar melhor o papel do usuário: comprador, vendedor,
  escritório ou administrador.

## Critério de sucesso do redesign

Uma pessoa deve conseguir responder rapidamente:

1. qual leilão está acontecendo agora;
2. qual lote está ativo e quanto custa;
3. qual é a próxima ação disponível para o papel logado;
4. onde encontrar seus lotes, vendas, inscrições ou dados da conta.

## RF06-RF10: sala em tempo real e pós-leilão (2026-09-02)

Implementados na branch `redesign/tema-escuro` (sobre a correção de sessões por aba).

- **Sessões isoladas por aba:** autenticação migrada de `localStorage` para
  `sessionStorage`, permitindo comprador e escritório logados simultaneamente.
- **RF06:** cliente único `createCommerceSocket` (em `api/socket.ts`). Enquanto a
  sala está aberta: `auction:join`, atualização anônima de `lot.currentPrice` em
  `bid:price-updated`, `lot:sold` marca o lote vendido; sem polling.
- **RF07 (privacidade):** comprador vê só o preço atual — `BidPanel` e
  `LotDetailModal` não têm histórico nem nomes. O escritório dono carrega o
  histórico nominal (`listLotBidHistory` → `OfficeBidHistory`) e o recebe ao vivo
  por `bid:office-recorded`.
- **RF08/RF09:** `DeclareWinnerPanel` usa o lance vencedor do histórico do
  escritório; `sale:won` (socket privado) dispara o toast só para o vencedor e
  atualiza "Meus arremates".
- **RF10:** `SaleRecordList` com perspectivas `office | buyer | seller`;
  `MyWinsPage` (responsável), nova `MySalesPage` (comprador, só para vendedor),
  `SalesPage` (comprador+vendedor). "Minhas vendas" no `AccountMenu` aparece
  apenas para quem tem `sellerProfile`.

### Verificação executada

- `npm run test:e2e` → 11 testes Playwright OK (`auth-ui`, `auction-commerce`,
  `post-auction`), incluindo isolamento de sessão e privacidade do comprador.
- `npm run lint` → OK. `npm run check:tokens` → OK. `npm run build` → OK
  (aviso de chunk > 500 kB é pré-existente, não é erro).
