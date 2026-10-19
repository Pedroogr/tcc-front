# Servidor GPU doméstico para reconhecimento de gestos

**Data:** 2026-10-19
**Estado:** decisão preliminar; validar com medições antes da implementação

## Objetivo

Usar um desktop Windows com uma RTX 3070 Ti como servidor de inferência de
pose, acessado pela internet por um notebook Linux que captura o vídeo. A
solução deve evitar o custo recorrente de uma GPU em nuvem e manter o acesso
restrito ao notebook autorizado.

O critério de desempenho acordado é latência ponta a ponta `p95 <= 250 ms`,
medida desde a captura do gesto até a apresentação do reconhecimento no
notebook.

## Contexto atual

- A estação executa YOLO Pose no navegador por meio do ONNX Runtime Web.
- O backend preferido é WebGPU, com fallback para WASM/CPU.
- O modelo atual usa entrada fixa de `640 x 640`; diminuir apenas a resolução
  da câmera não reduz essa entrada automaticamente.
- O rastreador exige três amostras positivas durante pelo menos `250 ms`. Essa
  espera, isoladamente, já consome todo o orçamento de latência desejado.
- O roteador do desktop informa um IPv4 público. Não há indicação de CGNAT,
  portanto uma conexão direta é tecnicamente possível.

## Direção proposta

1. Manter o notebook responsável pela câmera e pela interface da estação.
2. Enviar frames comprimidos ao desktop por uma conexão privada direta.
3. Executar preprocessamento, inferência CUDA/TensorRT e decodificação da pose
   na RTX 3070 Ti.
4. Retornar apenas poses, tempos e identificadores dos frames ao notebook.
5. Manter rastreamento, regra do gesto e integração com o leilão atrás de uma
   interface estável, permitindo comparar inferência local e remota.
6. Descartar qualquer frame ultrapassado: o frame mais recente sempre vence e
   não deve existir uma fila crescente de inferências.

A seam sugerida é o estimador de pose existente. A estação continuaria
consumindo uma interface pequena (`start`, `detect` e `dispose`), com dois
adapters:

- `LocalPoseAdapter`: ONNX Runtime Web no notebook;
- `RemotePoseAdapter`: transporte até o desktop e retorno das poses.

Essa divisão mantém captura, rastreamento e entrega do evento independentes da
localização da inferência.

## Conectividade

A primeira opção é WireGuard direto entre notebook e desktop, porque o desktop
possui IPv4 público e a conexão direta evita um relay adicional. A configuração
exige:

- encaminhamento de uma porta UDP no roteador para o desktop;
- regra restrita no Firewall do Windows;
- chave exclusiva para o notebook;
- DNS dinâmico caso o IPv4 público mude.

O roteador deve permanecer no modo `Roteador (Padrão)`. Alterá-lo para bridge
pode interromper internet, telefone e TV.

Se não for possível administrar o roteador, as alternativas são Tailscale,
NetBird ou ZeroTier. Elas tentam uma conexão ponto a ponto e usam relay quando
o NAT impede a conexão direta. Relay deve ser medido, pois acrescenta latência
e pode inviabilizar o alvo de `250 ms`. Cloudflare Tunnel é outra alternativa
sem portas de entrada, mas seu caminho intermediado também torna a latência
menos previsível.

Referências:

- [WireGuard Quick Start](https://www.wireguard.com/quickstart/)
- [ZeroTier: Bandwidth Considerations](https://docs.zerotier.com/faq/bandwidth/)
- [NetBird: Troubleshooting relayed connections](https://docs.netbird.io/help/troubleshooting-relayed-connections)
- [Cloudflare: Private web application](https://developers.cloudflare.com/cloudflare-one/setup/secure-private-apps/private-web-app/)

## Orçamento inicial de latência

O orçamento abaixo é uma hipótese para orientar os testes, não uma garantia:

| Etapa | Orçamento inicial |
| --- | ---: |
| Captura e compressão | 20-35 ms |
| Rede de ida e volta | 30-70 ms |
| Decodificação e inferência | 15-35 ms |
| Confirmação temporal | 80-120 ms |
| Retorno, regra e interface | 10-20 ms |
| **Total estimado** | **155-280 ms** |

Para buscar `p95 <= 250 ms`, a confirmação atual de três amostras por `250 ms`
deve se tornar configurável. O ponto inicial será testar duas ou três amostras
em uma janela de `80-120 ms`, comparando latência com falsos positivos e falsos
negativos.

## Plano de validação

1. Medir ping, jitter, perda de pacotes e se o túnel é direto ou usa relay.
2. Gravar um vídeo representativo e reutilizar exatamente o mesmo material em
   todos os testes.
3. Instrumentar timestamps de captura, envio, recepção, inferência, retorno,
   confirmação e apresentação.
4. Comparar o adapter local com o remoto usando FPS, latência `p50`/`p95`,
   falsos positivos e falsos negativos.
5. Testar janelas de confirmação de `80`, `100` e `120 ms`.
6. Simular jitter, desconexão e servidor indisponível, garantindo que frames
   atrasados sejam descartados e que a interface indique a falha.
7. Escolher o transporte dos frames somente após um protótipo comparar uma
   opção simples de JPEG com uma opção de vídeo de baixa latência.

## Questões pendentes

- Localizar no roteador a configuração de encaminhamento de portas.
- Confirmar se o IPv4 público é dinâmico e, se necessário, configurar DDNS.
- Medir a rota real entre o notebook e o desktop fora da rede doméstica.
- Escolher o transporte dos frames a partir das medições.
- Definir o limite aceitável de falsos positivos e falsos negativos.
