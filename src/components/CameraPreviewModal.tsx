import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type CameraPreviewModalProps = {
  onCancel: () => void;
  onConfirm: (stream: MediaStream) => void;
};

function stopMediaStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function getMediaErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'Permita o acesso à câmera e ao microfone para iniciar a transmissão.';
    }

    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'Câmera ou microfone indisponível.';
    }

    if (error.name === 'NotReadableError') {
      return 'Não foi possível acessar sua câmera.';
    }
  }

  return 'Não foi possível acessar sua câmera.';
}

function buildConstraints(cameraId: string, microphoneId: string): MediaStreamConstraints {
  return {
    video: cameraId ? { deviceId: { exact: cameraId } } : true,
    audio: microphoneId ? { deviceId: { exact: microphoneId } } : true,
  };
}

export function CameraPreviewModal({
  onCancel,
  onConfirm,
}: CameraPreviewModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const confirmedRef = useRef(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasPreview, setHasPreview] = useState(false);

  const loadDeviceOptions = useCallback(async (activeStream: MediaStream) => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter((device) => device.kind === 'videoinput');
    const audioDevices = devices.filter((device) => device.kind === 'audioinput');
    const activeVideoDeviceId = activeStream.getVideoTracks()[0]?.getSettings().deviceId ?? '';
    const activeAudioDeviceId = activeStream.getAudioTracks()[0]?.getSettings().deviceId ?? '';

    setCameras(videoDevices);
    setMicrophones(audioDevices);
    setSelectedCameraId((current) => current || activeVideoDeviceId || videoDevices[0]?.deviceId || '');
    setSelectedMicrophoneId(
      (current) => current || activeAudioDeviceId || audioDevices[0]?.deviceId || '',
    );
  }, []);

  const requestPreview = useCallback(async (cameraId: string, microphoneId: string) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Seu navegador não oferece suporte a câmera e microfone.');
      setIsLoading(false);
      setHasPreview(false);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const nextStream = await navigator.mediaDevices.getUserMedia(
        buildConstraints(cameraId, microphoneId),
      );

      stopMediaStream(streamRef.current);
      streamRef.current = nextStream;

      if (videoRef.current) {
        videoRef.current.srcObject = nextStream;
      }

      setHasPreview(true);
      await loadDeviceOptions(nextStream);
    } catch (previewError) {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      setHasPreview(false);
      setError(getMediaErrorMessage(previewError));
    } finally {
      setIsLoading(false);
    }
  }, [loadDeviceOptions]);

  useEffect(() => {
    queueMicrotask(() => {
      void requestPreview('', '');
    });

    return () => {
      if (!confirmedRef.current) {
        stopMediaStream(streamRef.current);
      }
    };
  }, [requestPreview]);

  function handleCancel() {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    setHasPreview(false);
    onCancel();
  }

  function handleConfirm() {
    if (!streamRef.current) {
      setError('Permita o acesso à câmera e ao microfone para iniciar a transmissão.');
      return;
    }

    confirmedRef.current = true;
    onConfirm(streamRef.current);
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          handleCancel();
        }
      }}
    >
      <DialogContent className="max-w-3xl rounded-[24px] border-primary/10 bg-popover/95 p-0 shadow-[0_32px_90px_rgba(15,23,42,0.22)] backdrop-blur-xl">
        <div className="p-6 sm:p-7">
          <DialogHeader>
            <span className="text-xs font-black uppercase tracking-[0.16em] text-primary">
              Prévia local
            </span>
            <DialogTitle className="text-2xl font-black text-foreground">
              Iniciar transmissão
            </DialogTitle>
            <DialogDescription className="font-medium text-muted-foreground">
              Confira câmera e microfone antes de liberar o vídeo para os espectadores.
            </DialogDescription>
          </DialogHeader>

          <div className="relative mt-5 aspect-video overflow-hidden rounded-[18px] border border-primary/10 bg-primary shadow-inner">
            <video ref={videoRef} autoPlay muted playsInline className="size-full object-cover" />
            {(isLoading || error) && (
              <span className="absolute inset-0 grid place-items-center px-6 text-center text-sm font-black text-white">
                {isLoading ? 'Solicitando câmera e microfone...' : error}
              </span>
            )}
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {cameras.length > 1 && (
              <label className="grid gap-2 text-sm font-black text-foreground">
                Câmera
                <Select
                  value={selectedCameraId}
                  onValueChange={(value) => {
                    setSelectedCameraId(value);
                    void requestPreview(value, selectedMicrophoneId);
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl border-primary/15 bg-white/75 font-bold">
                    <SelectValue placeholder="Selecione a câmera" />
                  </SelectTrigger>
                  <SelectContent>
                    {cameras.map((camera, index) => (
                      <SelectItem key={camera.deviceId || index} value={camera.deviceId}>
                        {camera.label || `Câmera ${index + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            )}

            {microphones.length > 1 && (
              <label className="grid gap-2 text-sm font-black text-foreground">
                Microfone
                <Select
                  value={selectedMicrophoneId}
                  onValueChange={(value) => {
                    setSelectedMicrophoneId(value);
                    void requestPreview(selectedCameraId, value);
                  }}
                >
                  <SelectTrigger className="h-11 rounded-xl border-primary/15 bg-white/75 font-bold">
                    <SelectValue placeholder="Selecione o microfone" />
                  </SelectTrigger>
                  <SelectContent>
                    {microphones.map((microphone, index) => (
                      <SelectItem key={microphone.deviceId || index} value={microphone.deviceId}>
                        {microphone.label || `Microfone ${index + 1}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-2xl border border-destructive/15 bg-destructive/8 px-4 py-3 text-sm font-bold text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="mt-6">
            <Button
              variant="secondary"
              className="rounded-full font-black"
              type="button"
              onClick={handleCancel}
            >
              Cancelar
            </Button>
            <Button
              className="rounded-full bg-primary font-black text-primary-foreground hover:bg-primary/90"
              type="button"
              onClick={handleConfirm}
              disabled={isLoading || !hasPreview}
            >
              Iniciar transmissão
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
