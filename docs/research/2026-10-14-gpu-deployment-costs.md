# Pesquisa de custo para inferência de gestos em GPU

**Data:** 2026-10-14
**Escopo:** comparar a antiga oferta de GPU da Fly.io com alternativas atuais
para executar inferência de pose do `yolo11n-pose` durante remates.

## Resumo executivo

- A Fly.io não é mais uma opção de GPU: as páginas oficiais informam que as
  GPUs foram descontinuadas e ficaram indisponíveis depois de 1º de agosto de
  2026. O último preço publicado para a L40S foi US$ 1,25/h.
- Para uma GPU ativa somente durante um remate, há opções substancialmente mais
  baratas: SaladCloud RTX 4070 High a US$ 0,15/h, TensorDock RTX 3090 a partir
  de US$ 0,23/h e Runpod Pod RTX A5000 a US$ 0,27/h.
- O menor preço não é necessariamente o melhor para uma operação ao vivo.
  Instâncias comunitárias, de marketplace ou interrompíveis têm variação de
  disponibilidade, localização e continuidade.
- Para este projeto, a recomendação continua sendo inferência local no
  computador da filmagem. O modelo atual tem apenas 11,85 MB, entrada 640x640 e
  já usa WebGPU com fallback WASM. Essa arquitetura evita transmitir vídeo,
  reduz a latência, mantém funcionamento durante instabilidade da internet e
  não acrescenta custo de GPU ao deploy.
- Caso o computador local não atinja o desempenho necessário, o primeiro teste
  em nuvem deveria ser um Runpod Pod iniciado antes do remate e encerrado ao
  final. SaladCloud High é mais barato, mas precisa ser validado sob desconexão
  e realocação de nó antes de ser usado em operação ao vivo.

## Situação da Fly.io

A Fly.io adicionou às páginas antigas de GPU o aviso de que o produto foi
descontinuado e ficaria indisponível depois de 1º de agosto de 2026
([Fly.io](https://fly.io/blog/transcribing-on-fly-gpu-machines/)). Portanto,
não existe hoje um preço de GPU Fly.io que possa ser contratado.

Como referência histórica, a Fly.io reduziu a L40S para US$ 1,25/h em 2024
([Fly.io](https://fly.io/blog/cutting-prices-for-l40s-gpus-in-half/)). Uma GPU
ligada por 730 horas custaria US$ 912,50/mês, sem considerar armazenamento e
tráfego.

Na tabela de preços vigente desde 1º de outubro de 2026, uma Fly Machine
`performance-1x` com 2 GB custa US$ 33/mês e uma `shared-cpu-8x` com 2 GB custa
US$ 17,55/mês ([Fly.io](https://fly.io/pricing-update/)). Assim, a antiga L40S
24/7 custava cerca de 28 vezes uma `performance-1x` ou 52 vezes uma
`shared-cpu-8x`. A comparação não é equivalente em capacidade, mas mostra a
ordem de grandeza do salto de custo.

## Comparação de preços

Os valores abaixo são de computação, em dólar, antes de impostos. A coluna em
reais usa a PTAX de venda de 13/10/2026, R$ 5,0096/US$, publicada pelo
[Banco Central do Brasil](https://ptax.bcb.gov.br/ptax_internet/consultarUltimaCotacaoDolar.do).
Um “mês 24/7” usa 730 horas. Um remate usa quatro horas. Para os serviços
serverless, uma sequência contínua de frames mantém o worker ativo e aproxima o
custo do tempo integral do remate.

| Opção | Tipo e observação | US$/h | 1 remate, 4 h | 40 h/mês | 730 h/mês |
| --- | --- | ---: | ---: | ---: | ---: |
| Salad RTX 4070 High | não é preemptada por outra prioridade; nó ainda pode desconectar | 0,15 | US$ 0,60 / R$ 3,01 | US$ 6,00 / R$ 30,06 | US$ 109,50 / R$ 548,55 |
| TensorDock RTX 3090 | preço inicial da GPU; CPU, RAM e disco podem aumentar o total | 0,23 | US$ 0,92 / R$ 4,61 | US$ 9,20 / R$ 46,09 | US$ 167,90 / R$ 841,11 |
| Runpod Pod RTX A5000 | instância dedicada durante o período ligado | 0,27 | US$ 1,08 / R$ 5,41 | US$ 10,80 / R$ 54,10 | US$ 197,10 / R$ 987,39 |
| Runpod Serverless A4000 | scale-to-zero; stream contínuo impede ociosidade | 0,58 | US$ 2,32 / R$ 11,62 | US$ 23,20 / R$ 116,22 | US$ 423,40 / R$ 2.121,06 |
| Modal T4 + 1 core + 4 GiB | estimativa pela soma de GPU, CPU e RAM, sem multiplicador regional | 0,67 | US$ 2,68 / R$ 13,42 | US$ 26,78 / R$ 134,16 | US$ 488,76 / R$ 2.448,47 |
| Google Cloud Run L4 + 4 vCPU + 16 GiB | configuração mínima e sem redundância zonal | 1,05 | US$ 4,19 / R$ 20,97 | US$ 41,86 / R$ 209,71 | US$ 763,96 / R$ 3.827,13 |
| Fly.io L40S | último preço histórico; serviço indisponível desde agosto de 2026 | 1,25 | US$ 5,00 / R$ 25,05 | US$ 50,00 / R$ 250,48 | US$ 912,50 / R$ 4.571,26 |

### Fontes e condições de cada provedor

#### SaladCloud

A tabela oficial inclui CPU e RAM no preço da GPU. Em 14/10/2026, uma RTX 4070
custava US$ 0,15/h em High e US$ 0,07/h em Lowest. High não é preemptada por
outras prioridades, mas um nó comunitário ainda pode desconectar; Lowest é
explicitamente voltada a batch e workloads repetíveis. A cobrança é por segundo
e inicialização/download da imagem não são cobrados
([SaladCloud](https://salad.com/pricing/)).

O nível Lowest poderia reduzir o custo de uma RTX 4070 24/7 para US$ 51,10,
mas não é apropriado para detectar gestos durante um evento ao vivo. High é a
comparação operacional mais honesta.

#### Runpod

Na página atualizada em 08/10/2026, o Pod com RTX A5000 custa US$ 0,27/h; o
Serverless mais barato para modelos pequenos agrupa A4000/A4500/RTX 4000/RTX
2000 por US$ 0,58/h
([Runpod](https://www.runpod.io/pricing)). Serverless cobra desde o início do
worker até ele parar e inclui no faturamento o carregamento, execução e idle
timeout, cujo padrão é cinco segundos
([documentação Runpod](https://docs.runpod.io/serverless/pricing)). Um fluxo de
cinco frames por segundo nunca alcançaria o scale-to-zero, por isso um Pod é
mais barato para uma sessão contínua.

Pods parados podem perder a GPU anteriormente associada; o reinício depende de
disponibilidade ou de uma nova implantação
([documentação Runpod](https://docs.runpod.io/pods/troubleshooting/zero-gpus)).
Para um remate, a instância deve ser criada/aquecida antes do início e não deve
ser parada até o encerramento.

#### TensorDock

A TensorDock anuncia GPUs de consumidor a partir de US$ 0,12/h e RTX 4090 a
partir de US$ 0,35/h. O painel público mostrava RTX 3090 a partir de US$ 0,23/h
na consulta, mas o valor final soma GPU, CPU, RAM e NVMe e depende do host e da
localização. A empresa opera como marketplace e informa um padrão de uptime de
99,99% para os hosts
([TensorDock](https://www.tensordock.com/),
[painel de preços](https://production.dashboard.tensordock.com/deploy)).

É potencialmente tão econômica quanto a Runpod, mas o preço “a partir de” não
é uma cotação garantida para a região e configuração desejadas.

#### Modal

A Modal cobra T4 a US$ 0,000164/s, CPU físico a US$ 0,0000131/core/s e memória
a US$ 0,00000222/GiB/s. O plano Starter custa US$ 0 e inclui US$ 30/mês de
crédito de computação ([Modal](https://modal.com/pricing)). Uma configuração
ilustrativa com T4, um core e 4 GiB resulta em aproximadamente US$ 0,67/h.

Fixar a região aplica multiplicador de 1,15 a 1,75. A região estreita `sa`
(South America) usa 1,75, elevando a mesma configuração para aproximadamente
US$ 1,17/h. Além disso, a rota padrão de entrada das Functions passa pela
Virgínia e não há `routing_region` sul-americana na lista publicada
([Modal](https://modal.com/docs/guide/region-selection)). Isso reduz sua
atratividade para vídeo ao vivo no Brasil, apesar do crédito gratuito.

#### Google Cloud Run

A L4 sem redundância zonal custa US$ 0,0001867/s. Cloud Run exige no mínimo
quatro vCPUs e 16 GiB para uma L4; com os preços publicados de CPU e memória, a
configuração mínima soma cerca de US$ 1,05/h
([preços](https://cloud.google.com/run/pricing),
[requisitos de GPU](https://cloud.google.com/run/docs/configuring/services/gpu)).
O serviço escala a zero e a infraestrutura de GPU inicia em aproximadamente
cinco segundos, antes do carregamento do modelo.

GPU no Cloud Run não está disponível em São Paulo: as regiões L4 publicadas são
Singapura, Mumbai por convite, Bélgica, Países Baixos, Iowa e Virgínia. É a
alternativa mais gerenciada da lista, porém cara e geograficamente distante
para este fluxo.

#### Vast.ai

A Vast.ai usa marketplace com preço em tempo real, por isso não há um valor
fixo reproduzível para inserir na tabela. Há modalidades on-demand,
interrompível e reservada; armazenamento e banda variam por host e são cobrados
separadamente. Instâncias paradas continuam pagando armazenamento
([preços](https://vast.ai/pricing), [FAQ](https://console.vast.ai/faq/)). Pode
ser a opção mais barata em um instante específico, mas exige selecionar e
monitorar o host. Não é a primeira escolha para a operação crítica de um
remate.

## O custo de rede e a mudança de arquitetura

O preço da GPU é só parte da decisão. Hoje os frames ficam no computador da
filmagem e apenas uma imagem de até 256 KiB é enviada quando um gesto é
confirmado. Com GPU na nuvem, a estação precisa enviar continuamente vídeo ou
frames para o serviço de inferência.

Estimativa para JPEGs de 100 KiB a 5 FPS:

- aproximadamente 4,1 Mbit/s de upload constante;
- aproximadamente 1,72 GiB por hora;
- aproximadamente 6,87 GiB durante um remate de quatro horas.

Frames RGB 640x640 sem compressão chegariam a aproximadamente 49 Mbit/s e 20,6
GiB por hora. Um stream H.264 reduziria o tráfego, mas acrescentaria encoder,
decoder, buffering e uma nova sessão de vídeo. Esses números são estimativas;
o tamanho real deve ser medido no recinto.

Além da banda, a nuvem cria novos pontos de falha:

1. conexão de upload do recinto;
2. latência até uma região sem garantia de presença no Brasil;
3. inicialização e aquecimento da GPU/modelo;
4. sessão persistente e reconexão do stream;
5. proteção/autorização do feed da câmera;
6. perda completa da detecção se a internet cair.

Mover a inferência não é apenas trocar o destino do deploy. O worker browser
ONNX atual teria de ser substituído ou complementado por um serviço CUDA/
TensorRT/ONNX Runtime GPU, além de um protocolo para transmitir frames e
retornar poses.

## Recomendação para o TCC

### Escolha recomendada: continuar local

Manter a inferência na estação oferece o melhor custo, privacidade e
resiliência. O deploy web precisa servir o modelo ONNX, os arquivos WASM e os
cabeçalhos de isolamento; não precisa provisionar uma GPU. O próximo passo
correto é medir no computador real:

- FPS e latência p50/p95 com WebGPU;
- FPS e latência p50/p95 com WASM multithread;
- uso de CPU, GPU e memória;
- taxa de falso positivo/falso negativo em distância e iluminação reais;
- tempo total desde levantar a mão até o alerta no celular.

### Se uma GPU em nuvem se tornar necessária

1. **Protótipo confiável:** Runpod Pod RTX A5000, criado e aquecido antes do
   remate, encerrado depois. É previsível, barato e não requer manter 24/7.
2. **Menor custo:** SaladCloud RTX 4070 High, somente depois de um teste de
   desconexão, realocação, latência e disponibilidade no local do evento.
3. **Gerenciado/serverless:** Modal ou Cloud Run apenas se simplicidade
   operacional justificar pagar mais e a latência medida for aceitável.
4. **Evitar em produção ao vivo:** níveis Lowest/spot/interruptible e ofertas de
   marketplace escolhidas apenas pelo menor preço.

Para dez remates de quatro horas por mês, a computação seria aproximadamente
R$ 30 na Salad High ou R$ 54 na Runpod Pod, antes de impostos, armazenamento e
banda. O custo financeiro é pequeno; o motivo principal para não migrar é a
confiabilidade e a complexidade do vídeo remoto.

## Decisão sugerida

Não redesenhar o sistema para GPU em nuvem antes de concluir um benchmark local
reproduzível. Estabelecer como meta mínima 5 FPS sustentados e latência
ponta-a-ponta aceitável; se a estação não atingir essa meta, executar um spike
de quatro horas na Runpod e comparar lado a lado com a inferência local.
