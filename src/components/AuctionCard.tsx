import { motion } from 'motion/react';
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
import { Badge } from '@/components/ui/badge';
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
    LIVE: 'border-live/20 bg-live text-white shadow-[0_10px_24px_rgba(201,42,31,0.26)]',
    SCHEDULED: 'border-scheduled/20 bg-scheduled text-white',
    FINISHED: 'border-slate-500/20 bg-slate-700 text-white',
    CANCELED: 'border-destructive/20 bg-destructive text-white',
    STREAM_ENDED: 'border-slate-500/20 bg-slate-700 text-white',
    STREAM_INTERRUPTED: 'border-amber-500/25 bg-amber-500 text-white',
    DRAFT: 'border-white/25 bg-white/20 text-white',
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
  const statusKey = getAuctionStatusKey(auction);
  const thumbnailUrl =
    auction.thumbnailUrl && !imageFailed ? resolveMediaUrl(auction.thumbnailUrl) : '';

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, delay: Math.min(index * 0.05, 0.3), ease: 'easeOut' }}
      whileHover={{ y: -4 }}
      className="h-full"
    >
      <Card
        className={cn(
          'group h-full overflow-hidden rounded-[20px] border-primary/10 bg-white py-0 shadow-[0_10px_30px_rgba(15,23,42,0.08)] transition-shadow duration-300 hover:shadow-[0_16px_40px_rgba(15,23,42,0.13)]',
          isHighlighted && 'border-primary/40 ring-2 ring-primary/10',
        )}
      >
        <button
          aria-label={`Entrar no remate ${auction.title}`}
          className="relative block aspect-video w-full overflow-hidden bg-primary text-left"
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
              className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(135deg,#14382d,#1e6f50_58%,#8b7444)]">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.18),transparent_30%),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.10)_1px,transparent_1px)] bg-[length:auto,34px_34px,34px_34px]" />
              <div className="relative grid justify-items-center gap-2 text-center text-white">
                <span className="grid size-14 place-items-center rounded-2xl border border-white/25 bg-white/20 shadow-inner">
                  <ImageIcon className="size-6" />
                </span>
                <strong className="text-lg font-black">Remate online</strong>
                <small className="font-bold text-white/75">
                  Transmissão e lotes em destaque
                </small>
              </div>
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-b from-[#07130f]/75 via-[#07130f]/10 to-[#07130f]/70" />

          <div className="absolute left-4 right-4 top-4 flex flex-wrap items-center gap-2">
            <Badge
              asChild
              className={cn('h-8 border px-3 text-[11px] font-black tracking-wide', getStatusBadgeClass(statusKey))}
            >
              <motion.span
                key={statusKey}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.18 }}
              >
                {statusKey === 'LIVE' && <Radio className="size-3.5" />}
                {formatAuctionStatus(statusKey)}
              </motion.span>
            </Badge>
            {isOwnAuction && (
              <Badge className="h-8 border border-white/30 bg-white/90 px-3 text-[11px] font-black tracking-wide text-primary">
                MEU REMATE
              </Badge>
            )}
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="absolute bottom-4 right-4 grid size-11 place-items-center rounded-full border border-white/35 bg-white/25 text-white shadow-lg transition-transform duration-300 group-hover:scale-105">
                <Play className="ml-0.5 size-4 fill-current" />
              </span>
            </TooltipTrigger>
            <TooltipContent>Entrar no remate</TooltipContent>
          </Tooltip>
        </button>

        <CardContent className="grid gap-5 p-6">
          <div className="grid gap-2">
            <span className="text-xs font-black uppercase tracking-[0.12em] text-primary">
              {auction.auctionHouse?.name || 'Escritório'}
            </span>
            <h2 className="line-clamp-2 text-2xl font-black leading-tight text-foreground">
              {auction.title}
            </h2>
            <p className="line-clamp-2 min-h-12 text-sm leading-6 text-muted-foreground">
              {auction.description || 'Remate disponível para acompanhamento online.'}
            </p>
          </div>

          <dl className="grid gap-3 border-y border-border/80 py-4 sm:grid-cols-3">
            <div className="grid gap-1">
              <dt className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                <GalleryVerticalEnd className="size-3.5 text-primary" />
                Lotes
              </dt>
              <dd className="font-black text-foreground">{lotCount}</dd>
            </div>
            <div className="grid gap-1">
              <dt className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                <Building2 className="size-3.5 text-primary" />
                Escritório
              </dt>
              <dd className="truncate font-black text-foreground">
                {auction.auctionHouse?.name || '-'}
              </dd>
            </div>
            <div className="grid gap-1">
              <dt className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wide text-muted-foreground">
                <CalendarDays className="size-3.5 text-primary" />
                Data
              </dt>
              <dd className="font-black text-foreground">{getAuctionDateLabel(auction)}</dd>
            </div>
          </dl>

          <Button
            className="h-12 rounded-full bg-primary text-base font-black text-primary-foreground shadow-[0_14px_34px_rgba(18,98,70,0.24)] hover:bg-primary/92"
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
    <Card className="overflow-hidden rounded-[20px] border-primary/10 bg-white py-0 shadow-[0_10px_30px_rgba(15,23,42,0.07)]">
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
        <Skeleton className="h-12 rounded-full" />
      </CardContent>
    </Card>
  );
}
