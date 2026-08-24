import type { ChangeEvent, FormEvent } from 'react';
import { CalendarDays, ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type AuctionFormFields = {
  title: string;
  description: string;
  scheduledAt: string;
};

type AuctionThumbnail = {
  file: File;
  previewUrl: string;
};

type CreateAuctionPageProps = {
  auctionForm: AuctionFormFields;
  auctionThumbnail: AuctionThumbnail | null;
  isSubmitting: boolean;
  error: string;
  onFieldChange: (field: keyof AuctionFormFields, value: string) => void;
  onThumbnailChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearThumbnail: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 font-normal">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <small className="text-xs text-muted-foreground">{hint}</small>}
    </label>
  );
}

export function CreateAuctionPage({
  auctionForm,
  auctionThumbnail,
  isSubmitting,
  error,
  onFieldChange,
  onThumbnailChange,
  onClearThumbnail,
  onSubmit,
}: CreateAuctionPageProps) {
  return (
    <section className="mx-auto grid w-full max-w-[1360px] items-start gap-6 px-4 py-7 sm:px-6 sm:py-9 lg:grid-cols-[minmax(0,0.78fr)_minmax(420px,1.22fr)] lg:px-8">
      <div className="flex flex-col gap-5 lg:sticky lg:top-24">
        <div className="flex size-11 items-center justify-center rounded-xl border border-brand-line bg-brand-tint text-primary">
          <CalendarDays className="size-5" />
        </div>
        <div className="flex flex-col gap-3">
          <span className="t-label">Remate do escritório</span>
          <h1 className="t-display max-w-xl text-[2.15rem] sm:text-[2.625rem]">
            Crie ou agende um remate.
          </h1>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            O remate fica vinculado ao escritório logado. Depois de salvar, você segue
            direto para o cadastro dos lotes.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-4.5">
          <span className="t-label">Como funciona</span>
          <ol className="mt-3 flex flex-col gap-3 text-[13px] text-muted-foreground">
            <li><strong className="mr-2 text-foreground">01</strong>Informe os dados e a capa.</li>
            <li><strong className="mr-2 text-foreground">02</strong>Adicione os lotes do remate.</li>
            <li><strong className="mr-2 text-foreground">03</strong>Inicie a transmissão quando estiver pronto.</li>
          </ol>
        </div>
      </div>

      <form className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 [&_input]:font-normal [&_textarea]:font-normal sm:p-6" onSubmit={onSubmit}>
        <header className="border-b border-border pb-4">
          <span className="t-label">Dados do remate</span>
          <h2 className="mt-1.5 font-[family-name:var(--font-display)] text-xl font-bold">
            Novo remate
          </h2>
        </header>

        <Field label="Título">
          <Input
            className="h-11"
            placeholder="Remate Primavera 2026"
            required
            value={auctionForm.title}
            onChange={(event) => onFieldChange('title', event.target.value)}
          />
        </Field>

        <Field label="Data e hora" hint="Sem data, o remate será salvo como rascunho.">
          <Input
            className="h-11"
            type="datetime-local"
            value={auctionForm.scheduledAt}
            onChange={(event) => onFieldChange('scheduledAt', event.target.value)}
          />
        </Field>

        <Field label="Descrição">
          <textarea
            className="min-h-28 resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm leading-relaxed outline-none placeholder:text-placeholder focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
            placeholder="Conjunto de lotes, condições comerciais e detalhes do evento."
            value={auctionForm.description}
            onChange={(event) => onFieldChange('description', event.target.value)}
          />
        </Field>

        <div className="flex flex-col gap-2">
          <div>
            <span className="text-sm font-medium">Imagem de capa</span>
            <p className="mt-1 text-xs text-muted-foreground">JPG, PNG ou WEBP, até 5 MB.</p>
          </div>

          {auctionThumbnail ? (
            <div className="grid gap-4 rounded-xl border border-border bg-muted p-3 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40 sm:grid-cols-[160px_1fr]">
              <img
                alt="Prévia da capa do remate"
                className="aspect-video w-full rounded-lg border border-border object-cover"
                src={auctionThumbnail.previewUrl}
              />
              <div className="flex min-w-0 flex-col justify-center gap-3">
                <div className="min-w-0">
                  <strong className="block truncate text-sm font-medium">{auctionThumbnail.file.name}</strong>
                  <span className="text-xs text-muted-foreground">
                    {(auctionThumbnail.file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <label className="cursor-pointer">
                      Substituir
                      <input
                        accept="image/jpeg,image/png,image/webp"
                        className="sr-only"
                        type="file"
                        onChange={onThumbnailChange}
                      />
                    </label>
                  </Button>
                  <Button size="sm" type="button" variant="ghost" onClick={onClearThumbnail}>
                    <X /> Remover
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-input bg-muted px-5 py-8 text-center font-normal transition-colors hover:border-ring hover:bg-accent focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40">
              <ImagePlus className="size-6 text-primary" />
              <strong className="text-sm font-medium">Selecionar imagem do dispositivo</strong>
              <span className="text-xs text-muted-foreground">A capa aparece nos cards de remates.</span>
              <input
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                type="file"
                onChange={onThumbnailChange}
              />
            </label>
          )}
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive">
            {error}
          </p>
        )}

        <Button className="h-11 self-start" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Salvando...' : 'Criar remate e adicionar lotes'}
        </Button>
      </form>
    </section>
  );
}
