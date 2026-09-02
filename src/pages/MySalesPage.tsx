import { ChevronLeft } from 'lucide-react';
import type { SellerSale } from '@/types/sale';
import { Button } from '@/components/ui/button';
import { SaleRecordList } from './sales/SaleRecordList';

type MySalesPageProps = {
  sales: SellerSale[];
  isLoading: boolean;
  error: string;
  onBack: () => void;
  onRetry: () => void;
};

export function MySalesPage({ sales, isLoading, error, onBack, onRetry }: MySalesPageProps) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="t-label">Vendedor</span>
          <h1 className="t-section text-[1.85rem]">Minhas vendas</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Lotes seus que foram arrematados, com o contato do comprador para combinar a entrega.
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
            {sales.length} {sales.length === 1 ? 'venda' : 'vendas'}
          </span>
        </div>
      )}

      <SaleRecordList
        emptyMessage="Nenhum lote seu foi vendido ainda."
        error={error}
        isLoading={isLoading}
        onRetry={onRetry}
        perspective="seller"
        sales={sales}
      />
    </section>
  );
}
