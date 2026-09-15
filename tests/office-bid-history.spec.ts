import { expect, test } from '@playwright/test';
import {
  applyOfficeBidEvent,
  reconcileOfficeBidHistory,
} from '../src/utils/officeBidHistory';
import type { OfficeBid } from '../src/types/lot';

const olderBid: OfficeBid = {
  id: 'bid-old',
  lotId: 'lot-1',
  amount: '1000',
  status: 'OUTBID',
  createdAt: '2026-09-03T12:00:00.000Z',
  bidder: { id: 'buyer-old', name: 'Comprador anterior' },
};

const winningBid: OfficeBid = {
  id: 'bid-winning',
  lotId: 'lot-1',
  amount: '1100',
  status: 'WINNING',
  createdAt: '2026-09-03T12:01:00.000Z',
  bidder: { id: 'buyer-winning', name: 'Comprador vencedor' },
};

test('does not duplicate a bid received by HTTP before the same socket event', () => {
  const result = applyOfficeBidEvent([winningBid, olderBid], {
    bidId: winningBid.id,
    lotId: winningBid.lotId,
    amount: String(winningBid.amount),
    createdAt: winningBid.createdAt,
    bidder: winningBid.bidder,
  });

  expect(result.map((bid) => bid.id)).toEqual(['bid-winning', 'bid-old']);
  expect(result[0].status).toBe('WINNING');
});

test('does not replace a newer socket bid with an older HTTP snapshot', () => {
  const olderSnapshot: OfficeBid[] = [
    { ...olderBid, status: 'WINNING' },
    {
      ...olderBid,
      id: 'bid-earliest',
      amount: '900',
      createdAt: '2026-09-03T11:59:00.000Z',
    },
  ];

  const result = reconcileOfficeBidHistory(
    [winningBid, olderBid],
    olderSnapshot,
    'lot-1',
  );

  expect(result).toEqual([winningBid, olderBid]);
});
