import type { ChangeEvent, FormEvent, ReactNode } from 'react';
import { ClipboardCheck } from 'lucide-react';
import type { Auction } from '@/types/auction';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LotImageInput, type LotImageItem } from '@/components/LotImageInput';

type LotFormFields = {
  code: string;
  title: string;
  description: string;
  breed: string;
  category: string;
  sex: string;
  ageMonths: string;
  weightKg: string;
  quantity: string;
  initialPrice: string;
  auctionId: string;
};

type RegisterLotPageProps = {
  auctions: Auction[];
  selectedAuctionId: string;
  lotForm: LotFormFields;
  lotImages: LotImageItem[];
  isAuctionHouse: boolean;
  isSubmitting: boolean;
  error: string;
  onFieldChange: (field: keyof LotFormFields, value: string) => void;
  onImagesChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (imageId: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

const controlClass =
  'h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none placeholder:text-placeholder focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export function RegisterLotPage({
  auctions,
  selectedAuctionId,
  lotForm,
  lotImages,
  isAuctionHouse,
  isSubmitting,
  error,
  onFieldChange,
  onImagesChange,
  onRemoveImage,
  onSubmit,
}: RegisterLotPageProps) {
  const submitLabel = isSubmitting
    ? 'Enviando...'
    : isAuctionHouse
      ? 'Adicionar lote'
      : 'Enviar lote para análise';

  return (
    <section className="mx-auto grid w-full max-w-[1360px] items-start gap-6 px-4 py-7 sm:px-6 sm:py-9 lg:grid-cols-[minmax(0,0.72fr)_minmax(480px,1.28fr)] lg:px-8">
      <div className="flex flex-col gap-5 lg:sticky lg:top-24">
        <div className="flex size-11 items-center justify-center rounded-xl border border-brand-line bg-brand-tint text-primary">
          <ClipboardCheck className="size-5" />
        </div>
        <div className="flex flex-col gap-3">
          <span className="t-label">{isAuctionHouse ? 'Lote do remate' : 'Solicitação de lote'}</span>
          <h1 className="t-display max-w-xl text-[2.15rem] sm:text-[2.625rem]">
            {isAuctionHouse
              ? 'Adicione lotes aos remates do escritório.'
              : 'Associe o lote a um remate antes de enviar.'}
          </h1>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            {isAuctionHouse
              ? 'Escolha um remate do escritório e registre os animais que farão parte da oferta.'
              : 'O lote fica em análise até ser aprovado pelo escritório responsável pelo remate.'}
          </p>
        </div>

        <div className="rounded-xl border border-brand-line bg-brand-tint p-4.5">
          <span className="t-label text-primary">Regra de publicação</span>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Todo lote precisa estar vinculado a um remate. Solicitações de produtores só entram
            na vitrine depois da aprovação do escritório.
          </p>
        </div>
      </div>

      <form className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 [&_input]:font-normal [&_select]:font-normal [&_textarea]:font-normal sm:p-6" onSubmit={onSubmit}>
        <header className="border-b border-border pb-4">
          <span className="t-label">Dados do lote</span>
          <h2 className="mt-1.5 font-[family-name:var(--font-display)] text-xl font-bold">
            {isAuctionHouse ? 'Adicionar lote' : 'Novo lote'}
          </h2>
        </header>

        {auctions.length === 0 ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive">
            {isAuctionHouse
              ? 'Crie um remate antes de adicionar lotes.'
              : 'Nenhum remate disponível para associar. Selecione um remate antes de solicitar um lote.'}
          </p>
        ) : (
          <Field label="Remate">
            <select
              className={controlClass}
              required
              value={selectedAuctionId}
              onChange={(event) => onFieldChange('auctionId', event.target.value)}
            >
              {auctions.map((auction) => (
                <option key={auction.id} value={auction.id}>{auction.title}</option>
              ))}
            </select>
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-[0.65fr_1.35fr]">
          <Field label="Código do lote">
            <Input
              className="h-11"
              placeholder="LOTE-001"
              required
              value={lotForm.code}
              onChange={(event) => onFieldChange('code', event.target.value)}
            />
          </Field>
          <Field label="Título">
            <Input
              className="h-11"
              placeholder="Nelore PO — lote jovem"
              required
              value={lotForm.title}
              onChange={(event) => onFieldChange('title', event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Raça">
            <Input className="h-11" placeholder="Nelore" value={lotForm.breed} onChange={(event) => onFieldChange('breed', event.target.value)} />
          </Field>
          <Field label="Categoria">
            <Input className="h-11" placeholder="Corte" value={lotForm.category} onChange={(event) => onFieldChange('category', event.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Quantidade">
            <Input className="h-11" min="1" type="number" value={lotForm.quantity} onChange={(event) => onFieldChange('quantity', event.target.value)} />
          </Field>
          <Field label="Peso (kg)">
            <Input className="h-11" min="0" placeholder="420" type="number" value={lotForm.weightKg} onChange={(event) => onFieldChange('weightKg', event.target.value)} />
          </Field>
          <Field label="Idade (meses)">
            <Input className="h-11" min="0" placeholder="24" type="number" value={lotForm.ageMonths} onChange={(event) => onFieldChange('ageMonths', event.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sexo">
            <select className={controlClass} value={lotForm.sex} onChange={(event) => onFieldChange('sex', event.target.value)}>
              <option value="">Não informado</option>
              <option value="Macho">Macho</option>
              <option value="Femea">Fêmea</option>
              <option value="Misto">Misto</option>
            </select>
          </Field>
          <Field label="Valor inicial">
            <Input className="h-11 tabular-nums" min="0" placeholder="15000" type="number" value={lotForm.initialPrice} onChange={(event) => onFieldChange('initialPrice', event.target.value)} />
          </Field>
        </div>

        <Field label="Descrição">
          <textarea
            className={`${controlClass} min-h-28 resize-y py-2.5 leading-relaxed`}
            placeholder="Lote com animais jovens, bom padrão racial e documentação em dia."
            value={lotForm.description}
            onChange={(event) => onFieldChange('description', event.target.value)}
          />
        </Field>

        <LotImageInput images={lotImages} onChange={onImagesChange} onRemove={onRemoveImage} />

        {error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive">
            {error}
          </p>
        )}

        <Button className="h-11 self-start" disabled={isSubmitting || auctions.length === 0} type="submit">
          {submitLabel}
        </Button>
      </form>
    </section>
  );
}
