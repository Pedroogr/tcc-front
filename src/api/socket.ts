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
  const token = localStorage.getItem(authStorage.tokenKey);

  return io(apiUrl, {
    auth: token ? { token } : undefined,
    reconnectionAttempts: 6,
    reconnectionDelay: 800,
    transports: ['websocket', 'polling'],
  });
}
