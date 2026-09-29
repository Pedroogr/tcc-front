import { BellRing, Hand } from 'lucide-react';
import type { ActiveGestureAlert } from './gesture-alert';

type GestureFirstHandAlertProps = {
  alert: ActiveGestureAlert;
};

export function GestureFirstHandAlert({ alert }: GestureFirstHandAlertProps) {
  return (
    <section
      role="alert"
      aria-label="Primeira mão detectada"
      className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-50 mx-auto max-w-sm overflow-hidden rounded-2xl border border-primary bg-card text-foreground shadow-2xl"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <span className="absolute inset-0 rounded-full bg-primary opacity-40 motion-safe:animate-ping" />
            <Hand aria-hidden="true" className="relative size-5" />
          </span>
          <div className="min-w-0">
            <p className="t-label text-primary">Atenção na pista</p>
            <h2 className="truncate text-base font-semibold">Primeira mão detectada</h2>
          </div>
        </div>
        <span
          aria-label={`${alert.remainingSeconds} segundos restantes`}
          className="shrink-0 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 font-mono text-sm font-semibold text-primary"
        >
          {alert.remainingSeconds}s
        </span>
      </div>

      <div className="p-3">
        <div className="aspect-video overflow-hidden rounded-xl border border-border bg-muted">
          <img
            src={alert.snapshotUrl}
            alt="Pessoa com a primeira mão levantada, destacada pela estação de gestos"
            className="size-full object-cover"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
        <span>Imagem capturada agora</span>
        <span className="flex items-center gap-1.5 text-right">
          <BellRing aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
          Som e vibração quando disponíveis
        </span>
      </div>
    </section>
  );
}
