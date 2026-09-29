import type { NormalizedBox } from '@/gesture/pose-types';
import { apiRequest } from './http';

export type GestureEventSubmission = {
  eventId: string;
  capturedAt: string;
  personBox: NormalizedBox;
  snapshot: Blob;
};

export type GestureEventAccepted = {
  eventId: string;
  expiresAt: string;
};

export function submitGestureEvent(
  auctionId: string,
  event: GestureEventSubmission,
) {
  const formData = new FormData();
  formData.append('eventId', event.eventId);
  formData.append('capturedAt', event.capturedAt);
  formData.append('personBox', JSON.stringify(event.personBox));
  formData.append('snapshot', event.snapshot, `gesture-${event.eventId}.jpg`);

  return apiRequest<GestureEventAccepted>(
    `/auctions/${encodeURIComponent(auctionId)}/gesture-events`,
    { method: 'POST', body: formData },
  );
}
