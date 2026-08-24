import { Building2, UserRound } from 'lucide-react';
import type { Sale } from '@/types/sale';
import { Money } from '@/design/primitives/Money';
import { Button } from '@/components/ui/button';

type SaleRecordListProps = {
  sales: Sale[];
  isLoading: boolean;
  error: string;
  perspective: 'office' | 'buyer';
  emptyMessage: string;
  onRetry: () => void;
};

function LoadingRows() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-3" role="status">
      <span className="sr-only">Carregando registros...</span>
      {[0, 1, 2].map((row) => (
        <div className="grid gap-4 rounded-xl border border-border bg-card p-4.5 sm:grid-cols-[1fr_180px]" key={row}>
          <div className="flex flex-col gap-2">
            <span className="h-3 w-20 animate-pulse rounded bg-muted" />
            <span className="h-5 w-52 max-w-full animate-pulse rounded bg-muted" />
          </div>
          <span className="h-7 w-32 animate-pulse rounded bg-muted sm:justify-self-end" />
        </div>
      ))}
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="t-label">{label}</dt>
      <dd className="break-words text-[13px] text-foreground">{value}</dd>
    </div>
  );
}

export function SaleRecordList({
  sales,
  isLoading,
  error,
  perspective,
  emptyMessage,
  onRetry,
}: SaleRecordListProps) {
  if (isLoading) return <LoadingRows />;

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-6 py-10 text-center" role="alert">
        <p className="text-sm text-destructive">{error}</p>
        <Button size="sm" type="button" variant="outline" onClick={onRetry}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (sales.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-input bg-card px-6 py-14 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sales.map((sale) => {
        const isOfficeView = perspective === 'office';
        const contact = isOfficeView ? sale.buyer : sale.saleRecordedByAuctionHouse;

        return (
          <article className="overflow-hidden rounded-xl border border-border bg-card" key={sale.id}>
            <div className="grid gap-4 p-4.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="t-mono text-text-subtle">{sale.lot?.code || 'LOTE'}</span>
                <h2 className="break-words text-[15px] font-semibold">
                  {sale.lot?.title || 'Lote sem título'}
                </h2>
                {sale.lot?.auction?.title && (
                  <span className="text-xs text-muted-foreground">{sale.lot.auction.title}</span>
                )}
              </div>
              <div className="flex flex-col gap-1 sm:items-end">
                <span className="t-label">Valor final</span>
                <Money value={sale.finalPrice} />
              </div>
            </div>

            <div className="grid gap-4 border-t border-border bg-muted/40 px-4.5 py-4 md:grid-cols-[24px_repeat(4,minmax(0,1fr))]">
              <div className="hidden size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground md:flex">
                {isOfficeView ? <UserRound className="size-4" /> : <Building2 className="size-4" />}
              </div>
              <Detail
                label={isOfficeView ? 'Comprador' : 'Escritório'}
                value={isOfficeView ? contact?.name || 'Comprador' : contact?.name}
              />
              <Detail label="E-mail" value={contact?.email} />
              {isOfficeView && <Detail label="Telefone" value={sale.buyer?.phone} />}
              {isOfficeView && <Detail label="Documento" value={sale.buyer?.document} />}
              {!isOfficeView && (
                <div className="flex min-w-0 flex-col gap-1 md:col-span-2">
                  <span className="t-label">Data do arremate</span>
                  <span className="text-[13px] text-foreground">
                    {new Date(sale.soldAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              )}
            </div>

            {isOfficeView && (
              <footer className="border-t border-border px-4.5 py-2.5 text-right text-[11.5px] text-text-subtle">
                Arrematado em {new Date(sale.soldAt).toLocaleString('pt-BR')}
              </footer>
            )}
          </article>
        );
      })}
    </div>
  );
}
