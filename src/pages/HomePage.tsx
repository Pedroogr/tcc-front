import { CalendarDays, Gavel, Plus, Radio, Search, Sprout } from 'lucide-react';
import type { Auction } from '@/types/auction';
import { AuctionCard, AuctionCardSkeleton } from '@/components/AuctionCard';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type AuctionStatusFilter = 'ALL' | 'LIVE' | 'SCHEDULED' | 'FINISHED';

type HomePageProps = {
  auctions: Auction[];
  filteredAuctions: Auction[];
  auctionStatusFilter: AuctionStatusFilter;
  isLoading: boolean;
  error: string;
  createdUserName: string | null;
  createdLotId: string | null;
  createdAuctionId: string | null;
  isAuctionHouse: boolean;
  isSeller: boolean;
  canCompleteSellerProfile: boolean;
  canRegisterLot: boolean;
  getAuctionLotCount: (auction: Auction) => number;
  isOwnAuction: (auction: Auction) => boolean;
  onFilterChange: (filter: AuctionStatusFilter) => void;
  onEnterAuction: (auctionId: string) => void;
  onCreateAuction: () => void;
  onRegisterLot: () => void;
  onCompleteSellerProfile: () => void;
};

const filters: Array<{ value: AuctionStatusFilter; label: string }> = [
  { value: 'ALL', label: 'Todos' },
  { value: 'LIVE', label: 'Ao vivo' },
  { value: 'SCHEDULED', label: 'Agendados' },
  { value: 'FINISHED', label: 'Finalizados' },
];

function getDisplayStatus(auction: Auction) {
  if (auction.stream?.status === 'LIVE') return 'LIVE';
  if (auction.stream?.status === 'ENDED') return 'FINISHED';
  return auction.status;
}

export function HomePage({
  auctions,
  filteredAuctions,
  auctionStatusFilter,
  isLoading,
  error,
  createdUserName,
  createdLotId,
  createdAuctionId,
  isAuctionHouse,
  isSeller,
  canCompleteSellerProfile,
  canRegisterLot,
  getAuctionLotCount,
  isOwnAuction,
  onFilterChange,
  onEnterAuction,
  onCreateAuction,
  onRegisterLot,
  onCompleteSellerProfile,
}: HomePageProps) {
  const liveCount = auctions.filter((auction) => getDisplayStatus(auction) === 'LIVE').length;
  const scheduledCount = auctions.filter(
    (auction) => getDisplayStatus(auction) === 'SCHEDULED',
  ).length;
  const lotCount = auctions.reduce(
    (total, auction) => total + getAuctionLotCount(auction),
    0,
  );
  const roleLabel = isAuctionHouse ? 'Escritório' : isSeller ? 'Vendedor' : 'Comprador';

  return (
    <div className="mx-auto grid w-full max-w-[1360px] gap-7 px-4 py-7 sm:px-6 sm:py-9 lg:gap-9 lg:px-8">
      <section className="relative overflow-hidden rounded-xl border border-brand-line bg-card px-5 py-6 sm:px-7 sm:py-8 lg:px-9">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_92%_14%,color-mix(in_srgb,var(--primary)_16%,transparent),transparent_30%),linear-gradient(120deg,transparent_55%,color-mix(in_srgb,var(--brand-tint)_72%,transparent))]"
        />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <span className="t-label inline-flex items-center gap-2">
              <Radio className="size-3.5 text-live" aria-hidden="true" />
              Central de remates · {roleLabel}
            </span>
            <h1 className="t-display mt-3 max-w-2xl text-[clamp(2.25rem,6vw,3.75rem)] text-foreground">
              Remates disponíveis
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              Veja o que está ao vivo, encontre os próximos eventos e entre na sala
              para acompanhar os lotes.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap lg:max-w-md lg:justify-end">
            {canCompleteSellerProfile && (
              <Button
                variant="secondary"
                className="h-11 rounded-md px-4 font-semibold"
                type="button"
                onClick={onCompleteSellerProfile}
              >
                <Sprout className="size-4" />
                Cadastro de produtor
              </Button>
            )}
            {canRegisterLot && (
              <Button
                variant="secondary"
                className="h-11 rounded-md border border-brand-line px-4 font-semibold"
                type="button"
                onClick={onRegisterLot}
              >
                <Gavel className="size-4" />
                {isAuctionHouse ? 'Adicionar lote' : 'Enviar lote'}
              </Button>
            )}
            {isAuctionHouse && (
              <Button
                className="h-11 rounded-md px-4 font-semibold"
                type="button"
                onClick={onCreateAuction}
              >
                <Plus className="size-4" />
                Criar remate
              </Button>
            )}
          </div>
        </div>
      </section>

      <section aria-label="Resumo dos remates" className="grid grid-cols-3 divide-x divide-border rounded-xl border border-border bg-card">
        <div className="grid min-w-0 gap-1 px-3 py-4 sm:px-5">
          <span className="t-label truncate">Ao vivo</span>
          <strong className="text-xl font-semibold tabular-nums text-foreground sm:text-2xl">
            {liveCount}
          </strong>
        </div>
        <div className="grid min-w-0 gap-1 px-3 py-4 sm:px-5">
          <span className="t-label truncate">Agendados</span>
          <strong className="text-xl font-semibold tabular-nums text-foreground sm:text-2xl">
            {scheduledCount}
          </strong>
        </div>
        <div className="grid min-w-0 gap-1 px-3 py-4 sm:px-5">
          <span className="t-label truncate">Lotes</span>
          <strong className="text-xl font-semibold tabular-nums text-foreground sm:text-2xl">
            {lotCount}
          </strong>
        </div>
      </section>

      {(createdUserName || createdLotId || createdAuctionId || error) && (
        <div className="grid gap-2" aria-live="polite">
          {createdUserName && (
            <p className="rounded-md border border-brand-line bg-brand-tint px-4 py-3 text-sm text-success">
              Bem-vindo, {createdUserName}.
            </p>
          )}
          {createdLotId && (
            <p className="rounded-md border border-brand-line bg-brand-tint px-4 py-3 text-sm text-success">
              {isAuctionHouse
                ? 'Lote adicionado ao remate.'
                : 'Lote enviado para aprovação do escritório.'}
            </p>
          )}
          {createdAuctionId && (
            <p className="rounded-md border border-brand-line bg-brand-tint px-4 py-3 text-sm text-success">
              Remate criado e pronto para receber lotes.
            </p>
          )}
          {error && (
            <p className="rounded-md border border-destructive/40 bg-card px-4 py-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>
      )}

      <section aria-labelledby="auction-list-title" className="grid gap-5">
        <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="t-label">Agenda</span>
            <h2 id="auction-list-title" className="t-section mt-2 text-foreground">
              Leilões e transmissões
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {auctions.length}{' '}
              {auctions.length === 1 ? 'remate encontrado' : 'remates encontrados'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex" aria-label="Filtrar remates">
            {filters.map((filter) => {
              const selected = auctionStatusFilter === filter.value;
              return (
                <button
                  key={filter.value}
                  aria-pressed={selected}
                  className={cn(
                    'h-10 rounded-md border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-4',
                    selected
                      ? 'border-brand-line bg-brand-tint text-primary'
                      : 'border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                  type="button"
                  onClick={() => onFilterChange(filter.value)}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" aria-label="Carregando remates">
            {Array.from({ length: 3 }).map((_, index) => (
              <AuctionCardSkeleton key={index} />
            ))}
          </div>
        ) : filteredAuctions.length === 0 ? (
          <div className="grid justify-items-center rounded-xl border border-dashed border-input bg-card px-5 py-12 text-center">
            <span className="grid size-11 place-items-center rounded-lg bg-muted text-primary">
              {auctionStatusFilter === 'ALL' ? (
                <CalendarDays className="size-5" aria-hidden="true" />
              ) : (
                <Search className="size-5" aria-hidden="true" />
              )}
            </span>
            <h3 className="mt-4 font-[family-name:var(--font-display)] text-xl font-bold text-foreground">
              {auctionStatusFilter === 'ALL'
                ? 'Nenhum remate disponível no momento'
                : 'Nenhum remate neste filtro'}
            </h3>
            <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
              {auctionStatusFilter === 'ALL'
                ? 'Quando novos eventos forem publicados, eles aparecerão aqui com status, data e informações dos lotes.'
                : 'Escolha outro status para consultar os demais eventos disponíveis.'}
            </p>
            {auctionStatusFilter !== 'ALL' && (
              <Button
                variant="secondary"
                className="mt-5 rounded-md font-semibold"
                type="button"
                onClick={() => onFilterChange('ALL')}
              >
                Ver todos os remates
              </Button>
            )}
            {auctionStatusFilter === 'ALL' && isAuctionHouse && (
              <Button
                className="mt-5 rounded-md font-semibold"
                type="button"
                onClick={onCreateAuction}
              >
                <Plus className="size-4" />
                Criar primeiro remate
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredAuctions.map((auction, index) => (
              <AuctionCard
                key={auction.id}
                auction={auction}
                lotCount={getAuctionLotCount(auction)}
                isOwnAuction={isAuctionHouse && isOwnAuction(auction)}
                isHighlighted={auction.id === createdAuctionId}
                onEnter={onEnterAuction}
                index={index}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
