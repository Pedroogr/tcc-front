import type { OfficeBid } from '@/types/lot';
import { Money } from '@/design/primitives/Money';
import { formatBidStatus } from '@/utils/auctionLabels';

type OfficeBidHistoryProps = {
  bids: OfficeBid[];
};

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Auditoria nominal do lote em pista, visivel apenas ao escritorio responsavel
// (RF07). Renderizada somente dentro do ramo canManage da sala.
export function OfficeBidHistory({ bids }: OfficeBidHistoryProps) {
  if (bids.length === 0) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between gap-4 border-b border-border px-4.5 py-3.5">
        <span className="t-label">Histórico de lances</span>
        <span className="text-xs text-text-subtle">{bids.length}</span>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-border text-text-subtle">
              <th className="px-4.5 py-2.5 font-medium">Comprador</th>
              <th className="px-4.5 py-2.5 font-medium">Valor</th>
              <th className="px-4.5 py-2.5 font-medium">Horário</th>
              <th className="px-4.5 py-2.5 font-medium">Situação</th>
            </tr>
          </thead>
          <tbody>
            {bids.map((bid) => (
              <tr className="border-b border-border last:border-b-0" key={bid.id}>
                <td className="max-w-40 truncate px-4.5 py-2.5 font-medium text-foreground">
                  {bid.bidder.name}
                </td>
                <td className="px-4.5 py-2.5">
                  <Money muted size="sm" value={bid.amount} />
                </td>
                <td className="px-4.5 py-2.5 tabular-nums text-muted-foreground">
                  {formatTime(bid.createdAt)}
                </td>
                <td className="px-4.5 py-2.5 text-[11.5px] text-text-subtle">
                  {formatBidStatus(bid.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
