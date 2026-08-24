import type { ChangeEvent } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type LotImageItem = {
  id: string;
  fileName: string;
  dataUrl: string;
  description?: string;
};

type LotImageInputProps = {
  images: LotImageItem[];
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (imageId: string) => void;
};

export function LotImageInput({ images, onChange, onRemove }: LotImageInputProps) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <span className="text-sm font-medium">Imagens do lote</span>
        <p className="mt-1 text-xs text-muted-foreground">
          Selecione uma ou mais imagens dos animais.
        </p>
      </div>

      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-muted px-4 py-5 text-sm font-medium transition-colors hover:border-ring hover:bg-accent focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40">
        <ImagePlus className="size-4 text-primary" />
        Adicionar imagens
        <input
          accept="image/*"
          className="sr-only font-normal"
          multiple
          type="file"
          onChange={onChange}
        />
      </label>

      {images.length > 0 && (
        <ul className="grid gap-2.5 sm:grid-cols-2">
          {images.map((image) => (
            <li className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-muted p-2" key={image.id}>
              <img
                alt=""
                className="aspect-square size-14 rounded-md border border-border object-cover"
                src={image.dataUrl}
              />
              <span className="min-w-0 break-words text-xs font-normal text-muted-foreground">
                {image.fileName}
              </span>
              <Button
                aria-label={`Remover ${image.fileName}`}
                size="icon-sm"
                type="button"
                variant="ghost"
                onClick={() => onRemove(image.id)}
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
