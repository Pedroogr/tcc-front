import type { Lot } from '@/types/lot';
import { Money } from '@/design/primitives/Money';
import { formatLotStatus } from '@/utils/auctionLabels';
import { cn } from '@/lib/utils';

type LotQueueProps = {
  lots: Lot[];
  isLoading: boolean;
  /** Lote recem-criado, destacado ate o usuario sair da tela. */
  highlightedLotId: string | null;
  onSelectLot: (lotId: string) => void;
};

export function LotQueue({ lots, isLoading, highlightedLotId, onSelectLot }: LotQueueProps) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between gap-4 border-b border-border px-4.5 py-3.5">
        <span className="t-label">Fila de lotes</span>
        {!isLoading && lots.length > 0 && (
          <span className="text-xs text-text-subtle">{lots.length}</span>
        )}
      </header>

      {isLoading ? (
        <div className="flex flex-col gap-px">
          {[0, 1, 2].map((row) => (
            <div className="flex items-center gap-3 px-4.5 py-3" key={row}>
              <div className="h-3.5 w-8 shrink-0 animate-pulse rounded bg-muted" />
              <div className="h-3.5 flex-grow animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : lots.length === 0 ? (
        <p className="px-4.5 py-8 text-center text-[13px] text-muted-foreground">
          Nenhum lote adicionado neste remate.
        </p>
      ) : (
        <ul className="flex flex-col">
          {lots.map((lot) => {
            const inPista = lot.status === 'IN_AUCTION';

            return (
              <li className="border-b border-border last:border-b-0" key={lot.id}>
                <button
                  className={cn(
                    'flex w-full items-center gap-3 px-4.5 py-3 text-left transition-colors hover:bg-accent',
                    inPista && 'bg-brand-tint hover:bg-brand-tint',
                    lot.id === highlightedLotId && 'ring-1 ring-inset ring-ring/40',
                  )}
                  type="button"
                  onClick={() => onSelectLot(lot.id)}
                >
                  <span
                    className={cn(
                      't-mono w-9 shrink-0',
                      inPista ? 'text-primary' : 'text-text-subtle',
                    )}
                  >
                    {lot.code}
                  </span>

                  <span
                    className={cn(
                      'min-w-0 flex-grow truncate text-[13.5px]',
                      inPista ? 'font-medium text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {lot.title}
                  </span>

                  {inPista ? (
                    <span className="inline-flex h-5.5 shrink-0 items-center rounded-[5px] bg-live px-2 text-[10px] font-semibold tracking-[0.05em] text-primary-foreground">
                      EM PISTA
                    </span>
                  ) : lot.status === 'SOLD' ? (
                    <Money className="shrink-0" size="sm" value={lot.initialPrice} />
                  ) : (
                    <span className="shrink-0 text-[11.5px] text-text-subtle">
                      {formatLotStatus(lot.status)}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
