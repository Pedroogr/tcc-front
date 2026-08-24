import type { FormEventHandler } from 'react';
import { Gavel, Radio, ShieldCheck, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { UserAccountType } from '@/types/user';
import { cn } from '@/lib/utils';

type AuthMode = 'login' | 'register';

type UserFormState = {
  name: string;
  email: string;
  password: string;
  phone: string;
  document: string;
};

type SellerProfileFormState = {
  farmName: string;
  ruralRegistration: string;
  stateRegistration: string;
  city: string;
  state: string;
  country: string;
};

type AuthPageProps = {
  authMode: AuthMode;
  accountType: UserAccountType;
  userForm: UserFormState;
  sellerProfileForm: SellerProfileFormState;
  isSubmitting: boolean;
  error: string;
  showDevDocumentTools: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onAuthModeChange: (mode: AuthMode) => void;
  onAccountTypeChange: (type: UserAccountType) => void;
  onUserFieldChange: (field: keyof UserFormState, value: string) => void;
  onUserPhoneChange: (value: string) => void;
  onUserDocumentChange: (value: string) => void;
  onFillDevUserCpf: () => void;
  onSellerProfileFieldChange: (
    field: keyof SellerProfileFormState,
    value: string,
  ) => void;
};

const fieldClassName =
  'h-11 rounded-md border-input bg-muted px-3 text-foreground placeholder:text-placeholder focus-visible:border-ring';

const labelClassName = 'grid gap-2 text-sm font-medium text-foreground';

function getSubmitLabel(isSubmitting: boolean, authMode: AuthMode) {
  if (isSubmitting) return 'Processando...';
  return authMode === 'register' ? 'Criar conta e entrar' : 'Entrar';
}

export function AuthPage({
  authMode,
  accountType,
  userForm,
  sellerProfileForm,
  isSubmitting,
  error,
  showDevDocumentTools,
  onSubmit,
  onAuthModeChange,
  onAccountTypeChange,
  onUserFieldChange,
  onUserPhoneChange,
  onUserDocumentChange,
  onFillDevUserCpf,
  onSellerProfileFieldChange,
}: AuthPageProps) {
  const isRegisterMode = authMode === 'register';

  return (
    <main className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_18%,color-mix(in_srgb,var(--primary)_13%,transparent),transparent_32%),radial-gradient(circle_at_88%_90%,color-mix(in_srgb,var(--brand-line)_22%,transparent),transparent_34%)]"
      />

      <div className="relative mx-auto grid min-h-dvh w-full max-w-[1280px] items-center gap-8 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(480px,1.1fr)] lg:gap-16 lg:px-10">
        <section className="grid content-center gap-8 py-4 lg:min-h-[680px] lg:py-10">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-lg border border-brand-line bg-brand-tint text-sm font-semibold text-primary">
              CA
            </span>
            <span className="grid leading-tight">
              <strong className="font-semibold text-foreground">Cattle Auction</strong>
              <small className="text-xs text-muted-foreground">Remates digitais</small>
            </span>
          </div>

          <div className="max-w-xl">
            <span className="t-label inline-flex items-center gap-2">
              <Radio className="size-3.5 text-live" aria-hidden="true" />
              Plataforma de remates
            </span>
            <h1 className="mt-4 font-[family-name:var(--font-display)] text-[clamp(2.25rem,6vw,4.25rem)] font-bold leading-[0.98] tracking-[-0.035em] text-foreground">
              O remate em tempo real, sem perder o campo de vista.
            </h1>
            <p className="mt-5 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
              Acompanhe transmissões, encontre o lote em pista e participe de cada
              lance em uma operação clara e segura.
            </p>
          </div>

          <div className="hidden max-w-xl grid-cols-3 divide-x divide-border border-y border-border py-5 sm:grid">
            <div className="grid gap-1 pr-4">
              <Gavel className="size-4 text-primary" aria-hidden="true" />
              <strong className="mt-2 text-sm font-semibold">Lances ao vivo</strong>
              <span className="text-xs leading-5 text-muted-foreground">Atualização em tempo real</span>
            </div>
            <div className="grid gap-1 px-4">
              <ShieldCheck className="size-4 text-success" aria-hidden="true" />
              <strong className="mt-2 text-sm font-semibold">Acesso seguro</strong>
              <span className="text-xs leading-5 text-muted-foreground">Perfis e aprovações</span>
            </div>
            <div className="grid gap-1 pl-4">
              <Sprout className="size-4 text-primary" aria-hidden="true" />
              <strong className="mt-2 text-sm font-semibold">Do campo à pista</strong>
              <span className="text-xs leading-5 text-muted-foreground">Lotes e compradores</span>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="auth-title"
          className="w-full self-center rounded-xl border border-border bg-card p-4 shadow-[0_28px_80px_rgb(0_0_0/0.28)] sm:p-7 lg:p-8"
        >
          <div
            className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1"
            aria-label="Modo de acesso"
          >
            {(['login', 'register'] as const).map((mode) => {
              const selected = authMode === mode;
              return (
                <button
                  key={mode}
                  aria-pressed={selected}
                  className={cn(
                    'h-10 rounded-md text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    selected
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                  type="button"
                  onClick={() => onAuthModeChange(mode)}
                >
                  {mode === 'login' ? 'Login' : 'Cadastro'}
                </button>
              );
            })}
          </div>

          <div className="mb-6 mt-7">
            <span className="t-label">Acesso da plataforma</span>
            <h2 id="auth-title" className="t-section mt-2 text-foreground">
              {isRegisterMode ? 'Crie sua conta' : 'Entre na sua conta'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {isRegisterMode
                ? 'Escolha seu perfil e preencha os dados para começar.'
                : 'O sistema identifica automaticamente usuários e escritórios.'}
            </p>
          </div>

          <form className="grid gap-5" aria-busy={isSubmitting} onSubmit={onSubmit}>
            {isRegisterMode && (
              <label className={labelClassName}>
                Nome completo
                <Input
                  autoComplete="name"
                  className={fieldClassName}
                  required
                  value={userForm.name}
                  onChange={(event) => onUserFieldChange('name', event.target.value)}
                  placeholder="Pedro Ribeiro"
                />
              </label>
            )}

            {isRegisterMode && (
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium text-foreground">Tipo de cadastro</legend>
                <div className="grid grid-cols-2 gap-2">
                  {(['BUYER', 'SELLER'] as const).map((type) => {
                    const selected = accountType === type;
                    return (
                      <button
                        key={type}
                        aria-pressed={selected}
                        className={cn(
                          'h-11 rounded-md border text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          selected
                            ? 'border-brand-line bg-brand-tint text-primary'
                            : 'border-input bg-muted text-muted-foreground hover:text-foreground',
                        )}
                        type="button"
                        onClick={() => onAccountTypeChange(type)}
                      >
                        {type === 'BUYER' ? 'Comprador' : 'Vendedor'}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <label className={labelClassName}>
                E-mail
                <Input
                  autoComplete="email"
                  className={fieldClassName}
                  required
                  type="email"
                  value={userForm.email}
                  onChange={(event) => onUserFieldChange('email', event.target.value)}
                  placeholder="pedro@email.com"
                />
              </label>

              <label className={labelClassName}>
                Senha
                <Input
                  autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                  className={fieldClassName}
                  required
                  minLength={6}
                  type="password"
                  value={userForm.password}
                  onChange={(event) => onUserFieldChange('password', event.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
              </label>
            </div>

            {isRegisterMode && (
              <>
                <div className="grid gap-5 sm:grid-cols-2">
                  <label className={labelClassName}>
                    Telefone
                    <Input
                      autoComplete="tel"
                      className={fieldClassName}
                      inputMode="numeric"
                      maxLength={15}
                      value={userForm.phone}
                      onChange={(event) => onUserPhoneChange(event.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </label>

                  <label className={labelClassName}>
                    Documento
                    <Input
                      className={fieldClassName}
                      inputMode="numeric"
                      maxLength={18}
                      value={userForm.document}
                      onChange={(event) => onUserDocumentChange(event.target.value)}
                      placeholder="CPF ou CNPJ"
                    />
                    {showDevDocumentTools && (
                      <button
                        className="w-fit text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        type="button"
                        onClick={onFillDevUserCpf}
                      >
                        Gerar CPF de teste
                      </button>
                    )}
                  </label>
                </div>

                {accountType === 'SELLER' && (
                  <fieldset className="grid gap-5 border-t border-border pt-5">
                    <legend className="t-label pr-3">Dados do vendedor</legend>

                    <label className={labelClassName}>
                      Nome da fazenda
                      <Input
                        className={fieldClassName}
                        value={sellerProfileForm.farmName}
                        onChange={(event) =>
                          onSellerProfileFieldChange('farmName', event.target.value)
                        }
                        placeholder="Fazenda Santa Maria"
                      />
                    </label>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <label className={labelClassName}>
                        Inscrição rural
                        <Input
                          className={fieldClassName}
                          value={sellerProfileForm.ruralRegistration}
                          onChange={(event) =>
                            onSellerProfileFieldChange('ruralRegistration', event.target.value)
                          }
                          placeholder="Registro do produtor"
                        />
                      </label>

                      <label className={labelClassName}>
                        Inscrição estadual
                        <Input
                          className={fieldClassName}
                          value={sellerProfileForm.stateRegistration}
                          onChange={(event) =>
                            onSellerProfileFieldChange('stateRegistration', event.target.value)
                          }
                          placeholder="IE"
                        />
                      </label>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-[1fr_88px_88px]">
                      <label className={labelClassName}>
                        Cidade
                        <Input
                          className={fieldClassName}
                          value={sellerProfileForm.city}
                          onChange={(event) =>
                            onSellerProfileFieldChange('city', event.target.value)
                          }
                          placeholder="Campo Grande"
                        />
                      </label>

                      <label className={labelClassName}>
                        Estado
                        <Input
                          className={fieldClassName}
                          maxLength={2}
                          value={sellerProfileForm.state}
                          onChange={(event) =>
                            onSellerProfileFieldChange(
                              'state',
                              event.target.value.toUpperCase(),
                            )
                          }
                          placeholder="MS"
                        />
                      </label>

                      <label className={labelClassName}>
                        País
                        <Input
                          className={fieldClassName}
                          value={sellerProfileForm.country}
                          onChange={(event) =>
                            onSellerProfileFieldChange('country', event.target.value)
                          }
                          placeholder="BR"
                        />
                      </label>
                    </div>
                  </fieldset>
                )}
              </>
            )}

            {!isRegisterMode && (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
                Escritórios usam as credenciais institucionais criadas pelo sistema.
              </p>
            )}

            {error && (
              <p
                className="rounded-md border border-destructive/40 bg-card px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            )}

            <Button
              className="h-12 w-full rounded-md text-sm font-semibold"
              disabled={isSubmitting}
              type="submit"
            >
              {getSubmitLabel(isSubmitting, authMode)}
            </Button>
          </form>
        </section>
      </div>
    </main>
  );
}
