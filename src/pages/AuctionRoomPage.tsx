import type { ChangeEvent, FormEvent } from 'react';
import { ChevronLeft, Plus } from 'lucide-react';
import type { Auction, AuctionStreamState } from '@/types/auction';
import type { Bid, Lot } from '@/types/lot';
import type { BuyerRegistration } from '@/types/user';
import { AuctionBroadcastControls } from '@/components/AuctionBroadcastControls';
import { AuctionStreamPlayer } from '@/components/AuctionStreamPlayer';
import { DeclareWinnerPanel } from '@/components/DeclareWinnerPanel';
import type { LotImageItem } from '@/components/LotImageInput';
import { Button } from '@/components/ui/button';
import { Status } from '@/design/primitives/Status';
import { BidPanel } from './auction-room/BidPanel';
import { LotDetailModal } from './auction-room/LotDetailModal';
import { LotQueue } from './auction-room/LotQueue';
import { RoomSidePanel } from './auction-room/RoomSidePanel';

type LotFormFields = {
  code: string;
  title: string;
  breed: string;
  category: string;
  quantity: string;
  initialPrice: string;
  description: string;
};

type PendingImage = {
  id: string;
  dataUrl: string;
  fileName: string;
};

type AuctionRoomPageProps = {
  auction: Auction | null;
  streamState: AuctionStreamState | null;
  lots: Lot[];
  isLoadingLots: boolean;
  canManage: boolean;
  isBidder: boolean;
  inPistaLot: Lot | null;
  inPistaWinningBid: Bid | null;
  bidAmount: string;
  bidStep: number;
  myRegistration: BuyerRegistration | null | undefined;
  isSubmitting: boolean;
  error: string;
  createdLotId: string | null;

  selectedLot: Lot | null;
  selectedLotWinningBid: Bid | null;
  selectedLotStageMessage: string;
  detailImages: PendingImage[];

  lotForm: LotFormFields;
  lotImages: LotImageItem[];
  buyerRegistrations: BuyerRegistration[];
  isLoadingBuyerRegistrations: boolean;

  resolveMediaUrl: (url: string) => string;
  onBack: () => void;
  onCreateAuction: () => void;
  onStreamStateChange: (streamState: AuctionStreamState) => void;
  onWinnerDeclared: () => void | Promise<void>;
  onBidAmountChange: (value: string) => void;
  onStepBid: (delta: number) => void;
  onSubmitBid: (event: FormEvent) => void;
  onRequestApproval: () => void;
  onSelectLot: (lotId: string) => void;
  onCloseLotDetail: () => void;
  onSetLotStage: (status: 'AVAILABLE' | 'IN_AUCTION') => void;
  onDetailImagesChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveDetailImage: (imageId: string) => void;
  onSaveDetailImages: () => void;
  onLotFieldChange: (field: keyof LotFormFields, value: string) => void;
  onLotImagesChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onLotSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRemoveLotImage: (imageId: string) => void;
  onReviewRegistration: (registrationId: string, status: 'APPROVED' | 'REJECTED') => void;
};

export function AuctionRoomPage({
  auction,
  streamState,
  lots,
  isLoadingLots,
  canManage,
  isBidder,
  inPistaLot,
  inPistaWinningBid,
  bidAmount,
  bidStep,
  myRegistration,
  isSubmitting,
  error,
  createdLotId,
  selectedLot,
  selectedLotWinningBid,
  selectedLotStageMessage,
  detailImages,
  lotForm,
  lotImages,
  buyerRegistrations,
  isLoadingBuyerRegistrations,
  resolveMediaUrl,
  onBack,
  onCreateAuction,
  onStreamStateChange,
  onWinnerDeclared,
  onBidAmountChange,
  onStepBid,
  onSubmitBid,
  onRequestApproval,
  onSelectLot,
  onCloseLotDetail,
  onSetLotStage,
  onDetailImagesChange,
  onRemoveDetailImage,
  onSaveDetailImages,
  onLotFieldChange,
  onLotImagesChange,
  onLotSubmit,
  onRemoveLotImage,
  onReviewRegistration,
}: AuctionRoomPageProps) {
  const isLive =
    streamState?.stream?.status === 'LIVE' || auction?.stream?.status === 'LIVE';

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Button size="sm" type="button" variant="outline" onClick={onBack}>
            <ChevronLeft />
            Remates
          </Button>

          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="t-label truncate">
              {auction?.auctionHouse?.name || 'Escritório'}
            </span>
            <h1 className="truncate font-[family-name:var(--font-display)] text-[19px] font-bold -tracking-[0.01em]">
              {auction?.title || 'Remate'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {isLive && <Status kind="live" />}
          {canManage && (
            <Button size="sm" type="button" variant="outline" onClick={onCreateAuction}>
              <Plus />
              Novo remate
            </Button>
          )}
        </div>
      </header>

      {/* O video domina; lance e fila ficam a direita, sempre visiveis em desktop. */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-5">
          {auction && streamState?.canBroadcast ? (
            <AuctionBroadcastControls
              auction={auction}
              lotsCount={lots.length}
              streamState={streamState}
              onStreamStateChange={onStreamStateChange}
            />
          ) : (
            <AuctionStreamPlayer
              auction={auction}
              lotsCount={lots.length}
              streamState={streamState}
              onStreamStateChange={onStreamStateChange}
            />
          )}

          {auction?.description && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {auction.description}
            </p>
          )}

          {canManage && (
            <DeclareWinnerPanel
              inPistaLot={inPistaLot}
              winningBid={inPistaWinningBid}
              onDeclared={onWinnerDeclared}
            />
          )}

          {canManage && (
            <RoomSidePanel
              buyerRegistrations={buyerRegistrations}
              canSubmitLot={Boolean(auction)}
              createdLotId={createdLotId}
              error={error}
              isLoadingBuyerRegistrations={isLoadingBuyerRegistrations}
              isSubmitting={isSubmitting}
              lotForm={lotForm}
              lotImages={lotImages}
              onLotFieldChange={onLotFieldChange}
              onLotImagesChange={onLotImagesChange}
              onLotSubmit={onLotSubmit}
              onRemoveLotImage={onRemoveLotImage}
              onReviewRegistration={onReviewRegistration}
            />
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {!canManage && (
            <BidPanel
              bidAmount={bidAmount}
              bidStep={bidStep}
              canBid={isBidder}
              error={error}
              inPistaLot={inPistaLot}
              isSubmitting={isSubmitting}
              registration={myRegistration}
              winningBid={inPistaWinningBid}
              onBidAmountChange={onBidAmountChange}
              onRequestApproval={onRequestApproval}
              onStepBid={onStepBid}
              onSubmitBid={onSubmitBid}
            />
          )}

          <LotQueue
            highlightedLotId={createdLotId}
            isLoading={isLoadingLots}
            lots={lots}
            onSelectLot={onSelectLot}
          />
        </div>
      </div>

      {selectedLot && (
        <LotDetailModal
          canManage={canManage}
          error={error}
          isBidder={isBidder}
          isSubmitting={isSubmitting}
          lot={selectedLot}
          pendingImages={detailImages}
          resolveMediaUrl={resolveMediaUrl}
          stageMessage={selectedLotStageMessage}
          winningBid={selectedLotWinningBid}
          onClose={onCloseLotDetail}
          onPendingImagesChange={onDetailImagesChange}
          onRemovePendingImage={onRemoveDetailImage}
          onSavePendingImages={onSaveDetailImages}
          onSetStage={onSetLotStage}
        />
      )}
    </div>
  );
}
