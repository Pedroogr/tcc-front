import { Building2, UserRound } from 'lucide-react';
import type {
  OfficeSale,
  ResponsibleContact,
  SaleContact,
  SellerSale,
  WinnerSale,
} from '@/types/sale';
import { Money } from '@/design/primitives/Money';
import { Button } from '@/components/ui/button';

type Perspective = 'office' | 'buyer' | 'seller';

type CommonProps = {
  isLoading: boolean;
  error: string;
  emptyMessage: string;
  onRetry: () => void;
};

type SaleRecordListProps =
  | (CommonProps & { perspective: 'office'; sales: OfficeSale[] })
  | (CommonProps & { perspective: 'buyer'; sales: WinnerSale[] })
  | (CommonProps & { perspective: 'seller'; sales: SellerSale[] });

type LabeledContact = {
  label: string;
  contact: SaleContact | ResponsibleContact;
};

type NormalizedSale = {
  id: string;
  lotCode: string;
  lotTitle: string;
  auctionTitle: string;
  finalPrice: string | number;
  soldAt: string;
  contacts: LabeledContact[];
};

function normalize(
  sales: Array<OfficeSale | WinnerSale | SellerSale>,
  perspective: Perspective,
): NormalizedSale[] {
  return sales.map((sale): NormalizedSale => {
    const base = {
      id: sale.id,
      lotCode: sale.lotCode,
      lotTitle: sale.lotTitle,
      auctionTitle: sale.auctionTitle,
      finalPrice: sale.finalPrice,
      soldAt: sale.soldAt,
    };

    if (perspective === 'office') {
      const office = sale as OfficeSale;
      const responsible: LabeledContact = office.seller
        ? { label: 'Vendedor', contact: office.seller }
        : { label: 'Responsável', contact: office.responsible };

      return {
        ...base,
        contacts: [{ label: 'Comprador', contact: office.buyer }, responsible],
      };
    }

    if (perspective === 'seller') {
      return {
        ...base,
        contacts: [{ label: 'Comprador', contact: (sale as SellerSale).buyer }],
      };
    }

    const responsible = (sale as WinnerSale).responsible;

    return {
      ...base,
      contacts: [
        {
          label:
            responsible.kind === 'SELLER' ? 'Vendedor' : 'Escritório responsável',
          contact: responsible,
        },
      ],
    };
  });
}

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

function ContactCard({ label, contact }: LabeledContact) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-[10px] border border-border bg-card p-3.5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
          {'kind' in contact && contact.kind === 'AUCTION_HOUSE' ? (
            <Building2 className="size-4" />
          ) : (
            <UserRound className="size-4" />
          )}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="t-label">{label}</span>
          <strong className="truncate text-[14px] font-semibold text-foreground">
            {contact.name}
          </strong>
        </div>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2">
        <Detail label="E-mail" value={contact.email} />
        <Detail label="Telefone" value={contact.phone ?? undefined} />
      </dl>
    </div>
  );
}

export function SaleRecordList(props: SaleRecordListProps) {
  const { isLoading, error, emptyMessage, onRetry, perspective, sales } = props;

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

  const records = normalize(sales, perspective);

  return (
    <div className="flex flex-col gap-3">
      {records.map((sale) => (
        <article className="overflow-hidden rounded-xl border border-border bg-card" key={sale.id}>
          <div className="grid gap-4 p-4.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="t-mono text-text-subtle">{sale.lotCode || 'LOTE'}</span>
              <h2 className="break-words text-[15px] font-semibold">
                {sale.lotTitle || 'Lote sem título'}
              </h2>
              {sale.auctionTitle && (
                <span className="text-xs text-muted-foreground">{sale.auctionTitle}</span>
              )}
            </div>
            <div className="flex flex-col gap-1 sm:items-end">
              <span className="t-label">Valor final</span>
              <Money value={sale.finalPrice} />
            </div>
          </div>

          <div className="grid gap-3 border-t border-border bg-muted/40 px-4.5 py-4 sm:grid-cols-2">
            {sale.contacts.map((entry) => (
              <ContactCard
                contact={entry.contact}
                key={`${sale.id}-${entry.label}`}
                label={entry.label}
              />
            ))}
          </div>

          <footer className="border-t border-border px-4.5 py-2.5 text-right text-[11.5px] text-text-subtle">
            Arrematado em {new Date(sale.soldAt).toLocaleString('pt-BR')}
          </footer>
        </article>
      ))}
    </div>
  );
}
