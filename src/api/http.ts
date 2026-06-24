export const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const authStorage = {
  tokenKey: 'cattleAuctionToken',
  userKey: 'cattleAuctionUser',
  auctionHouseKey: 'cattleAuctionHouse',
  actorTypeKey: 'cattleAuctionActorType',
};

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem(authStorage.tokenKey);
  const isFormData = options.body instanceof FormData;

  const response = await fetch(`${apiUrl}${path}`, {
    headers: {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Nao foi possivel concluir a requisicao.');
  }

  return response.json() as Promise<T>;
}
