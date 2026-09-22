import { useCallback, useEffect, useState } from 'react';
import { Copy, KeyRound, RefreshCw, Trash2 } from 'lucide-react';
import {
  createOperatorAccess,
  listOperatorAccesses,
  revokeOperatorAccess,
} from '@/api/operatorApi';
import type {
  CreatedOperatorAccess,
  OperatorAccessSummary,
} from '@/types/operator';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type OperatorAccessPanelProps = {
  auctionId: string;
};

function accessStatus(access: OperatorAccessSummary) {
  if (access.revokedAt) return 'Revogado';
  if (new Date(access.expiresAt).getTime() <= Date.now()) return 'Expirado';
  if (access.usedAt) return 'Em uso';
  return 'Aguardando ativação';
}

export function OperatorAccessPanel({ auctionId }: OperatorAccessPanelProps) {
  const [accesses, setAccesses] = useState<OperatorAccessSummary[]>([]);
  const [label, setLabel] = useState('');
  const [created, setCreated] = useState<CreatedOperatorAccess | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');

  const loadAccesses = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setAccesses(await listOperatorAccesses(auctionId));
    } catch {
      setError('Não foi possível carregar os acessos de pisteiro.');
    } finally {
      setIsLoading(false);
    }
  }, [auctionId]);

  useEffect(() => {
    let active = true;

    void listOperatorAccesses(auctionId)
      .then((nextAccesses) => {
        if (active) setAccesses(nextAccesses);
      })
      .catch(() => {
        if (active) setError('Não foi possível carregar os acessos de pisteiro.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [auctionId]);

  async function handleCreate() {
    const normalizedLabel = label.trim();
    if (!normalizedLabel) return;

    setIsSaving(true);
    setError('');
    try {
      const next = await createOperatorAccess(auctionId, normalizedLabel);
      setCreated(next);
      setCopyMessage('');
      setLabel('');
      await loadAccesses();
    } catch {
      setError('Não foi possível gerar o código do pisteiro.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCopy() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.code);
      setCopyMessage('Código copiado.');
    } catch {
      setCopyMessage('Selecione e copie o código manualmente.');
    }
  }

  async function handleRevoke(access: OperatorAccessSummary) {
    if (!window.confirm(`Revogar o acesso "${access.label}"?`)) return;

    setError('');
    try {
      await revokeOperatorAccess(access.id);
      await loadAccesses();
    } catch {
      setError('Não foi possível revogar o acesso.');
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4.5 py-3.5">
        <div>
          <span className="t-label">Operação local</span>
          <h2 className="mt-1 text-base font-semibold">Acessos de pisteiro</h2>
        </div>
        <Button
          aria-label="Atualizar acessos"
          size="icon-sm"
          type="button"
          variant="ghost"
          onClick={() => void loadAccesses()}
        >
          <RefreshCw />
        </Button>
      </header>

      <div className="grid gap-4 p-4.5">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="grid flex-1 gap-1.5 text-xs font-semibold">
            Identificação do acesso
            <Input
              maxLength={80}
              placeholder="Pista principal"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <Button
            className="self-end"
            disabled={isSaving || !label.trim()}
            type="button"
            onClick={() => void handleCreate()}
          >
            <KeyRound />
            {isSaving ? 'Gerando...' : 'Gerar código'}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando acessos...</p>
        ) : accesses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum acesso gerado para este remate.
          </p>
        ) : (
          <ul className="grid gap-2">
            {accesses.map((access) => (
              <li
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted px-3 py-2.5"
                key={access.id}
              >
                <div className="min-w-0">
                  <strong className="block truncate text-sm">{access.label}</strong>
                  <span className="text-xs text-muted-foreground">
                    {accessStatus(access)} · expira em{' '}
                    {new Date(access.expiresAt).toLocaleString('pt-BR')}
                  </span>
                </div>
                <Button
                  aria-label={`Revogar ${access.label}`}
                  disabled={Boolean(access.revokedAt)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                  onClick={() => void handleRevoke(access)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={Boolean(created)}
        onOpenChange={(open) => {
          if (!open) setCreated(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Código temporário do pisteiro</DialogTitle>
            <DialogDescription>
              Este código aparece somente agora, vale por até 24 horas e só pode
              ser ativado em um dispositivo.
            </DialogDescription>
          </DialogHeader>
          {created && (
            <div className="grid gap-4">
              <code className="rounded-lg border border-brand-line bg-brand-tint px-4 py-5 text-center font-mono text-2xl font-semibold tracking-wider text-primary">
                {created.code}
              </code>
              {copyMessage && (
                <p className="text-center text-xs text-muted-foreground">
                  {copyMessage}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => void handleCopy()}>
                  <Copy />
                  Copiar código
                </Button>
                <Button
                  aria-label="Fechar código"
                  type="button"
                  onClick={() => setCreated(null)}
                >
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
