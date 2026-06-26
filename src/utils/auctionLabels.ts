export function formatAuctionStatus(status?: string | null) {
  const labels: Record<string, string> = {
    DRAFT: 'RASCUNHO',
    SCHEDULED: 'AGENDADO',
    LIVE: 'AO VIVO',
    FINISHED: 'FINALIZADO',
    CANCELED: 'CANCELADO',
    STREAM_ENDED: 'ENCERRADA',
    STREAM_INTERRUPTED: 'INTERROMPIDA',
  };

  return status ? (labels[status] ?? status) : 'RASCUNHO';
}

export function formatAuctionMode(mode?: string | null) {
  const labels: Record<string, string> = {
    LIVE: 'AO VIVO',
    PRE_BID: 'PRÉ-LANCE',
    TIMED: 'CRONOMETRADO',
    HYBRID: 'HÍBRIDO',
  };

  return mode ? (labels[mode] ?? mode) : 'AO VIVO';
}

export function formatStreamStatus(status?: string | null) {
  const labels: Record<string, string> = {
    WAITING: 'AGUARDANDO',
    LIVE: 'AO VIVO',
    ENDED: 'ENCERRADA',
    ERROR: 'INTERROMPIDA',
  };

  return status ? (labels[status] ?? status) : 'AGUARDANDO';
}

export function formatLotStatus(status?: string | null) {
  const labels: Record<string, string> = {
    DRAFT: 'Rascunho',
    UNDER_REVIEW: 'Em análise',
    APPROVED: 'Aprovado',
    AVAILABLE: 'Liberado',
    IN_AUCTION: 'Em pista',
    SOLD: 'Vendido',
    WITHDRAWN: 'Retirado',
    REJECTED: 'Recusado',
  };

  return status ? (labels[status] ?? status) : '';
}

export function formatBidStatus(status?: string | null) {
  const labels: Record<string, string> = {
    VALID: 'Válido',
    WINNING: 'Vencendo',
    OUTBID: 'Superado',
    CANCELED: 'Cancelado',
  };

  return status ? (labels[status] ?? status) : '';
}

export function formatRegistrationStatus(status?: string | null) {
  const labels: Record<string, string> = {
    PENDING: 'Pendente',
    APPROVED: 'Aprovado',
    REJECTED: 'Recusado',
    BLOCKED: 'Bloqueado',
  };

  return status ? (labels[status] ?? status) : '';
}
