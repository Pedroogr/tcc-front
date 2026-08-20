# Direção proposta para o redesign

## Objetivo

Recriar o frontend como uma plataforma de remates rurais com aparência mais
editorial, confiável e operacional. A sensação desejada é de produto premium
para agronegócio, não de template genérico com cards arredondados.

## Direção visual

**Rural premium + marketplace ao vivo.**

- base quente: marfim/areia em vez de branco azulado;
- contraste: verde floresta quase preto para navegação e títulos;
- acento de ação: cobre/terracota para preço, lance e chamadas importantes;
- verde vivo reservado para estados positivos e disponibilidade;
- tipografia com uma fonte de display para títulos e uma sans neutra para dados;
- menos pills e menos sombras; usar borda, escala e espaço para hierarquia;
- raio consistente, preferencialmente médio, com exceção de avatares e chips de
  status;
- fotografia de gado, campo e leilão somente onde reforçar contexto, não como
  decoração em toda tela.

## Estrutura de telas

### Acesso

Layout dividido: formulário compacto de um lado e painel visual/editorial do
outro. O cadastro deve parecer uma entrada na plataforma, não um formulário
solto no centro da página.

### Home

Trocar uma grade genérica por:

1. hero do leilão em destaque;
2. faixa de métricas rápidas;
3. leilões ao vivo e próximos;
4. lotes recomendados ou recém-publicados;
5. ações específicas do papel logado.

### Sala do leilão

O vídeo é o elemento dominante. Ao lado dele ficam o lote ativo, preço atual,
incremento, ação de lance e estado de conexão. A fila de lotes deve ser
secundária, mas sempre visível em desktop.

### Formulários

Usar seções curtas com títulos claros, duas colunas quando houver espaço,
resumo persistente e feedback contextual. Upload de imagem deve mostrar
preview, estado e ação de remoção sem ocupar a tela inteira.

### Dados e conta

Preferir tabelas/listas densas e escaneáveis para vendas, arremates e inscrições;
reservar cards grandes para resumo, não para cada linha de informação.

## Sistema de design a criar

- tokens de cor, superfície, texto, borda, foco e status;
- escala tipográfica e espaçamento;
- `Button`, `Badge`, `Card`, `Field`, `EmptyState`, `Status`, `DataTable`,
  `SectionHeader` e `PageShell` com variantes coerentes;
- estados de loading, erro, vazio, sucesso, offline e live;
- breakpoints e navegação mobile definidos antes de estilizar cada tela;
- regras de uso para ícones, imagens, animações e foco acessível.

## Decisões visuais desta sessão

Estas decisões são o ponto de partida do redesign e devem permanecer juntas
enquanto as telas forem refeitas:

### Hierarquia

- cada tela terá uma ação principal evidente;
- preço, lote ativo, status LIVE e conexão terão prioridade visual sobre textos
  auxiliares;
- informações secundárias serão organizadas em listas, tabelas ou painéis
  recolhíveis;
- títulos de página explicarão a tarefa, não apenas o nome do recurso.

### Superfícies e formas

- fundo geral quente e calmo;
- uma superfície principal por seção, evitando uma sequência de cards dentro de
  cards;
- bordas suaves para separar áreas e sombras somente quando houver elevação
  real;
- botões principais sólidos, secundários contidos e ações perigosas claramente
  distintas;
- pills somente para status, filtros e estados compactos.

### Conteúdo visual

- hero com imagem de contexto apenas na entrada e nos leilões em destaque;
- cards de lote devem priorizar foto, código, categoria, quantidade e preço;
- estados sem conteúdo devem orientar a próxima ação, não apenas dizer que a
  lista está vazia;
- loading deve preservar o desenho da tela com skeletons, evitando saltos de
  layout.

### Movimento

- entrada suave de seções e feedback de ação;
- mudança de lance com destaque breve no valor, sem animação chamativa demais;
- transições rápidas em drawers, modais e troca de lotes;
- respeitar `prefers-reduced-motion`.

## Backlog visual priorizado

### P0 — fundação

- definir tokens de cor, tipografia, espaçamento, raio e sombra;
- escolher uma família tipográfica de display e uma sans para dados;
- criar `PageShell`, `Topbar`, `SectionHeader`, `Button`, `Field`, `Badge` e
  `Status`;
- estabelecer navegação desktop e mobile;
- criar estados padrão de loading, erro e vazio.

### P1 — primeira impressão

- refazer login/cadastro;
- refazer header e home;
- criar hero de leilão em destaque;
- reorganizar cards de leilão e lotes;
- garantir responsividade em 320 px, 768 px e desktop.

### P2 — operação do remate

- refazer sala ao vivo com vídeo dominante;
- destacar lote ativo, preço, incremento e lance;
- organizar fila de lotes e painel de compradores;
- melhorar confirmação visual de lance, conexão e vencedor.

### P3 — backoffice

- refazer criação de leilão e cadastro de lote;
- melhorar upload e gerenciamento de imagens;
- organizar vendas, arremates, conta e administração em listas densas;
- extrair as telas restantes de `App.tsx` sem alterar os contratos da API.

## Critérios de aceite visual

Uma etapa só está pronta quando:

- a ação principal é identificável em poucos segundos;
- não há mistura acidental de raios, sombras ou estilos de botão;
- loading, erro, vazio e sucesso têm aparência prevista;
- a tela continua utilizável em mobile;
- foco de teclado e contraste permanecem visíveis;
- o fluxo real da API continua funcionando;
- `npm run build` e `npm run lint` passam.

## Sequência recomendada

1. definir tokens e tipografia;
2. recriar shell, header, navegação e acesso;
3. recriar home e cards de leilão;
4. recriar sala do leilão;
5. recriar formulários e upload;
6. recriar conta, vendas e painel administrativo;
7. remover CSS legado somente quando cada tela tiver cobertura visual;
8. validar build, responsividade, teclado e fluxos da API.

Não começar trocando cores isoladamente. Primeiro fechar shell, tipografia,
hierarquia e componentes-base; isso evita que cada tela adquira uma aparência
diferente de novo.
