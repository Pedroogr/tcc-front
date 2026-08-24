import type { FormEvent, ReactNode } from 'react';
import type { BuyerRegistration } from '@/types/user';
import { Button } from '@/components/ui/button';
import { formatRegistrationStatus } from '@/utils/auctionLabels';

/** Subconjunto do formulario de lote que este painel edita. */
type LotFormFields = {
  code: string;
  title: string;
  breed: string;
  category: string;
  quantity: string;
  initialPrice: string;
  description: string;
};

type RoomSidePanelProps = {
  lotForm: LotFormFields;
  /** Elemento de upload, montado no App porque compartilha estado com outras telas. */
  lotImageInput: ReactNode;
  isSubmitting: boolean;
  canSubmitLot: boolean;
  error: string;
  createdLotId: string | null;
  buyerRegistrations: BuyerRegistration[];
  isLoadingBuyerRegistrations: boolean;
  onLotFieldChange: (field: keyof LotFormFields, value: string) => void;
  onLotSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReviewRegistration: (registrationId: string, status: 'APPROVED' | 'REJECTED') => void;
};

const fieldClass =
  'h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none placeholder:text-placeholder focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40';

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold">{label}</span>
      {children}
    </label>
  );
}

export function RoomSidePanel({
  lotForm,
  lotImageInput,
  isSubmitting,
  canSubmitLot,
  error,
  createdLotId,
  buyerRegistrations,
  isLoadingBuyerRegistrations,
  onLotFieldChange,
  onLotSubmit,
  onReviewRegistration,
}: RoomSidePanelProps) {
  const pendingCount = buyerRegistrations.filter((r) => r.status === 'PENDING').length;

  return (
    <div className="flex flex-col gap-5">
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <header className="border-b border-border px-4.5 py-3.5">
          <span className="t-label">Adicionar lote</span>
        </header>

        <form className="flex flex-col gap-3.5 p-4.5" onSubmit={onLotSubmit}>
          <Field label="Código">
            <input
              className={fieldClass}
              placeholder="LOTE-001"
              required
              value={lotForm.code}
              onChange={(event) => onLotFieldChange('code', event.target.value)}
            />
          </Field>

          <Field label="Título">
            <input
              className={fieldClass}
              placeholder="Nelore PO - lote jovem"
              required
              value={lotForm.title}
              onChange={(event) => onLotFieldChange('title', event.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Raça">
              <input
                className={fieldClass}
                placeholder="Nelore"
                value={lotForm.breed}
                onChange={(event) => onLotFieldChange('breed', event.target.value)}
              />
            </Field>
            <Field label="Categoria">
              <input
                className={fieldClass}
                placeholder="Corte"
                value={lotForm.category}
                onChange={(event) => onLotFieldChange('category', event.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantidade">
              <input
                className={fieldClass}
                min="1"
                type="number"
                value={lotForm.quantity}
                onChange={(event) => onLotFieldChange('quantity', event.target.value)}
              />
            </Field>
            <Field label="Valor inicial">
              <input
                className={`${fieldClass} tabular-nums`}
                min="0"
                placeholder="15000"
                type="number"
                value={lotForm.initialPrice}
                onChange={(event) => onLotFieldChange('initialPrice', event.target.value)}
              />
            </Field>
          </div>

          <Field label="Descrição">
            <textarea
              className={`${fieldClass} h-20 resize-y py-2 leading-relaxed`}
              placeholder="Descrição do lote."
              value={lotForm.description}
              onChange={(event) => onLotFieldChange('description', event.target.value)}
            />
          </Field>

          {lotImageInput}

          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-[12.5px] text-destructive">
              {error}
            </p>
          )}
          {createdLotId && (
            <p className="rounded-lg border border-brand-line bg-brand-tint px-3 py-2.5 text-[12.5px] text-success">
              Lote adicionado ao remate.
            </p>
          )}

          <Button disabled={isSubmitting || !canSubmitLot} type="submit">
            {isSubmitting ? 'Adicionando...' : 'Adicionar lote'}
          </Button>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <header className="flex items-center justify-between gap-4 border-b border-border px-4.5 py-3.5">
          <span className="t-label">Compradores</span>
          {pendingCount > 0 && (
            <span className="inline-flex h-5.5 items-center rounded-[5px] border border-[#46381a] bg-[#241c0c] px-2 text-[10px] font-semibold tracking-[0.05em] text-scheduled">
              {pendingCount} PENDENTE{pendingCount > 1 ? 'S' : ''}
            </span>
          )}
        </header>

        {isLoadingBuyerRegistrations ? (
          <p className="px-4.5 py-6 text-center text-[13px] text-muted-foreground">
            Carregando solicitações...
          </p>
        ) : buyerRegistrations.length === 0 ? (
          <p className="px-4.5 py-8 text-center text-[13px] text-muted-foreground">
            Nenhuma solicitação de comprador ainda.
          </p>
        ) : (
          <ul className="flex flex-col">
            {buyerRegistrations.map((registration) => (
              <li
                className="flex flex-col gap-2.5 border-b border-border px-4.5 py-3.5 last:border-b-0"
                key={registration.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <strong className="truncate text-[13.5px] font-medium">
                      {registration.buyer?.name || 'Comprador'}
                    </strong>
                    <small className="truncate text-xs text-muted-foreground">
                      {registration.buyer?.email}
                    </small>
                  </div>
                  <span className="shrink-0 text-[11.5px] text-text-subtle">
                    {formatRegistrationStatus(registration.status)}
                  </span>
                </div>

                {registration.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <Button
                      className="flex-grow"
                      size="sm"
                      type="button"
                      onClick={() => onReviewRegistration(registration.id, 'APPROVED')}
                    >
                      Aprovar
                    </Button>
                    <Button
                      className="flex-grow"
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => onReviewRegistration(registration.id, 'REJECTED')}
                    >
                      Rejeitar
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
