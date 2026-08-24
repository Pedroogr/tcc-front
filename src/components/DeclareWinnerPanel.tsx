import { useEffect, useState } from 'react';
import { declareWinner } from '../api/salesApi';
import type { Bid, Lot } from '../types/lot';
import type { Sale } from '../types/sale';

type DeclareWinnerPanelProps = {
  inPistaLot: Lot | null;
  winningBid: Bid | null;
  onDeclared: () => void | Promise<void>;
};

function formatCurrency(value?: string | number | null) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
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

export function DeclareWinnerPanel({
  inPistaLot,
  winningBid,
  onDeclared,
}: DeclareWinnerPanelProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [sale, setSale] = useState<Sale | null>(null);

  // Limpa a venda exibida ao trocar o lote em pista.
  useEffect(() => {
    // O painel permanece montado entre lotes; este reset separa os estados de
    // vendas distintas sem alterar o contrato do componente.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSale(null);
    setError('');
  }, [inPistaLot?.id]);

  async function handleDeclareWinner() {
    if (!inPistaLot || !winningBid) {
      return;
    }

    const leaderName = winningBid.bidder?.name || 'o comprador líder';
    const confirmed = window.confirm(
      `Bater o martelo e vender o lote ${inPistaLot.code} para ${leaderName} por ${formatCurrency(
        winningBid.amount,
      )}?`,
    );

    if (!confirmed) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const created = await declareWinner({ lotId: inPistaLot.id });
      setSale(created);
      await onDeclared();
    } catch (declareError) {
      setError(
        parseErrorMessage(
          declareError,
          'Não foi possível declarar o vencedor agora.',
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="declare-winner-panel">
      <div className="form-header compact">
        <h2>Encerramento do lote</h2>
      </div>

      {sale ? (
        <div className="winner-result">
          <p className="winner-result-title">
            Lote {sale.lot?.code ?? inPistaLot?.code} vendido por{' '}
            <strong>{formatCurrency(sale.finalPrice)}</strong>.
          </p>
          <div className="winner-buyer">
            <span className="eyebrow">Comprador vencedor</span>
            <strong>{sale.buyer?.name ?? 'Comprador'}</strong>
            <dl className="winner-buyer-contact">
              {sale.buyer?.email && (
                <div>
                  <dt>E-mail</dt>
                  <dd>{sale.buyer.email}</dd>
                </div>
              )}
              {sale.buyer?.phone && (
                <div>
                  <dt>Telefone</dt>
                  <dd>{sale.buyer.phone}</dd>
                </div>
              )}
              {sale.buyer?.document && (
                <div>
                  <dt>Documento</dt>
                  <dd>{sale.buyer.document}</dd>
                </div>
              )}
            </dl>
            <p className="loading-message compact">
              Estes dados ficam salvos em "Vendas / Arremates" para combinar o
              transporte depois.
            </p>
          </div>
        </div>
      ) : !inPistaLot ? (
        <p className="loading-message compact">
          Nenhum lote em pista no momento. Coloque um lote em pista para poder
          declarar o vencedor.
        </p>
      ) : (
        <>
          <div className="winner-current">
            <span className="eyebrow">Lote em pista</span>
            <strong>
              {inPistaLot.code} · {inPistaLot.title}
            </strong>
            {winningBid ? (
              <span className="bid-current">
                Líder atual: {winningBid.bidder?.name || 'Comprador'} ·{' '}
                {formatCurrency(winningBid.amount)}
              </span>
            ) : (
              <span className="bid-current">Ainda sem lances neste lote.</span>
            )}
          </div>

          {error && <p className="error-message compact">{error}</p>}

          <button
            className="primary-action"
            type="button"
            onClick={handleDeclareWinner}
            disabled={isSubmitting || !winningBid}
          >
            {isSubmitting ? 'Declarando...' : 'Bater o martelo (declarar vencedor)'}
          </button>

          {!winningBid && (
            <p className="loading-message compact">
              O martelo confirma automaticamente o comprador com o lance vencedor.
            </p>
          )}
        </>
      )}
    </div>
  );
}
