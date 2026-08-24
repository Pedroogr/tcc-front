import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  GalleryVerticalEnd,
  ImageIcon,
  Play,
  Radio,
} from 'lucide-react';
import { apiUrl } from '@/api/http';
import type { Auction } from '@/types/auction';
import { formatAuctionStatus } from '@/utils/auctionLabels';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useState } from 'react';

type AuctionCardProps = {
  auction: Auction;
  lotCount: number;
  isOwnAuction: boolean;
  isHighlighted: boolean;
  onEnter: (auctionId: string) => void;
  index?: number;
};

function resolveMediaUrl(url: string) {
  if (/^https?:\/\//.test(url)) {
    return url;
  }

  return `${apiUrl}${url}`;
}

function getAuctionStatusKey(auction: Auction) {
  if (auction.stream?.status === 'LIVE') {
    return 'LIVE';
  }

  if (auction.stream?.status === 'ENDED') {
    return 'STREAM_ENDED';
  }

  if (auction.stream?.status === 'ERROR') {
    return 'STREAM_INTERRUPTED';
  }

  return String(auction.status || 'DRAFT');
}

function getAuctionDateLabel(auction: Auction) {
  if (!auction.scheduledAt) {
    return 'A definir';
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(auction.scheduledAt));
}

function getStatusBadgeClass(statusKey: string) {
  const statusClasses: Record<string, string> = {
    LIVE: 'border-live bg-live text-primary-foreground',
    SCHEDULED: 'border-[#46381a] bg-[#241c0c] text-scheduled',
    FINISHED: 'border-input bg-muted text-muted-foreground',
    CANCELED: 'border-destructive/40 bg-card text-destructive',
    STREAM_ENDED: 'border-input bg-muted text-muted-foreground',
    STREAM_INTERRUPTED: 'border-[#5c2621] bg-[#2a1210] text-[#f0776c]',
    DRAFT: 'border-input bg-popover text-muted-foreground',
  };

  return statusClasses[statusKey] ?? statusClasses.DRAFT;
}

export function AuctionCard({
  auction,
  lotCount,
  isOwnAuction,
  isHighlighted,
  onEnter,
  index = 0,
}: AuctionCardProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const statusKey = getAuctionStatusKey(auction);
  const thumbnailUrl =
    auction.thumbnailUrl && !imageFailed ? resolveMediaUrl(auction.thumbnailUrl) : '';

  return (
    <motion.article
      initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, delay: Math.min(index * 0.04, 0.24), ease: 'easeOut' }}
      className="h-full"
    >
      <Card
        className={cn(
          'group h-full overflow-hidden rounded-xl border-border bg-card py-0 shadow-none transition-colors duration-200 hover:border-brand-line',
          isHighlighted && 'border-primary ring-2 ring-primary/20',
        )}
      >
        <button
          aria-label={`Entrar no remate ${auction.title}`}
          className="relative block aspect-[16/9] w-full overflow-hidden bg-brand-tint text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          type="button"
          onClick={() => onEnter(auction.id)}
        >
          {thumbnailUrl ? (
            <img
              alt=""
              src={thumbnailUrl}
              loading="lazy"
              decoding="async"
              onError={() => setImageFailed(true)}
              className="absolute inset-0 size-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.025]"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(135deg,var(--brand-tint),var(--brand-line))]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,color-mix(in_srgb,var(--primary)_24%,transparent),transparent_32%)]" />
              <div className="relative grid justify-items-center gap-2 px-4 text-center text-foreground">
                <span className="grid size-12 place-items-center rounded-lg border border-brand-line bg-card/70">
                  <ImageIcon className="size-5 text-primary" />
                </span>
                <strong className="text-base font-semibold">Remate online</strong>
                <small className="text-muted-foreground">
                  Transmissão e lotes em destaque
                </small>
              </div>
            </div>
          )}

          {thumbnailUrl && (
            <div className="absolute inset-0 bg-gradient-to-b from-[#07130f]/75 via-transparent to-[#07130f]/70" />
          )}

          <div className="absolute left-4 right-4 top-4 flex flex-wrap items-center gap-2">
            <motion.span
              key={statusKey}
              initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.16 }}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-[6px] border px-2.5 text-[11px] font-semibold tracking-[0.06em]',
                getStatusBadgeClass(statusKey),
              )}
            >
              {statusKey === 'LIVE' && <Radio className="size-3.5" />}
              {formatAuctionStatus(statusKey)}
            </motion.span>
            {isOwnAuction && (
              <span className="inline-flex h-7 items-center rounded-[6px] border border-brand-line bg-brand-tint px-2.5 text-[11px] font-semibold tracking-[0.06em] text-primary">
                MEU REMATE
              </span>
            )}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="absolute bottom-4 right-4 grid size-10 place-items-center rounded-full border border-white/30 bg-[#07130f]/65 text-white backdrop-blur-sm transition-colors hover:bg-[#07130f]/85">
                <Play className="ml-0.5 size-4 fill-current" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Entrar no remate</TooltipContent>
          </Tooltip>
        </button>

        <CardContent className="grid gap-5 p-5 sm:p-6">
          <div className="grid gap-2">
            <span className="t-label text-primary">
              {auction.auctionHouse?.name || 'Escritório'}
            </span>
            <h2 className="line-clamp-2 font-[family-name:var(--font-display)] text-2xl font-bold leading-tight tracking-[-0.015em] text-foreground">
              {auction.title}
            </h2>
            <p className="line-clamp-2 min-h-12 text-sm leading-6 text-muted-foreground">
              {auction.description || 'Remate disponível para acompanhamento online.'}
            </p>
          </div>

          <dl className="grid grid-cols-3 gap-3 border-y border-border py-4">
            <div className="grid gap-1">
              <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-subtle">
                <GalleryVerticalEnd className="size-3.5 text-primary" />
                Lotes
              </dt>
              <dd className="font-semibold tabular-nums text-foreground">{lotCount}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-subtle">
                <Building2 className="size-3.5 text-primary" />
                Escritório
              </dt>
              <dd className="truncate text-sm font-semibold text-foreground">
                {auction.auctionHouse?.name || '-'}
              </dd>
            </div>
            <div className="grid gap-1">
              <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-subtle">
                <CalendarDays className="size-3.5 text-primary" />
                Data
              </dt>
              <dd className="t-mono truncate text-foreground">{getAuctionDateLabel(auction)}</dd>
            </div>
          </dl>

          <Button
            className="h-11 rounded-md font-semibold"
            type="button"
            onClick={() => onEnter(auction.id)}
          >
            Entrar no remate
            <ArrowRight className="size-4" />
          </Button>
        </CardContent>
      </Card>
    </motion.article>
  );
}

export function AuctionCardSkeleton() {
  return (
    <Card className="overflow-hidden rounded-xl border-border bg-card py-0 shadow-none">
      <Skeleton className="aspect-video rounded-none" />
      <CardContent className="grid gap-5 p-6">
        <div className="grid gap-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-8 w-4/5" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="grid grid-cols-3 gap-3 border-y border-border/80 py-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
        <Skeleton className="h-11 rounded-md" />
      </CardContent>
    </Card>
  );
}
