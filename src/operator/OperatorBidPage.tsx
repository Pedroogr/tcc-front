import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, LogOut, Search, Wifi, WifiOff } from 'lucide-react';
import {
  createOperatorBid,
  OperatorApiError,
  searchOperatorBuyers,
} from '@/api/operatorApi';
import { createOperatorCommerceSocket } from '@/api/socket';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { OperatorBuyer, OperatorSession } from '@/types/operator';

type OperatorBidPageProps = {
  token: string;
  session: OperatorSession;
  isSyncing: boolean;
  syncError: string;
  notice: string;
  onRefresh: () => Promise<OperatorSession | null>;
  onAuthoritativeConflict: (message: string) => Promise<OperatorSession | null>;
  onClearNotice: () => void;
  onLogout: () => void;
};

const currency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 2,
});

function money(value: string | number | null) {
  return value === null ? '—' : currency.format(Number(value));
}

function buyerLabel(buyer: OperatorBuyer) {
  return buyer.documentLast4
    ? `${buyer.name} · final ${buyer.documentLast4}`
    : buyer.name;
}

export function OperatorBidPage({
  token,
  session,
  isSyncing,
  syncError,
  notice,
  onRefresh,
  onAuthoritativeConflict,
  onClearNotice,
  onLogout,
}: OperatorBidPageProps) {
  const [query, setQuery] = useState('');
  const [buyers, setBuyers] = useState<OperatorBuyer[]>([]);
  const [selectedBuyer, setSelectedBuyer] = useState<OperatorBuyer | null>(null);
  const [amount, setAmount] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [connected, setConnected] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const lot = session.currentLot;

  useEffect(() => {
    const socket = createOperatorCommerceSocket(token);
    const reconcile = () => {
      void onRefresh();
    };
    const handleConnect = () => {
      setConnected(true);
      socket.emit('auction:join', {
        auctionId: session.operatorAccess.auctionId,
      });
      reconcile();
    };
    const handleDisconnect = () => setConnected(false);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleDisconnect);
    socket.on('lot:stage-changed', reconcile);
    socket.on('bid:price-updated', reconcile);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      socket.disconnect();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [onRefresh, session.operatorAccess.auctionId, token]);

  useEffect(() => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery || selectedBuyer) {
      return;
    }

    const timer = window.setTimeout(() => {
      setIsSearching(true);
      searchOperatorBuyers(normalizedQuery, token)
        .then((result) => {
          setBuyers(result);
          setError('');
        })
        .catch((requestError: unknown) => {
          if (requestError instanceof OperatorApiError && requestError.status === 401) {
            onLogout();
            return;
          }
          setBuyers([]);
          setError('Não foi possível buscar os compradores agora.');
        })
        .finally(() => setIsSearching(false));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [onLogout, query, selectedBuyer, token]);

  const numericAmount = Number(amount);
  const minimum = Number(lot?.nextMinimumBid ?? 0);
  const amountIsValid = useMemo(
    () =>
      amount !== '' &&
      Number.isFinite(numericAmount) &&
      numericAmount >= minimum &&
      numericAmount % 5 === 0,
    [amount, minimum, numericAmount],
  );
  const submissionBlocked =
    !lot ||
    !selectedBuyer ||
    !amountIsValid ||
    !online ||
    !connected ||
    isSyncing ||
    isSubmitting;

  function chooseBuyer(buyer: OperatorBuyer) {
    setSelectedBuyer(buyer);
    setQuery(buyer.name);
    setBuyers([]);
    setMessage('');
    setError('');
    onClearNotice();
  }

  function changeQuery(value: string) {
    setQuery(value);
    setSelectedBuyer(null);
    setBuyers([]);
    setMessage('');
    onClearNotice();
  }

  async function submitBid() {
    if (!lot || !selectedBuyer || submissionBlocked) {
      return;
    }

    setIsSubmitting(true);
    setError('');
    setMessage('');
    try {
      await createOperatorBid(
        {
          expectedLotId: lot.id,
          buyerId: selectedBuyer.id,
          amount: numericAmount,
        },
        token,
      );
      setIsReviewing(false);
      setSelectedBuyer(null);
      setQuery('');
      setAmount('');
      setMessage('Lance registrado com sucesso.');
      onClearNotice();
      await onRefresh();
    } catch (requestError) {
      setIsReviewing(false);
      if (requestError instanceof OperatorApiError && requestError.status === 401) {
        onLogout();
        return;
      }
      if (requestError instanceof OperatorApiError && requestError.status === 409) {
        setSelectedBuyer(null);
        setQuery('');
        setAmount('');
        await onAuthoritativeConflict(
          'O lote em pista mudou. Confira o lote atual antes de lançar.',
        );
        return;
      }
      if (requestError instanceof OperatorApiError && requestError.status === 400) {
        setSelectedBuyer(null);
        setQuery('');
        setAmount('');
        await onAuthoritativeConflict(
          'O valor mínimo mudou. Confira o valor atual antes de lançar.',
        );
        return;
      }
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível registrar o lance.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 bg-background px-4 py-5 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="t-label">Operador de pista</p>
          <p className="text-sm text-muted-foreground">
            {session.operatorAccess.label}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onLogout}>
          <LogOut aria-hidden="true" />
          Sair
        </Button>
      </header>

      <div
        role="status"
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
          online && connected && !syncError
            ? 'border-success/30 bg-success/10 text-success'
            : 'border-destructive/30 bg-destructive/10 text-destructive'
        }`}
      >
        {online && connected && !syncError ? (
          <Wifi aria-hidden="true" className="size-4" />
        ) : (
          <WifiOff aria-hidden="true" className="size-4" />
        )}
        {!online
          ? 'Sem conexão'
          : !connected
            ? 'Reconectando…'
            : syncError
              ? 'Sincronização indisponível'
              : 'Sincronizado'}
        {isSyncing && online && !syncError ? ' · atualizando' : ''}
      </div>

      {lot ? (
        <>
          <Card className="gap-4 border-brand-line py-5">
            <CardHeader>
              <CardDescription>Lote em pista</CardDescription>
              <CardTitle>
                <h1 className="t-display">Lote {lot.code}</h1>
              </CardTitle>
              {lot.title !== `Lote ${lot.code}` ? (
                <p className="text-sm text-muted-foreground">{lot.title}</p>
              ) : null}
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted p-3">
                <p className="t-label">Lance atual</p>
                <p className="mt-1 font-mono text-lg text-price">
                  {money(lot.currentPrice)}
                </p>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <p className="t-label">Próximo mínimo</p>
                <p className="mt-1 font-mono text-lg">
                  {money(lot.nextMinimumBid)}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="gap-4 py-5">
            <CardHeader>
              <CardTitle>Registrar lance presencial</CardTitle>
              <CardDescription>
                Selecione o comprador aprovado e informe o valor anunciado.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-5">
              <div className="relative grid gap-2">
                <label className="t-label" htmlFor="operator-buyer-search">
                  Buscar comprador
                </label>
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    id="operator-buyer-search"
                    value={query}
                    onChange={(event) => changeQuery(event.target.value)}
                    placeholder="Nome ou final do documento"
                    className="h-12 pl-10"
                    autoComplete="off"
                  />
                </div>
                {isSearching ? (
                  <p className="text-sm text-muted-foreground">Buscando…</p>
                ) : null}
                {buyers.length > 0 ? (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 grid rounded-lg border bg-popover p-1 shadow-lg">
                    {buyers.map((buyer) => (
                      <button
                        type="button"
                        key={buyer.id}
                        className="rounded-md px-3 py-3 text-left text-sm hover:bg-accent"
                        onClick={() => chooseBuyer(buyer)}
                      >
                        {buyerLabel(buyer)}
                      </button>
                    ))}
                  </div>
                ) : null}
                {selectedBuyer ? (
                  <p className="flex items-center gap-2 text-sm text-success">
                    <CheckCircle2 aria-hidden="true" className="size-4" />
                    {buyerLabel(selectedBuyer)}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-2">
                <label className="t-label" htmlFor="operator-bid-amount">
                  Valor do lance
                </label>
                <Input
                  id="operator-bid-amount"
                  type="number"
                  min={minimum}
                  step="5"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setMessage('');
                  }}
                  placeholder={lot.nextMinimumBid ?? '0'}
                  className="h-14 font-mono text-xl"
                />
                <p className="text-xs text-muted-foreground">
                  Mínimo {money(lot.nextMinimumBid)} · incrementos de R$ 5
                </p>
              </div>

              {message ? (
                <p role="status" className="text-sm text-success">
                  {message}
                </p>
              ) : null}
              {notice || error ? (
                <p role="alert" className="text-sm text-destructive">
                  {notice || error}
                </p>
              ) : null}

              <Button
                type="button"
                size="lg"
                className="h-14 w-full text-base"
                disabled={submissionBlocked}
                onClick={() => setIsReviewing(true)}
              >
                Revisar lance
              </Button>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="mt-8 text-center">
          <CardHeader>
            <CardTitle>
              <h1>Nenhum lote em pista</h1>
            </CardTitle>
            <CardDescription>
              A tela será atualizada automaticamente quando o próximo lote entrar.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <Dialog open={isReviewing} onOpenChange={setIsReviewing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar lance presencial</DialogTitle>
            <DialogDescription>
              Confira os dados. O lance será registrado imediatamente.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid gap-3 rounded-lg bg-muted p-4 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Lote</dt>
              <dd className="font-medium">Lote {lot?.code}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Comprador</dt>
              <dd className="text-right font-medium">{selectedBuyer?.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Valor</dt>
              <dd className="font-mono text-lg font-semibold text-price">
                {money(numericAmount)}
              </dd>
            </div>
          </dl>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsReviewing(false)}
            >
              Voltar
            </Button>
            <Button
              type="button"
              disabled={submissionBlocked}
              onClick={() => void submitBid()}
            >
              {isSubmitting ? 'Registrando…' : 'Confirmar lance'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
