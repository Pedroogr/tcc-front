import { ChevronLeft } from 'lucide-react';
import type { OfficeSale } from '@/types/sale';
import { Button } from '@/components/ui/button';
import { SaleRecordList } from './sales/SaleRecordList';

type SalesPageProps = {
  sales: OfficeSale[];
  isLoading: boolean;
  error: string;
  onBack: () => void;
  onRetry: () => void;
};

export function SalesPage({ sales, isLoading, error, onBack, onRetry }: SalesPageProps) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="t-label">Escritório</span>
          <h1 className="t-section text-[1.85rem]">Vendas e arremates</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Compradores vencedores de cada lote, com os contatos para combinar transporte e logística.
          </p>
        </div>
        <Button className="self-start sm:self-auto" size="sm" type="button" variant="outline" onClick={onBack}>
          <ChevronLeft /> Remates
        </Button>
      </header>

      {!isLoading && sales.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          <span className="t-label">Registros</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {sales.length} {sales.length === 1 ? 'venda' : 'vendas'}
          </span>
        </div>
      )}

      <SaleRecordList
        emptyMessage="Nenhuma venda registrada ainda."
        error={error}
        isLoading={isLoading}
        onRetry={onRetry}
        perspective="office"
        sales={sales}
      />
    </section>
  );
}
