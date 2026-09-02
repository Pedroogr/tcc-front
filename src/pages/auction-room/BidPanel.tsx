import type { FormEvent } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Lot } from '@/types/lot';
import type { BuyerRegistration } from '@/types/user';
import { Money } from '@/design/primitives/Money';
import { Button } from '@/components/ui/button';

type BidPanelProps = {
  inPistaLot: Lot | null;
  /** Comprador logado: escritorio nao da lance no proprio remate. */
  canBid: boolean;
  /** undefined enquanto carrega, null quando nunca solicitou liberacao. */
  registration: BuyerRegistration | null | undefined;
  bidAmount: string;
  bidStep: number;
  isSubmitting: boolean;
  error: string;
  onBidAmountChange: (value: string) => void;
  onStepBid: (delta: number) => void;
  onSubmitBid: (event: FormEvent) => void;
  onRequestApproval: () => void;
};

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-border bg-muted px-3 py-2.5 text-[12.5px] text-muted-foreground">
      {children}
    </p>
  );
}

export function BidPanel({
  inPistaLot,
  canBid,
  registration,
  bidAmount,
  bidStep,
  isSubmitting,
  error,
  onBidAmountChange,
  onStepBid,
  onSubmitBid,
  onRequestApproval,
}: BidPanelProps) {
  if (!inPistaLot) {
    return (
      <section className="rounded-xl border border-border bg-card">
        <header className="flex items-center gap-2 border-b border-border px-4.5 py-3">
          <span className="t-label">Lote em pista</span>
        </header>
        <div className="px-4.5 py-8 text-center text-[13px] text-muted-foreground">
          Nenhum lote em pista no momento.
        </div>
      </section>
    );
  }

  const currentAmount = inPistaLot.currentPrice ?? inPistaLot.initialPrice;

  return (
    <section className="overflow-hidden rounded-xl border border-brand-line bg-card">
      <header className="flex items-center gap-2 border-b border-brand-line bg-brand-tint px-4.5 py-3">
        <span className="size-1.5 shrink-0 rounded-full bg-live motion-safe:animate-pulse" />
        <span className="t-label text-primary">Lote em pista</span>
      </header>

      <div className="flex flex-col gap-4.5 p-4.5">
        <div className="flex flex-col gap-1">
          <span className="t-mono text-text-subtle">{inPistaLot.code}</span>
          <h2 className="text-[15.5px] font-semibold leading-snug">{inPistaLot.title}</h2>
          {(inPistaLot.breed || inPistaLot.category) && (
            <p className="text-[12.5px] text-muted-foreground">
              {[inPistaLot.breed, inPistaLot.category, `${inPistaLot.quantity} un.`]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>

        {/* Comprador ve apenas o preco atual, sem historico nem identidade (RF06). */}
        <div className="flex flex-col gap-1 rounded-[10px] bg-muted p-4">
          <span className="t-label">Lance atual</span>
          <Money size="lg" value={currentAmount} />
        </div>

        {canBid && (
          <>
            {registration === undefined ? (
              <Hint>Verificando liberação...</Hint>
            ) : registration === null ? (
              <Button
                className="h-11 w-full text-[15px]"
                disabled={isSubmitting}
                type="button"
                onClick={onRequestApproval}
              >
                Solicitar liberação para lances
              </Button>
            ) : registration.status === 'PENDING' ? (
              <Hint>Aguardando aprovação do escritório.</Hint>
            ) : registration.status === 'BLOCKED' ? (
              <Hint>Você está bloqueado para lances neste escritório.</Hint>
            ) : registration.status === 'REJECTED' ? (
              <div className="flex flex-col gap-2">
                <Hint>Sua solicitação foi negada.</Hint>
                <Button
                  className="h-10 w-full"
                  disabled={isSubmitting}
                  type="button"
                  variant="outline"
                  onClick={onRequestApproval}
                >
                  Solicitar novamente
                </Button>
              </div>
            ) : (
              <form className="flex flex-col gap-2.5" onSubmit={onSubmitBid}>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-xs font-semibold" htmlFor="bid-amount">
                    Seu lance
                  </label>
                  <span className="text-xs text-muted-foreground">
                    Incremento R$ {bidStep}
                  </span>
                </div>

                <div className="flex items-stretch gap-2">
                  <input
                    className="h-11.5 min-w-0 flex-grow rounded-[9px] border border-input bg-background px-3 text-lg font-semibold tabular-nums outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
                    id="bid-amount"
                    min="0"
                    step={bidStep}
                    type="number"
                    value={bidAmount}
                    onChange={(event) => onBidAmountChange(event.target.value)}
                  />
                  <div className="flex w-10 flex-col gap-1">
                    <button
                      aria-label={`Aumentar ${bidStep}`}
                      className="flex flex-grow items-center justify-center rounded-[7px] border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      type="button"
                      onClick={() => onStepBid(bidStep)}
                    >
                      <ChevronUp className="size-3.5" />
                    </button>
                    <button
                      aria-label={`Diminuir ${bidStep}`}
                      className="flex flex-grow items-center justify-center rounded-[7px] border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      type="button"
                      onClick={() => onStepBid(-bidStep)}
                    >
                      <ChevronDown className="size-3.5" />
                    </button>
                  </div>
                </div>

                <Button className="h-12 w-full text-base" disabled={isSubmitting} type="submit">
                  {isSubmitting ? 'Enviando...' : 'Dar lance'}
                </Button>
              </form>
            )}
          </>
        )}

        {error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-[12.5px] text-destructive">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
