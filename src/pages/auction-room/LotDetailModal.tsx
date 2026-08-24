import type { ChangeEvent } from 'react';
import { X } from 'lucide-react';
import type { Bid, Lot } from '@/types/lot';
import { Money } from '@/design/primitives/Money';
import { Button } from '@/components/ui/button';
import { formatBidStatus, formatLotStatus } from '@/utils/auctionLabels';

type PendingImage = {
  id: string;
  dataUrl: string;
  fileName: string;
};

type LotDetailModalProps = {
  lot: Lot;
  winningBid: Bid | null;
  canManage: boolean;
  /** Comprador logado — o escritorio nao da lance no proprio remate. */
  isBidder: boolean;
  isSubmitting: boolean;
  error: string;
  stageMessage: string;
  pendingImages: PendingImage[];
  resolveMediaUrl: (url: string) => string;
  onClose: () => void;
  onSetStage: (status: 'AVAILABLE' | 'IN_AUCTION') => void;
  onPendingImagesChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemovePendingImage: (imageId: string) => void;
  onSavePendingImages: () => void;
};

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5">
      <span className="t-label">{title}</span>
      {children}
    </section>
  );
}

export function LotDetailModal({
  lot,
  winningBid,
  canManage,
  isBidder,
  isSubmitting,
  error,
  stageMessage,
  pendingImages,
  resolveMediaUrl,
  onClose,
  onSetStage,
  onPendingImagesChange,
  onRemovePendingImage,
  onSavePendingImages,
}: LotDetailModalProps) {
  return (
    <div
      aria-labelledby="lot-detail-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8"
      role="dialog"
    >
      <section className="my-auto flex w-full max-w-2xl flex-col gap-5 rounded-xl border border-border bg-card p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="t-mono text-text-subtle">{lot.code}</span>
            <h2 className="t-section" id="lot-detail-title">
              {lot.title}
            </h2>
          </div>
          <Button
            aria-label="Fechar"
            size="icon"
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            <X />
          </Button>
        </header>

        {lot.media?.length ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {lot.media.map((media) => (
              <img
                alt={media.description || lot.title}
                className="aspect-4/3 w-full rounded-lg border border-border object-cover"
                key={media.id}
                loading="lazy"
                src={resolveMediaUrl(media.url)}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-input px-4 py-6 text-center text-[13px] text-muted-foreground">
            Este lote ainda não possui imagens.
          </p>
        )}

        <dl className="grid grid-cols-2 gap-4 rounded-[10px] bg-muted p-4 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <dt className="t-label">Valor inicial</dt>
            <dd>
              <Money size="sm" value={lot.initialPrice} />
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="t-label">Quantidade</dt>
            <dd className="text-sm font-medium tabular-nums">{lot.quantity}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="t-label">Status</dt>
            <dd className="text-sm font-medium">{formatLotStatus(lot.status)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="t-label">Raça</dt>
            <dd className="truncate text-sm font-medium">{lot.breed || '—'}</dd>
          </div>
        </dl>

        {lot.description && (
          <p className="text-sm leading-relaxed text-muted-foreground">{lot.description}</p>
        )}

        <Block title="Lances">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[13px] text-muted-foreground">Lance atual</span>
            <Money value={winningBid?.amount ?? lot.initialPrice} />
          </div>

          {lot.bids?.length ? (
            <ul className="flex flex-col rounded-[10px] border border-border">
              {lot.bids.map((bid) => (
                <li
                  className="flex items-center justify-between gap-4 border-b border-border px-3.5 py-2.5 last:border-b-0"
                  key={bid.id}
                >
                  <span className="min-w-0 truncate text-[13.5px]">
                    {bid.bidder?.name || 'Comprador'}
                  </span>
                  <div className="flex shrink-0 items-center gap-3">
                    <small className="text-[11.5px] text-text-subtle">
                      {formatBidStatus(bid.status)}
                    </small>
                    <Money muted size="sm" value={bid.amount} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-muted-foreground">Nenhum lance registrado ainda.</p>
          )}

          {isBidder && (
            <p className="text-xs text-text-subtle">
              Os lances são feitos no painel do lote em pista, ao lado do vídeo.
            </p>
          )}
        </Block>

        {canManage && (
          <Block title="Gerenciar lote">
            <p className="text-[13px] text-muted-foreground">{stageMessage}</p>
            <div className="flex flex-wrap gap-2">
              {lot.status !== 'AVAILABLE' && lot.status !== 'IN_AUCTION' && (
                <Button
                  disabled={isSubmitting}
                  type="button"
                  variant="outline"
                  onClick={() => onSetStage('AVAILABLE')}
                >
                  Liberar lote
                </Button>
              )}
              {lot.status === 'AVAILABLE' && (
                <Button disabled={isSubmitting} type="button" onClick={() => onSetStage('IN_AUCTION')}>
                  Colocar em pista
                </Button>
              )}
              {lot.status === 'IN_AUCTION' && (
                <Button
                  disabled={isSubmitting}
                  type="button"
                  variant="outline"
                  onClick={() => onSetStage('AVAILABLE')}
                >
                  Retirar de pista
                </Button>
              )}
            </div>
          </Block>
        )}

        {canManage && (
          <Block title="Adicionar imagens">
            <input
              accept="image/*"
              className="text-[13px] text-muted-foreground file:mr-3 file:rounded-lg file:border file:border-input file:bg-secondary file:px-3 file:py-1.5 file:text-[13px] file:font-medium file:text-foreground"
              multiple
              type="file"
              onChange={onPendingImagesChange}
            />

            {pendingImages.length > 0 && (
              <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {pendingImages.map((image) => (
                  <li
                    className="flex flex-col gap-1.5 rounded-lg border border-border p-2"
                    key={image.id}
                  >
                    <img
                      alt=""
                      className="aspect-4/3 w-full rounded object-cover"
                      src={image.dataUrl}
                    />
                    <span className="truncate text-[11px] text-muted-foreground">
                      {image.fileName}
                    </span>
                    <Button
                      size="xs"
                      type="button"
                      variant="ghost"
                      onClick={() => onRemovePendingImage(image.id)}
                    >
                      Remover
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            {error && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-[12.5px] text-destructive">
                {error}
              </p>
            )}

            <Button
              className="self-start"
              disabled={isSubmitting || pendingImages.length === 0}
              type="button"
              onClick={onSavePendingImages}
            >
              {isSubmitting ? 'Salvando...' : 'Salvar imagens'}
            </Button>
          </Block>
        )}
      </section>
    </div>
  );
}
