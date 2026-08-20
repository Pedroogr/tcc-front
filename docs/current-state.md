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
