import { ChevronLeft } from 'lucide-react';
import type { Sale } from '@/types/sale';
import { Button } from '@/components/ui/button';
import { SaleRecordList } from './sales/SaleRecordList';

type MyWinsPageProps = {
  sales: Sale[];
  isLoading: boolean;
  error: string;
  onBack: () => void;
  onRetry: () => void;
};

export function MyWinsPage({ sales, isLoading, error, onBack, onRetry }: MyWinsPageProps) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="t-label">Comprador</span>
          <h1 className="t-section text-[1.85rem]">Meus arremates</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Lotes que você arrematou. O escritório entra em contato para organizar a logística.
          </p>
        </div>
        <Button className="self-start sm:self-auto" size="sm" type="button" variant="outline" onClick={onBack}>
          <ChevronLeft /> Remates
        </Button>
      </header>

      {!isLoading && sales.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          <span className="t-label">Histórico</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {sales.length} {sales.length === 1 ? 'lote' : 'lotes'}
          </span>
        </div>
      )}

      <SaleRecordList
        emptyMessage="Você ainda não arrematou nenhum lote."
        error={error}
        isLoading={isLoading}
        onRetry={onRetry}
        perspective="buyer"
        sales={sales}
      />
    </section>
  );
}
