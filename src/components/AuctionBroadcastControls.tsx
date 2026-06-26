import { useCallback, useEffect, useRef, useState } from 'react';
import { createStreamSocket, type StreamSocket } from '../api/socket';
import { startAuctionStream, stopAuctionStream } from '../api/streamsApi';
import type { Auction, AuctionStreamState } from '../types/auction';
import {
  formatAuctionMode,
  formatAuctionStatus,
  formatStreamStatus,
} from '../utils/auctionLabels';
import { CameraPreviewModal } from './CameraPreviewModal';

type AuctionBroadcastControlsProps = {
  auction: Auction;
  lotsCount: number;
  streamState: AuctionStreamState | null;
  onStreamStateChange: (streamState: AuctionStreamState) => void;
};

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function getActiveStatus(
  isBroadcastLive: boolean,
  streamStatus: string | undefined,
  auctionStreamStatus: string | undefined,
  auctionStatus: string,
) {
  if (isBroadcastLive) {
    return formatStreamStatus('LIVE');
  }
  if (streamStatus) {
    return formatStreamStatus(streamStatus);
  }
  return formatAuctionStatus(auctionStreamStatus ?? auctionStatus);
}

function getBroadcastCenterMessage(
  streamStatus: string | undefined,
  isStreamLive: boolean,
  isStreamInterrupted: boolean,
) {
  if (streamStatus === 'ENDED') {
    return 'A transmissão foi encerrada pelo escritório.';
  }
  if (isStreamLive) {
    return 'A transmissão está ao vivo em outra sessão.';
  }
  if (isStreamInterrupted) {
    return 'A transmissão foi interrompida. Retome quando estiver pronto.';
  }
  return 'Aguardando início da transmissão.';
}

function getStartButtonLabel(isStarting: boolean, isResuming: boolean) {
  if (isStarting) {
    return 'Iniciando...';
  }
  if (isResuming) {
    return 'Retomar transmissão';
  }
  return 'Iniciar transmissão';
}

function closePeerConnection(peerConnection: RTCPeerConnection) {
  peerConnection.onicecandidate = null;
  peerConnection.onconnectionstatechange = null;
  peerConnection.close();
}

function parseErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(error.message) as { message?: string | string[] };

    if (Array.isArray(parsed.message)) {
      return parsed.message[0] || fallback;
    }

    return parsed.message || fallback;
  } catch {
    return error.message || fallback;
  }
}

function hasWebRtcSupport() {
  return Boolean(
    typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof RTCPeerConnection !== 'undefined',
  );
}

export function AuctionBroadcastControls({
  auction,
  lotsCount,
  streamState,
  onStreamStateChange,
}: AuctionBroadcastControlsProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<StreamSocket | null>(null);
  const peerConnectionsRef = useRef(new Map<string, RTCPeerConnection>());
  const activeBroadcastRef = useRef(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const closePeerConnections = useCallback(() => {
    peerConnectionsRef.current.forEach(closePeerConnection);
    peerConnectionsRef.current.clear();
  }, []);

  const cleanupBroadcast = useCallback(() => {
    activeBroadcastRef.current = false;
    closePeerConnections();
    socketRef.current?.removeAllListeners();
    socketRef.current?.disconnect();
    socketRef.current = null;
    stopMediaStream(localStreamRef.current);
    localStreamRef.current = null;
    setLocalStream(null);
    setIsCameraEnabled(true);
    setIsMicrophoneEnabled(true);
  }, [closePeerConnections]);

  async function createOfferForViewer(viewerId: string, mediaStream: MediaStream) {
    const existingPeerConnection = peerConnectionsRef.current.get(viewerId);

    if (existingPeerConnection) {
      closePeerConnection(existingPeerConnection);
    }

    const peerConnection = new RTCPeerConnection(rtcConfig);
    peerConnectionsRef.current.set(viewerId, peerConnection);

    mediaStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, mediaStream);
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit('stream:ice-candidate', {
          auctionId: auction.id,
          targetId: viewerId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    peerConnection.onconnectionstatechange = () => {
      if (
        peerConnection.connectionState === 'failed' ||
        peerConnection.connectionState === 'closed' ||
        peerConnection.connectionState === 'disconnected'
      ) {
        closePeerConnection(peerConnection);
        peerConnectionsRef.current.delete(viewerId);
      }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socketRef.current?.emit('stream:offer', {
      auctionId: auction.id,
      targetId: viewerId,
      sdp: offer,
    });
  }

  function connectBroadcaster(mediaStream: MediaStream) {
    const socket = createStreamSocket();
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('stream:broadcaster-join', { auctionId: auction.id });
    });

    socket.on('stream:viewer-join', (payload) => {
      if (payload.auctionId !== auction.id) {
        return;
      }

      createOfferForViewer(payload.viewerId, mediaStream).catch(() => {
        setError('Não foi possível enviar a transmissão para este espectador.');
      });
    });

    socket.on('stream:answer', (payload) => {
      if (payload.auctionId !== auction.id) {
        return;
      }

      peerConnectionsRef.current
        .get(payload.viewerId)
        ?.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        .catch(() => {
          setError('Não foi possível completar a conexão com um espectador.');
        });
    });

    socket.on('stream:ice-candidate', (payload) => {
      if (payload.auctionId !== auction.id) {
        return;
      }

      peerConnectionsRef.current
        .get(payload.senderId)
        ?.addIceCandidate(new RTCIceCandidate(payload.candidate))
        .catch(() => undefined);
    });

    socket.on('stream:ended', (payload) => {
      if (payload.auctionId === auction.id) {
        cleanupBroadcast();
      }
    });

    socket.on('stream:error', (payload) => {
      setError(payload.message);
    });

    socket.on('disconnect', () => {
      if (activeBroadcastRef.current) {
        setError('Conexão perdida. Tentando reconectar...');
      }
    });
  }

  async function handlePreviewConfirm(mediaStream: MediaStream) {
    setIsStarting(true);
    setError('');

    try {
      const nextStreamState = await startAuctionStream(auction.id);
      activeBroadcastRef.current = true;
      localStreamRef.current = mediaStream;
      setLocalStream(mediaStream);
      setIsMicrophoneEnabled(mediaStream.getAudioTracks().some((track) => track.enabled));
      setIsCameraEnabled(mediaStream.getVideoTracks().some((track) => track.enabled));
      connectBroadcaster(mediaStream);
      onStreamStateChange(nextStreamState);
      setIsPreviewOpen(false);
    } catch (startError) {
      stopMediaStream(mediaStream);
      setError(
        parseErrorMessage(
          startError,
          'Não foi possível iniciar a transmissão. Tente novamente.',
        ),
      );
    } finally {
      setIsStarting(false);
    }
  }

  async function handleStopBroadcast() {
    const confirmed = window.confirm(
      'Encerrar definitivamente a transmissão deste remate?',
    );

    if (!confirmed) {
      return;
    }

    setIsStopping(true);
    setError('');

    try {
      const nextStreamState = await stopAuctionStream(auction.id);
      socketRef.current?.emit('stream:ended', { auctionId: auction.id });
      onStreamStateChange(nextStreamState);
    } catch (stopError) {
      setError(
        parseErrorMessage(
          stopError,
          'Não foi possível encerrar a transmissão agora.',
        ),
      );
    } finally {
      cleanupBroadcast();
      setIsStopping(false);
    }
  }

  function toggleMicrophone() {
    const nextEnabled = !isMicrophoneEnabled;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setIsMicrophoneEnabled(nextEnabled);
  }

  function toggleCamera() {
    const nextEnabled = !isCameraEnabled;
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = nextEnabled;
    });
    setIsCameraEnabled(nextEnabled);
  }

  useEffect(() => {
    function handleBeforeUnload() {
      stopMediaStream(localStreamRef.current);
    }

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [auction.id]);

  useEffect(() => {
    return () => {
      cleanupBroadcast();
    };
  }, [auction.id, cleanupBroadcast]);

  const streamStatus = streamState?.stream?.status;
  const currentAuctionStatus = streamState?.auction.status ?? auction.status;
  const isStreamLive = streamStatus === 'LIVE';
  const isStreamEnded = streamStatus === 'ENDED';
  const isStreamInterrupted = streamStatus === 'ERROR';
  const isBroadcastLive = Boolean(localStream) || isStreamLive;
  const canStart =
    Boolean(streamState?.canBroadcast) &&
    !localStream &&
    !isStreamEnded &&
    currentAuctionStatus !== 'CANCELED' &&
    currentAuctionStatus !== 'FINISHED';
  const canStopActiveStream =
    Boolean(streamState?.canBroadcast) && !localStream && isStreamLive;
  const isResuming = isStreamLive || isStreamInterrupted;
  const activeStatus = getActiveStatus(
    isBroadcastLive,
    streamStatus,
    streamState?.auction.status,
    auction.status,
  );

  return (
    <>
      <div className={localStream ? 'auction-player has-video' : 'auction-player'}>
        <div className="player-status">
          <span className={isBroadcastLive ? 'live-dot active' : 'live-dot'}></span>
          <strong>{activeStatus}</strong>
        </div>

        {localStream ? (
          <video ref={localVideoRef} autoPlay muted playsInline />
        ) : (
          <div className="player-center">
            <span className="play-button large">Reproduzir</span>
            <p>
              {getBroadcastCenterMessage(streamStatus, isStreamLive, isStreamInterrupted)}
            </p>
          </div>
        )}

        <div className="player-footer">
          <span>{formatAuctionMode(auction.mode)}</span>
          <span>{lotsCount} lotes</span>
        </div>
      </div>

      <div className="broadcast-panel">
        {isBroadcastLive && (
          <div className="broadcast-live-row">
            <span className="live-dot active"></span>
            <strong>AO VIVO</strong>
          </div>
        )}

        {!hasWebRtcSupport() && (
          <p className="error-message compact">Seu navegador não oferece suporte a WebRTC.</p>
        )}

        {error && <p className="error-message compact">{error}</p>}

        {canStart && hasWebRtcSupport() && (
          <button
            className="primary-action"
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            disabled={isStarting}
          >
            {getStartButtonLabel(isStarting, isResuming)}
          </button>
        )}

        {canStopActiveStream && (
          <button
            className="danger-action"
            type="button"
            onClick={handleStopBroadcast}
            disabled={isStopping}
          >
            {isStopping ? 'Encerrando...' : 'Encerrar transmissão'}
          </button>
        )}

        {canStart && isResuming && (
          <p className="loading-message compact">
            {canStopActiveStream
              ? 'A transmissão segue ao vivo. Retome nesta aba ou encerre agora.'
              : 'A transmissão foi interrompida. Clique em retomar para voltar ao ar.'}
          </p>
        )}

        {localStream && (
          <div className="broadcast-controls">
            <button className="secondary-action" type="button" onClick={toggleMicrophone}>
              {isMicrophoneEnabled ? 'Desativar microfone' : 'Ativar microfone'}
            </button>
            <button className="secondary-action" type="button" onClick={toggleCamera}>
              {isCameraEnabled ? 'Desativar câmera' : 'Ativar câmera'}
            </button>
            <button
              className="danger-action"
              type="button"
              onClick={handleStopBroadcast}
              disabled={isStopping}
            >
              {isStopping ? 'Encerrando...' : 'Encerrar transmissão'}
            </button>
          </div>
        )}
      </div>

      {isPreviewOpen && (
        <CameraPreviewModal
          onCancel={() => setIsPreviewOpen(false)}
          onConfirm={(mediaStream) => {
            void handlePreviewConfirm(mediaStream);
          }}
        />
      )}
    </>
  );
}
