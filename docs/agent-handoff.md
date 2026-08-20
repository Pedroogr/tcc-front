# Handoff para agentes de frontend

Este é o frontend React/Vite do projeto TCC Cattle Auction. A API está no
repositório irmão [`tcc-back`](../../tcc-back).

## Ordem de leitura

1. [`current-state.md`](current-state.md);
2. [`design-direction.md`](design-direction.md), antes de mexer na aparência;
3. [`src/App.tsx`](../src/App.tsx), para entender os fluxos e estados atuais;
4. [`src/App.css`](../src/App.css) e [`src/index.css`](../src/index.css), para
   identificar estilos existentes;
5. componentes em [`src/components`](../src/components) e tipos/API usados pela
   tela alterada.

## Regras de continuidade

- preservar os fluxos da API enquanto o visual é recriado;
- não alterar nomes de rotas, payloads ou chaves do `localStorage` sem alinhar
  com `tcc-back`;
- manter estados de loading, erro, vazio, sucesso e usuário não autenticado;
- testar desktop e mobile em cada tela principal;
- preferir tokens e componentes reutilizáveis a novos estilos isolados;
- não adicionar imagem ou fonte externa sem avaliar peso, licença e fallback;
- não incluir `.env`, `dist`, `.tmp` ou `node_modules` em commits.

## Arquitetura atual

O frontend funciona, mas `App.tsx` concentra autenticação, navegação por estado,
leilões, lotes, sala ao vivo, vendas, perfil e administração. O redesign deve
preservar esse comportamento primeiro e pode extrair componentes/páginas em
etapas, sem uma reescrita funcional desnecessária.

Há três camadas visuais misturadas:

- tokens e utilitários Tailwind 4;
- componentes locais inspirados em shadcn/Radix;
- muitas classes globais e regras legadas em `App.css`.

Antes de criar CSS novo, decidir qual camada será a fonte principal do design
system.

## Validação

```powershell
npm run build
npm run lint
npm run dev
```

O frontend espera a API em `http://localhost:3000` por meio de
`VITE_API_URL`.
