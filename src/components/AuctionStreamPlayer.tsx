import { useEffect, useRef, useState } from 'react';
import { createStreamSocket, type StreamSocket } from '../api/socket';
import { getAuctionStream } from '../api/streamsApi';
import type { Auction, AuctionStreamState } from '../types/auction';
import {
  formatAuctionMode,
  formatAuctionStatus,
  formatStreamStatus,
} from '../utils/auctionLabels';

type AuctionStreamPlayerProps = {
  auction: Auction | null;
  lotsCount: number;
  streamState: AuctionStreamState | null;
  onStreamStateChange: (streamState: AuctionStreamState) => void;
};

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function closePeerConnection(peerConnection: RTCPeerConnection | null) {
  if (!peerConnection) {
    return;
  }

  peerConnection.onicecandidate = null;
  peerConnection.ontrack = null;
  peerConnection.onconnectionstatechange = null;
  peerConnection.close();
}

export function AuctionStreamPlayer({
  auction,
  lotsCount,
  streamState,
  onStreamStateChange,
}: AuctionStreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<StreamSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const isWebRtcSupported = typeof RTCPeerConnection !== 'undefined';

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!auction?.id) {
      return undefined;
    }

    if (!isWebRtcSupported) {
      return undefined;
    }

    const auctionId = auction.id;
    const socket = createStreamSocket();
    socketRef.current = socket;

    function joinAsViewer() {
      socket.emit('stream:viewer-join', { auctionId });
    }

    function resetRemoteStream(nextMessage?: string) {
      closePeerConnection(peerConnectionRef.current);
      peerConnectionRef.current = null;
      remoteStreamRef.current = null;
      setRemoteStream(null);

      if (nextMessage) {
        setMessage(nextMessage);
      }
    }

    socket.on('connect', () => {
      setError('');
      joinAsViewer();
    });

    socket.io.on('reconnect', () => {
      setMessage('Reconectando à transmissão...');
      joinAsViewer();
    });

    socket.on('stream:broadcaster-join', (payload) => {
      if (payload.auctionId !== auctionId) {
        return;
      }

      setMessage('Conectando à transmissão...');
      joinAsViewer();
    });

    socket.on('stream:offer', async (payload) => {
      if (payload.auctionId !== auctionId) {
        return;
      }

      try {
        resetRemoteStream();

        const peerConnection = new RTCPeerConnection(rtcConfig);
        const mediaStream = new MediaStream();
        peerConnectionRef.current = peerConnection;
        remoteStreamRef.current = mediaStream;
        setRemoteStream(mediaStream);

        peerConnection.ontrack = (event) => {
          event.streams[0]?.getTracks().forEach((track) => {
            remoteStreamRef.current?.addTrack(track);
          });
        };

        peerConnection.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('stream:ice-candidate', {
              auctionId,
              targetId: payload.broadcasterId,
              candidate: event.candidate.toJSON(),
            });
          }
        };

        peerConnection.onconnectionstatechange = () => {
          if (peerConnection.connectionState === 'connected') {
            setMessage('');
          }

          if (
            peerConnection.connectionState === 'failed' ||
            peerConnection.connectionState === 'disconnected'
          ) {
            setMessage('Conexão perdida. Tentando reconectar...');
            joinAsViewer();
          }
        };

        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(payload.sdp),
        );
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        socket.emit('stream:answer', {
          auctionId,
          targetId: payload.broadcasterId,
          sdp: answer,
        });
      } catch {
        resetRemoteStream('Não foi possível reproduzir a transmissão.');
      }
    });

    socket.on('stream:ice-candidate', (payload) => {
      if (payload.auctionId !== auctionId || !peerConnectionRef.current) {
        return;
      }

      peerConnectionRef.current
        .addIceCandidate(new RTCIceCandidate(payload.candidate))
        .catch(() => {
          setMessage('Conexão instável. Tentando reconectar...');
        });
    });

    socket.on('stream:ended', (payload) => {
      if (payload.auctionId !== auctionId) {
        return;
      }

      resetRemoteStream(payload.message || 'A transmissão foi encerrada pelo escritório.');
      getAuctionStream(auctionId)
        .then(onStreamStateChange)
        .catch(() => undefined);
    });

    socket.on('stream:interrupted', (payload) => {
      if (payload.auctionId !== auctionId) {
        return;
      }

      resetRemoteStream(payload.message || 'A transmissão foi interrompida.');
      getAuctionStream(auctionId)
        .then(onStreamStateChange)
        .catch(() => undefined);
    });

    socket.on('stream:error', (payload) => {
      setError(payload.message);
    });

    socket.on('disconnect', () => {
      setMessage('Conexão perdida. Tentando reconectar...');
    });

    return () => {
      socket.removeAllListeners();
      socket.io.off('reconnect');
      socket.disconnect();
      socketRef.current = null;
      resetRemoteStream();
    };
  }, [auction?.id, isWebRtcSupported, onStreamStateChange]);

  const streamStatus = streamState?.stream?.status;
  const activeStatus = streamStatus
    ? formatStreamStatus(streamStatus)
    : formatAuctionStatus(streamState?.auction.status ?? auction?.status);
  const isLive = streamStatus === 'LIVE';
  const centerMessage =
    (!isWebRtcSupported && 'Seu navegador não oferece suporte a WebRTC.') ||
    error ||
    message ||
    (streamStatus === 'ENDED'
      ? 'A transmissão foi encerrada pelo escritório.'
      : streamStatus === 'ERROR'
        ? 'A transmissão foi interrompida. Aguardando retomada.'
      : isLive
        ? 'Conectando à transmissão...'
        : 'Aguardando início da transmissão.');

  return (
    <div className={remoteStream ? 'auction-player has-video' : 'auction-player'}>
      <div className="player-status">
        <span className={isLive ? 'live-dot active' : 'live-dot'}></span>
        <strong>{activeStatus}</strong>
      </div>

      {remoteStream ? (
        <video ref={videoRef} autoPlay playsInline controls />
      ) : (
        <div className="player-center">
          <span className="play-button large">Reproduzir</span>
          <p>{centerMessage}</p>
        </div>
      )}

      <div className="player-footer">
        <span>{formatAuctionMode(auction?.mode)}</span>
        <span>{lotsCount} lotes</span>
      </div>
    </div>
  );
}
