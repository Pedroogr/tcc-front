import type { FormEventHandler, ReactNode } from 'react';
import { Building2, CheckCircle2, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';

export interface OfficeInviteFormState {
  name: string;
  document: string;
  email: string;
  phone: string;
  password: string;
  city: string;
  state: string;
  country: string;
}

export type OfficeInviteField = keyof OfficeInviteFormState;
export type OfficeInviteStatus = 'idle' | 'valid' | 'invalid';

export interface OfficeInvitePageProps {
  form: Readonly<OfficeInviteFormState>;
  status: OfficeInviteStatus;
  isValidating: boolean;
  isEmailLocked: boolean;
  showDevDocumentTools: boolean;
  isSubmitting: boolean;
  error: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onFieldChange: (field: OfficeInviteField, value: string) => void;
  onDocumentChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onFillDevDocument: () => void;
}

interface FieldProps {
  children: ReactNode;
  htmlFor: string;
  label: string;
  hint?: string;
}

function Field({ children, htmlFor, label, hint }: FieldProps) {
  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium text-foreground" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function OfficeInvitePage({
  form,
  status,
  isValidating,
  isEmailLocked,
  showDevDocumentTools,
  isSubmitting,
  error,
  onSubmit,
  onFieldChange,
  onDocumentChange,
  onPhoneChange,
  onFillDevDocument,
}: OfficeInvitePageProps) {
  const isCheckingInvite = isValidating || status === 'idle';

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-4 py-8 text-foreground sm:px-6 sm:py-12 lg:px-8 lg:py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top_left,color-mix(in_srgb,var(--primary)_18%,transparent),transparent_58%)]"
      />

      <section className="relative mx-auto grid w-full max-w-6xl items-start gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(32rem,1.18fr)] lg:gap-14">
        <div className="flex min-h-0 flex-col lg:sticky lg:top-16 lg:min-h-[34rem]">
          <div className="inline-flex w-fit items-center gap-3 text-sm font-semibold tracking-tight">
            <span className="grid size-10 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
              CA
            </span>
            Cattle Auction
          </div>

          <div className="mt-16 max-w-xl lg:mt-auto lg:mb-auto">
            <p className="t-label mb-4 flex items-center gap-2 text-primary">
              <ShieldCheck aria-hidden="true" className="size-4" />
              Convite de escritório
            </p>
            <h1 className="t-display text-balance">Cadastro do escritório</h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-muted-foreground">
              Este cadastro é liberado apenas pelo link de convite enviado pela plataforma.
              Confirme os dados para ativar o acesso do seu escritório.
            </p>
          </div>

          <div className="mt-10 hidden items-center gap-3 border-t border-border pt-6 text-sm text-muted-foreground lg:flex">
            <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
            Convite individual e protegido
          </div>
        </div>

        <form aria-busy={isCheckingInvite || isSubmitting} onSubmit={onSubmit}>
          <Card className="gap-0 overflow-hidden border-border bg-card/95 py-0 shadow-[0_24px_80px_rgb(0_0_0/0.32)] backdrop-blur-sm">
            <CardHeader className="border-b border-border px-5 py-6 sm:px-8">
              <div className="flex items-start gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-tint text-primary ring-1 ring-brand-line">
                  <Building2 aria-hidden="true" className="size-5" />
                </span>
                <div className="grid gap-1.5">
                  <CardTitle className="font-[family-name:var(--font-display)] text-xl font-bold">
                    Dados do escritório
                  </CardTitle>
                  <CardDescription className="leading-relaxed">
                    Use os dados oficiais da empresa responsável pelos remates.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="px-5 py-6 sm:px-8 sm:py-8">
              {isCheckingInvite ? (
                <div
                  className="flex min-h-48 flex-col items-center justify-center gap-4 rounded-lg border border-border bg-muted/60 px-6 text-center"
                  role="status"
                >
                  <LoaderCircle
                    aria-hidden="true"
                    className="size-7 text-primary motion-safe:animate-spin"
                  />
                  <div>
                    <p className="font-medium text-foreground">Validando convite...</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Isso deve levar apenas alguns segundos.
                    </p>
                  </div>
                </div>
              ) : status === 'invalid' ? (
                <div
                  className="rounded-lg border border-destructive/45 bg-card px-5 py-4 text-sm leading-relaxed text-destructive"
                  role="alert"
                >
                  Link inválido, expirado ou já utilizado. Solicite um novo convite.
                </div>
              ) : (
                <div className="grid gap-6">
                  <Field htmlFor="office-name" label="Nome do escritório">
                    <Input
                      autoComplete="organization"
                      id="office-name"
                      placeholder="Leilões Campo Alto"
                      required
                      value={form.name}
                      onChange={(event) => onFieldChange('name', event.target.value)}
                    />
                  </Field>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field
                      hint={isEmailLocked ? 'E-mail definido pelo convite.' : undefined}
                      htmlFor="office-email"
                      label="E-mail"
                    >
                      <div className="relative">
                        <Input
                          aria-describedby={isEmailLocked ? 'office-email-lock-hint' : undefined}
                          autoComplete="email"
                          className={isEmailLocked ? 'pr-10 text-muted-foreground' : undefined}
                          id="office-email"
                          placeholder="escritorio@email.com"
                          readOnly={isEmailLocked}
                          required
                          type="email"
                          value={form.email}
                          onChange={(event) => onFieldChange('email', event.target.value)}
                        />
                        {isEmailLocked ? (
                          <LockKeyhole
                            aria-hidden="true"
                            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                          />
                        ) : null}
                      </div>
                      {isEmailLocked ? (
                        <span className="sr-only" id="office-email-lock-hint">
                          E-mail definido pelo convite e bloqueado para edição.
                        </span>
                      ) : null}
                    </Field>

                    <Field htmlFor="office-password" label="Senha">
                      <Input
                        autoComplete="new-password"
                        id="office-password"
                        minLength={6}
                        placeholder="Mínimo 6 caracteres"
                        required
                        type="password"
                        value={form.password}
                        onChange={(event) => onFieldChange('password', event.target.value)}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <Field htmlFor="office-document" label="CNPJ">
                      <Input
                        autoComplete="off"
                        id="office-document"
                        inputMode="numeric"
                        maxLength={18}
                        placeholder="00.000.000/0000-00"
                        value={form.document}
                        onChange={(event) => onDocumentChange(event.target.value)}
                      />
                      {showDevDocumentTools ? (
                        <Button
                          className="h-auto w-fit px-0 py-0 text-xs"
                          type="button"
                          variant="link"
                          onClick={onFillDevDocument}
                        >
                          Gerar CNPJ de teste
                        </Button>
                      ) : null}
                    </Field>

                    <Field htmlFor="office-phone" label="Telefone">
                      <Input
                        autoComplete="tel"
                        id="office-phone"
                        inputMode="numeric"
                        maxLength={15}
                        placeholder="(00) 00000-0000"
                        value={form.phone}
                        onChange={(event) => onPhoneChange(event.target.value)}
                      />
                    </Field>
                  </div>

                  <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_7rem_7rem]">
                    <Field htmlFor="office-city" label="Cidade">
                      <Input
                        autoComplete="address-level2"
                        id="office-city"
                        placeholder="Campo Grande"
                        value={form.city}
                        onChange={(event) => onFieldChange('city', event.target.value)}
                      />
                    </Field>

                    <Field htmlFor="office-state" label="Estado">
                      <Input
                        autoComplete="address-level1"
                        id="office-state"
                        maxLength={2}
                        placeholder="MS"
                        value={form.state}
                        onChange={(event) =>
                          onFieldChange('state', event.target.value.toUpperCase())
                        }
                      />
                    </Field>

                    <Field htmlFor="office-country" label="País">
                      <Input
                        autoComplete="country"
                        id="office-country"
                        placeholder="BR"
                        value={form.country}
                        onChange={(event) => onFieldChange('country', event.target.value)}
                      />
                    </Field>
                  </div>

                  {error ? (
                    <p
                      className="rounded-lg border border-destructive/45 bg-card px-4 py-3 text-sm leading-relaxed text-destructive"
                      role="alert"
                    >
                      {error}
                    </p>
                  ) : null}

                  <Button
                    className="mt-1 h-11 w-full text-sm font-semibold"
                    disabled={isSubmitting || status !== 'valid'}
                    size="lg"
                    type="submit"
                  >
                    {isSubmitting ? (
                      <>
                        <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
                        Criando escritório...
                      </>
                    ) : (
                      'Criar conta do escritório'
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </form>
      </section>
    </main>
  );
}
