import type { FormEvent, ReactNode } from 'react';
import { BadgeCheck, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type SellerProfileFields = {
  farmName: string;
  ruralRegistration: string;
  stateRegistration: string;
  city: string;
  state: string;
  country: string;
};

type SellerProfilePageProps = {
  form: SellerProfileFields;
  isSubmitting: boolean;
  error: string;
  onFieldChange: (field: keyof SellerProfileFields, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export function SellerProfilePage({
  form,
  isSubmitting,
  error,
  onFieldChange,
  onSubmit,
}: SellerProfilePageProps) {
  return (
    <section className="mx-auto grid w-full max-w-[1360px] items-start gap-6 px-4 py-7 sm:px-6 sm:py-9 lg:grid-cols-[minmax(0,0.78fr)_minmax(420px,1.22fr)] lg:px-8">
      <div className="flex flex-col gap-5 lg:sticky lg:top-24">
        <div className="flex size-11 items-center justify-center rounded-xl border border-brand-line bg-brand-tint text-primary">
          <BadgeCheck className="size-5" />
        </div>
        <div className="flex flex-col gap-3">
          <span className="t-label">Cadastro de produtor</span>
          <h1 className="t-display max-w-xl text-[2.15rem] sm:text-[2.625rem]">
            Complete seus dados para solicitar lotes.
          </h1>
          <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
            Estes dados rurais complementam sua conta e habilitam o envio de lotes para
            análise do escritório responsável pelo remate.
          </p>
        </div>

        <div className="flex gap-3 rounded-xl border border-border bg-card p-4.5">
          <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <strong className="text-[13px] font-medium">Identificação da propriedade</strong>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Informe os dados que o escritório usará para analisar sua solicitação.
            </p>
          </div>
        </div>
      </div>

      <form className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 [&_input]:font-normal sm:p-6" onSubmit={onSubmit}>
        <header className="border-b border-border pb-4">
          <span className="t-label">Perfil rural</span>
          <h2 className="mt-1.5 font-[family-name:var(--font-display)] text-xl font-bold">
            Dados do produtor
          </h2>
        </header>

        <Field label="Nome da fazenda">
          <Input
            className="h-11"
            placeholder="Fazenda Santa Maria"
            value={form.farmName}
            onChange={(event) => onFieldChange('farmName', event.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Inscrição rural">
            <Input
              className="h-11"
              placeholder="Registro do produtor"
              value={form.ruralRegistration}
              onChange={(event) => onFieldChange('ruralRegistration', event.target.value)}
            />
          </Field>
          <Field label="Inscrição estadual">
            <Input
              className="h-11"
              placeholder="IE"
              value={form.stateRegistration}
              onChange={(event) => onFieldChange('stateRegistration', event.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_110px_110px]">
          <Field label="Cidade">
            <Input
              className="h-11"
              placeholder="Campo Grande"
              value={form.city}
              onChange={(event) => onFieldChange('city', event.target.value)}
            />
          </Field>
          <Field label="Estado">
            <Input
              className="h-11 uppercase"
              maxLength={2}
              placeholder="MS"
              value={form.state}
              onChange={(event) => onFieldChange('state', event.target.value.toUpperCase())}
            />
          </Field>
          <Field label="País">
            <Input
              className="h-11 uppercase"
              placeholder="BR"
              value={form.country}
              onChange={(event) => onFieldChange('country', event.target.value.toUpperCase())}
            />
          </Field>
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive">
            {error}
          </p>
        )}

        <Button className="h-11 self-start" disabled={isSubmitting} type="submit">
          {isSubmitting ? 'Salvando...' : 'Salvar e solicitar lote'}
        </Button>
      </form>
    </section>
  );
}
