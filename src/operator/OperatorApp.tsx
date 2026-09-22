import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getOperatorSession,
  loginOperator,
  OperatorApiError,
  operatorStorage,
} from '@/api/operatorApi';
import type { OperatorSession } from '@/types/operator';
import { OperatorBidPage } from './OperatorBidPage';
import { OperatorLoginPage } from './OperatorLoginPage';

export function OperatorApp() {
  const [token, setToken] = useState(() =>
    sessionStorage.getItem(operatorStorage.tokenKey),
  );
  const [session, setSession] = useState<OperatorSession | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [isSyncing, setIsSyncing] = useState(Boolean(token));
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const requestSequence = useRef(0);
  const pendingRequests = useRef(0);

  const logout = useCallback(() => {
    sessionStorage.removeItem(operatorStorage.tokenKey);
    setToken(null);
    setSession(null);
    setIsLoading(false);
    setIsSyncing(false);
    setLoadError('');
    setNotice('');
    requestSequence.current += 1;
  }, []);

  const refreshSession = useCallback(async () => {
    if (!token) {
      return null;
    }

    const requestId = ++requestSequence.current;
    pendingRequests.current += 1;
    setIsSyncing(true);
    try {
      const nextSession = await getOperatorSession(token);
      if (requestId === requestSequence.current) {
        setSession(nextSession);
        setLoadError('');
      }
      return nextSession;
    } catch (error) {
      if (error instanceof OperatorApiError && error.status === 401) {
        logout();
        return null;
      }
      setLoadError('Não foi possível sincronizar o lote em pista.');
      return null;
    } finally {
      setIsLoading(false);
      pendingRequests.current = Math.max(0, pendingRequests.current - 1);
      if (pendingRequests.current === 0) {
        setIsSyncing(false);
      }
    }
  }, [logout, token]);

  useEffect(() => {
    if (!token) {
      return;
    }

    const initialRefresh = window.setTimeout(() => {
      void refreshSession();
    }, 0);
    const interval = window.setInterval(() => {
      void refreshSession();
    }, 5_000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [refreshSession, token]);

  async function handleLogin(code: string) {
    const result = await loginOperator(code);
    sessionStorage.setItem(operatorStorage.tokenKey, result.accessToken);
    setIsLoading(true);
    setIsSyncing(true);
    setToken(result.accessToken);
  }

  const handleLotConflict = useCallback(async () => {
    setNotice('O lote em pista mudou. Confira o lote atual antes de lançar.');
    return refreshSession();
  }, [refreshSession]);

  if (!token) {
    return <OperatorLoginPage onLogin={handleLogin} />;
  }

  if (isLoading || !session) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4">
        <div role="status" className="text-center">
          <p className="t-section">Sincronizando a pista…</p>
          {loadError ? (
            <p className="mt-2 text-sm text-destructive">{loadError}</p>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <OperatorBidPage
      key={session.currentLot?.id ?? 'no-active-lot'}
      token={token}
      session={session}
      isSyncing={isSyncing}
      notice={notice}
      onRefresh={refreshSession}
      onLotConflict={handleLotConflict}
      onClearNotice={() => setNotice('')}
      onLogout={logout}
    />
  );
}
