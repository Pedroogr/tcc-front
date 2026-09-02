import { io, type Socket } from 'socket.io-client';
import { apiUrl, authStorage } from './http';

export type StreamSignalDescription = RTCSessionDescriptionInit;
export type StreamIceCandidate = RTCIceCandidateInit;

type ServerToClientEvents = {
  'stream:broadcaster-join': (payload: {
    auctionId: string;
    broadcasterId: string;
  }) => void;
  'stream:viewer-join': (payload: { auctionId: string; viewerId: string }) => void;
  'stream:offer': (payload: {
    auctionId: string;
    broadcasterId: string;
    sdp: StreamSignalDescription;
  }) => void;
  'stream:answer': (payload: {
    auctionId: string;
    viewerId: string;
    sdp: StreamSignalDescription;
  }) => void;
  'stream:ice-candidate': (payload: {
    auctionId: string;
    senderId: string;
    candidate: StreamIceCandidate;
  }) => void;
  'stream:ended': (payload: { auctionId: string; message?: string }) => void;
  'stream:interrupted': (payload: { auctionId: string; message?: string }) => void;
  'stream:error': (payload: { message: string }) => void;
};

type ClientToServerEvents = {
  'stream:broadcaster-join': (payload: { auctionId: string }) => void;
  'stream:viewer-join': (payload: { auctionId: string }) => void;
  'stream:offer': (payload: {
    auctionId: string;
    targetId: string;
    sdp: StreamSignalDescription;
  }) => void;
  'stream:answer': (payload: {
    auctionId: string;
    targetId: string;
    sdp: StreamSignalDescription;
  }) => void;
  'stream:ice-candidate': (payload: {
    auctionId: string;
    targetId: string;
    candidate: StreamIceCandidate;
  }) => void;
  'stream:ended': (payload: { auctionId: string }) => void;
};

export type StreamSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export function createStreamSocket(): StreamSocket {
  const token = sessionStorage.getItem(authStorage.tokenKey);

  return io(apiUrl, {
    auth: token ? { token } : undefined,
    reconnectionAttempts: 6,
    reconnectionDelay: 800,
    transports: ['websocket', 'polling'],
  });
}

export type SaleWonPayload = {
  saleId: string;
  lotId: string;
  lotCode: string;
  lotTitle: string;
  auctionId: string;
  auctionTitle: string;
  finalPrice: string;
};

// Atualizacao anonima de preco: sem identidade de quem lancou (RF06).
export type BidPriceUpdatedPayload = {
  lotId: string;
  amount: string;
  createdAt: string;
};

// Lance detalhado, entregue somente a sala :office do escritorio dono (RF07).
export type OfficeBidRecordedPayload = {
  bidId: string;
  lotId: string;
  amount: string;
  createdAt: string;
  bidder: { id: string; name: string };
};

export type LotSoldPayload = {
  lotId: string;
  finalPrice: string;
  soldAt: string;
};

type CommerceServerToClientEvents = {
  'bid:price-updated': (payload: BidPriceUpdatedPayload) => void;
  'bid:office-recorded': (payload: OfficeBidRecordedPayload) => void;
  'lot:sold': (payload: LotSoldPayload) => void;
  'sale:won': (payload: SaleWonPayload) => void;
  'commerce:error': (payload: { message: string }) => void;
};

type CommerceClientToServerEvents = {
  'auction:join': (payload: { auctionId: string }) => void;
  'notifications:join': () => void;
};

export type CommerceSocket = Socket<
  CommerceServerToClientEvents,
  CommerceClientToServerEvents
>;

// Cliente unico de eventos comerciais: preco em tempo real, historico do
// escritorio, lote vendido e notificacao privada do vencedor.
export function createCommerceSocket(): CommerceSocket {
  const token = sessionStorage.getItem(authStorage.tokenKey);

  return io(apiUrl, {
    auth: token ? { token } : undefined,
    reconnectionAttempts: 6,
    reconnectionDelay: 800,
    transports: ['websocket', 'polling'],
  });
}
