import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, Hand, Play, Square, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Auction } from '@/types/auction';
import {
  loadOwnedGestureAuction,
  useGestureStation,
  type GestureStationAccess,
} from './use-gesture-station';

type GestureStationAppProps = { auctionId: string };

function goBack() {
  window.location.assign('/');
}

function AccessMessage({ access }: { access: GestureStationAccess | null }) {
  const title =
    access?.status === 'unavailable'
      ? 'Remate encerrado'
      : access?.status === 'not-found'
        ? 'Remate não encontrado'
        : 'Acesso exclusivo do escritório';
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 text-foreground">
      <Card className="w-full max-w-lg border-border bg-card">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm text-muted-foreground">
          <p>
            Entre com a conta do escritório responsável e abra a estação pelo gerenciamento
            do remate.
          </p>
          <Button type="button" onClick={goBack}>
            Voltar ao site
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function deliveryLabel(delivery: string) {
  if (delivery === 'sending') return 'Enviando alerta…';
  if (delivery === 'sent') return 'Alerta entregue à API';
  if (delivery === 'failed') return 'Falha ao entregar o alerta';
  if (delivery === 'offline') return 'Sem rede: alerta não enviado';
  if (delivery === 'unreliable') return 'Detecção lenta: alertas pausados';
  return 'Aguardando primeira mão';
}

function StationScreen({ auction }: { auction: Auction }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { state, cameras, selectedCameraId, selectCamera, start, stop } =
    useGestureStation(auction.id, videoRef);
  const running = state.phase === 'running';

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button type="button" size="sm" variant="outline" onClick={goBack}>
              <ArrowLeft /> Remate
            </Button>
            <div className="min-w-0">
              <p className="t-label text-primary">Estação de gestos</p>
              <h1 className="truncate text-xl font-bold">{auction.title}</h1>
            </div>
          </div>
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            {state.online ? <Wifi className="size-4 text-primary" /> : <WifiOff className="size-4" />}
            {state.online ? 'Conectada à API' : 'Sem conexão com a API'}
          </span>
        </header>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="relative aspect-video overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <video ref={videoRef} autoPlay muted playsInline className="size-full object-contain" />
            {state.poses.map((pose, index) => (
              <span
                aria-hidden="true"
                key={`${pose.normalizedBox.x}-${pose.normalizedBox.y}-${index}`}
                className="pointer-events-none absolute border-2 border-border"
                style={{
                  left: `${pose.normalizedBox.x * 100}%`,
                  top: `${pose.normalizedBox.y * 100}%`,
                  width: `${pose.normalizedBox.width * 100}%`,
                  height: `${pose.normalizedBox.height * 100}%`,
                }}
              />
            ))}
            {state.selectedBox && (
              <span
                aria-label="Primeira mão selecionada"
                className="pointer-events-none absolute border-4 border-primary"
                style={{
                  left: `${state.selectedBox.x * 100}%`,
                  top: `${state.selectedBox.y * 100}%`,
                  width: `${state.selectedBox.width * 100}%`,
                  height: `${state.selectedBox.height * 100}%`,
                }}
              />
            )}
            {!running && (
              <div className="absolute inset-0 grid place-items-center bg-background/80 px-6 text-center">
                <div className="grid max-w-md place-items-center gap-3">
                  <Camera className="size-10 text-primary" />
                  <p className="font-semibold">
                    {state.phase === 'starting'
                      ? 'Carregando câmera e modelo…'
                      : 'Inicie quando a câmera estiver apontada para a plateia.'}
                  </p>
                </div>
              </div>
            )}
          </section>

          <aside className="flex flex-col gap-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Hand className="size-5 text-primary" /> Reconhecimento
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <label className="grid gap-2 text-sm font-semibold">
                  Câmera dedicada
                  <select
                    aria-label="Câmera dedicada"
                    className="h-11 rounded-md border border-border bg-background px-3"
                    value={selectedCameraId}
                    onChange={(event) => selectCamera(event.target.value)}
                    disabled={state.phase === 'starting'}
                  >
                    {cameras.length === 0 && <option value="">Câmera padrão</option>}
                    {cameras.map((camera, index) => (
                      <option key={camera.deviceId || index} value={camera.deviceId}>
                        {camera.label || `Câmera ${index + 1}`}
                      </option>
                    ))}
                  </select>
                </label>

                {running ? (
                  <Button type="button" variant="destructive" onClick={stop}>
                    <Square /> Parar reconhecimento
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => void start()}
                    disabled={state.phase === 'starting'}
                  >
                    <Play />
                    {state.phase === 'error' ? 'Tentar novamente' : 'Iniciar reconhecimento'}
                  </Button>
                )}

                {state.message && (
                  <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                    {state.message}
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border bg-card">
              <CardContent className="grid gap-3 pt-6 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Processamento</span>
                  <strong>{state.backend === 'webgpu' ? 'GPU local' : state.backend === 'wasm' ? 'CPU local' : '—'}</strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Desempenho</span>
                  <strong>{state.fps === null ? 'Medindo…' : `${state.fps.toFixed(1)} FPS`}</strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Entrega</span>
                  <strong className={state.delivery === 'sent' ? 'text-primary' : ''}>
                    {deliveryLabel(state.delivery)}
                  </strong>
                </div>
              </CardContent>
            </Card>

            <p className="rounded-xl border border-border bg-muted p-4 text-xs leading-relaxed text-muted-foreground">
              O vídeo permanece nesta máquina. Apenas a imagem curta da primeira mão
              confirmada é enviada ao celular do pisteiro. A decisão e o lance continuam
              sendo feitos pelo operador.
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}

export function GestureStationApp({ auctionId }: GestureStationAppProps) {
  const [access, setAccess] = useState<GestureStationAccess | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void loadOwnedGestureAuction(auctionId)
      .then((result) => {
        if (!cancelled) setAccess(result);
      })
      .catch(() => {
        if (!cancelled) setAccess({ status: 'not-found' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auctionId]);

  if (loading) {
    return <main className="grid min-h-dvh place-items-center bg-background">Carregando estação…</main>;
  }
  if (!access || access.status !== 'authorized') {
    return <AccessMessage access={access} />;
  }
  return <StationScreen auction={access.auction} />;
}
