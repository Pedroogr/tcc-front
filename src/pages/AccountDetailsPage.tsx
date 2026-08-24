import { ArrowLeft, Building2, CircleUserRound, ShieldCheck } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { AuctionHouse, User } from '@/types/user';

export interface AccountDetailsPageProps {
  auctionHouse: AuctionHouse | null;
  user: User | null;
  error: string;
  onBack: () => void;
  resolveMediaUrl: (url: string) => string;
}

interface AccountRow {
  label: string;
  value: string;
}

interface AccountIdentity {
  description: string;
  eyebrow: string;
  initials: string;
  logoUrl: string | null;
  rows: AccountRow[];
  title: string;
  typeLabel: string;
}

function getInitials(name: string) {
  return (name || 'CA').trim().slice(0, 2).toUpperCase();
}

function getAccountIdentity(
  auctionHouse: AuctionHouse | null,
  user: User | null,
): AccountIdentity {
  if (auctionHouse) {
    return {
      description: 'Informações públicas e operacionais da conta autenticada.',
      eyebrow: 'Dados do escritório',
      initials: getInitials(auctionHouse.name),
      logoUrl: auctionHouse.logoUrl || null,
      title: auctionHouse.name,
      typeLabel: 'Escritório',
      rows: [
        { label: 'Nome', value: auctionHouse.name },
        { label: 'CNPJ/documento', value: auctionHouse.document || '-' },
        { label: 'E-mail', value: auctionHouse.email },
        { label: 'Telefone', value: auctionHouse.phone || '-' },
        { label: 'Cidade', value: auctionHouse.city || '-' },
        { label: 'Estado', value: auctionHouse.state || '-' },
        { label: 'País', value: auctionHouse.country || '-' },
        { label: 'Status da conta', value: auctionHouse.status },
      ],
    };
  }

  const producerStatus = user?.sellerProfile
    ? user.sellerProfile.verificationStatus || 'Cadastrado'
    : 'Não cadastrado';
  const name = user?.name || 'Minha conta';

  return {
    description: 'Informações da conta autenticada e situação do cadastro de produtor.',
    eyebrow: 'Meus dados',
    initials: getInitials(user?.name || 'CA'),
    logoUrl: null,
    title: name,
    typeLabel: 'Usuário',
    rows: [
      { label: 'Nome', value: user?.name || '-' },
      { label: 'CPF/documento', value: user?.document || '-' },
      { label: 'E-mail', value: user?.email || '-' },
      { label: 'Telefone', value: user?.phone || '-' },
      { label: 'Status da conta', value: user?.status || '-' },
      { label: 'Status do cadastro de produtor', value: producerStatus },
    ],
  };
}

export function AccountDetailsPage({
  auctionHouse,
  user,
  error,
  onBack,
  resolveMediaUrl,
}: AccountDetailsPageProps) {
  const account = getAccountIdentity(auctionHouse, user);
  const AccountIcon = auctionHouse ? Building2 : CircleUserRound;

  return (
    <section className="relative mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-14">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 -z-10 h-72 w-72 rounded-full bg-primary/5 blur-3xl"
      />

      <Button className="mb-6 -ml-3 gap-2" type="button" variant="ghost" onClick={onBack}>
        <ArrowLeft aria-hidden="true" />
        Voltar aos remates
      </Button>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.78fr)_minmax(34rem,1.22fr)] lg:gap-10">
        <header className="grid gap-6 lg:sticky lg:top-28">
          <span className="grid size-12 place-items-center rounded-lg border border-brand-line bg-brand-tint text-primary">
            <AccountIcon aria-hidden="true" className="size-5" />
          </span>

          <div>
            <p className="t-label">{account.eyebrow}</p>
            <h1 className="t-display mt-3 text-balance text-foreground">{account.title}</h1>
            <p className="mt-4 max-w-lg text-sm leading-7 text-muted-foreground sm:text-base">
              {account.description}
            </p>
          </div>

          <div className="hidden items-center gap-3 border-t border-border pt-5 text-sm text-muted-foreground lg:flex">
            <ShieldCheck aria-hidden="true" className="size-4 text-success" />
            Sessão autenticada
          </div>
        </header>

        <Card className="overflow-hidden border-border bg-card py-0 shadow-[0_24px_70px_rgb(0_0_0/0.28)]">
          <CardHeader className="flex flex-row items-center gap-4 border-b border-border bg-muted/35 px-5 py-6 sm:px-7">
            <Avatar className="size-16 rounded-xl border border-brand-line bg-brand-tint sm:size-20" size="lg">
              {account.logoUrl ? (
                <AvatarImage
                  alt={`Logo de ${account.title}`}
                  className="object-contain p-2"
                  src={resolveMediaUrl(account.logoUrl)}
                />
              ) : null}
              <AvatarFallback className="rounded-xl bg-brand-tint text-lg font-semibold text-primary sm:text-xl">
                {account.initials}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0">
              <Badge className="mb-2 rounded-md" variant="outline">
                {account.typeLabel}
              </Badge>
              <h2 className="truncate font-[family-name:var(--font-display)] text-lg font-bold text-card-foreground sm:text-xl">
                {account.title}
              </h2>
            </div>
          </CardHeader>

          <CardContent className="px-5 py-6 sm:px-7 sm:py-7">
            <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
              {account.rows.map((row) => (
                <div className="min-w-0 bg-muted px-4 py-4 sm:min-h-24" key={row.label}>
                  <dt className="t-label text-[0.625rem]">{row.label}</dt>
                  <dd className="mt-2 break-words text-sm font-medium leading-6 text-foreground">
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      {error ? (
        <p
          className="mt-6 rounded-lg border border-destructive/45 bg-card px-4 py-3 text-sm leading-relaxed text-destructive"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
