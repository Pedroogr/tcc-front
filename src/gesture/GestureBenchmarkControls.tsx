import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  GestureBenchmarkRecorder,
  type GestureBenchmarkFrameTiming,
} from './gesture-benchmark';

type GestureBenchmarkControlsProps = {
  frame: GestureBenchmarkFrameTiming | null;
  requestFrame?: (callback: FrameRequestCallback) => number;
  download?: (contents: string) => void;
};

const browserRequestFrame = (callback: FrameRequestCallback) =>
  window.requestAnimationFrame(callback);

function downloadJson(contents: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `gesture-benchmark-${new Date().toISOString().replaceAll(':', '-')}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function GestureBenchmarkControls({
  frame,
  requestFrame = browserRequestFrame,
  download = downloadJson,
}: GestureBenchmarkControlsProps) {
  const recorder = useRef(new GestureBenchmarkRecorder());
  const resetGeneration = useRef(0);
  const mounted = useRef(true);
  const [sampleCount, setSampleCount] = useState(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      resetGeneration.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!frame) return;
    const generation = resetGeneration.current;
    requestFrame(() => {
      requestFrame((presentedAtMs) => {
        if (!mounted.current || generation !== resetGeneration.current) return;
        recorder.current.record(frame, presentedAtMs);
        setSampleCount(recorder.current.summary().sampleCount);
      });
    });
  }, [frame, requestFrame]);

  const reset = () => {
    resetGeneration.current += 1;
    recorder.current.reset();
    setSampleCount(0);
  };

  const exportSummary = () => {
    download(`${JSON.stringify(recorder.current.summary(), null, 2)}\n`);
  };

  return (
    <Card className="border-border bg-card">
      <CardContent className="grid gap-3 pt-6 text-sm">
        <div className="flex items-center justify-between gap-3">
          <strong>Benchmark ativo</strong>
          <span className="text-muted-foreground">
            {sampleCount} {sampleCount === 1 ? 'amostra' : 'amostras'}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={reset}>
            Zerar
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={sampleCount === 0}
            onClick={exportSummary}
          >
            Exportar JSON
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
