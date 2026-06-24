import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { authStorage } from '../api/http';
import {
  createOfficeInvite,
  listOfficeInvites,
  revokeOfficeInvite,
  type OfficeInvite,
} from '../api/adminApi';
import type { User } from '../types/user';

function getStoredUser(): User | null {
  const stored = localStorage.getItem(authStorage.userKey);

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as User;
  } catch {
    return null;
  }
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

function formatDate(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}

export function AdminApp() {
  const token = localStorage.getItem(authStorage.tokenKey);
  const user = getStoredUser();
  const isAdmin = Boolean(token && user?.platformRole === 'SYSTEM_ADMIN');

  const [invites, setInvites] = useState<OfficeInvite[]>([]);
  const [isLoadingInvites, setIsLoadingInvites] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('7');
  const [createdLink, setCreatedLink] = useState('');
  const [actionError, setActionError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadInvites = useCallback(async () => {
    setIsLoadingInvites(true);

    try {
      setInvites(await listOfficeInvites());
    } catch (error) {
      setActionError(parseErrorMessage(error, 'Nao foi possivel carregar os convites.'));
    } finally {
      setIsLoadingInvites(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      window.location.assign('/');
      return;
    }

    void loadInvites();
  }, [isAdmin, loadInvites]);

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4 text-sm text-neutral-600">
        Redirecionando para o login...
      </div>
    );
  }

  function handleLogout() {
    localStorage.removeItem(authStorage.tokenKey);
    localStorage.removeItem(authStorage.userKey);
    localStorage.removeItem(authStorage.auctionHouseKey);
    localStorage.removeItem(authStorage.actorTypeKey);
    window.location.assign('/');
  }

  async function handleCreateInvite(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setActionError('');
    setCreatedLink('');

    try {
      const invite = await createOfficeInvite({
        email: inviteEmail.trim() || undefined,
        expiresInDays: Number(expiresInDays) || 7,
      });

      setCreatedLink(
        invite.registrationUrl ??
          `${window.location.origin}/cadastro-escritorio/${invite.token}`,
      );
      setInviteEmail('');
      await loadInvites();
    } catch (error) {
      setActionError(parseErrorMessage(error, 'Nao foi possivel criar o convite.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRevoke(id: string) {
    setActionError('');

    try {
      await revokeOfficeInvite(id);
      await loadInvites();
    } catch (error) {
      setActionError(parseErrorMessage(error, 'Nao foi possivel revogar o convite.'));
    }
  }

  return (
    <div className="min-h-screen bg-neutral-100 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Painel administrativo</h1>
            <p className="text-sm text-neutral-600">
              {user?.name} - {user?.email}
            </p>
          </div>
          <button
            className="rounded border border-neutral-300 px-3 py-1 text-sm"
            type="button"
            onClick={handleLogout}
          >
            Sair
          </button>
        </header>

        <section className="rounded-lg border border-neutral-300 bg-white p-4">
          <h2 className="mb-3 font-semibold">Novo convite para casa leiloeira</h2>

          <form className="flex flex-wrap items-end gap-3" onSubmit={handleCreateInvite}>
            {/* <label className="text-sm">
              E-mail (opcional)
              <input
                className="mt-1 block rounded border border-neutral-300 p-2"
                type="email"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
              />
            </label> */}

            <label className="text-sm">
              Validade (dias)
              <input
                className="mt-1 block w-24 rounded border border-neutral-300 p-2"
                min="1"
                type="number"
                value={expiresInDays}
                onChange={(event) => setExpiresInDays(event.target.value)}
              />
            </label>

            <button
              className="rounded bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'Criando...' : 'Criar convite'}
            </button>
          </form>

          {createdLink && (
            <div className="mt-3 flex items-center gap-2 rounded bg-neutral-50 p-2 text-sm">
              <code className="break-all">{createdLink}</code>
              <button
                className="rounded border border-neutral-300 px-2 py-1"
                type="button"
                onClick={() => void navigator.clipboard.writeText(createdLink)}
              >
                Copiar
              </button>
            </div>
          )}

          {actionError && <p className="mt-2 text-sm text-red-600">{actionError}</p>}
        </section>

        <section className="rounded-lg border border-neutral-300 bg-white p-4">
          <h2 className="mb-3 font-semibold">Convites</h2>

          {isLoadingInvites ? (
            <p className="text-sm text-neutral-600">Carregando...</p>
          ) : invites.length === 0 ? (
            <p className="text-sm text-neutral-600">Nenhum convite criado ainda.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-300">
                  <th className="py-1">E-mail</th>
                  <th className="py-1">Status</th>
                  <th className="py-1">Expira em</th>
                  <th className="py-1">Escritorio</th>
                  <th className="py-1" />
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => (
                  <tr className="border-b border-neutral-100" key={invite.id}>
                    <td className="py-1">{invite.email || '-'}</td>
                    <td className="py-1">{invite.status}</td>
                    <td className="py-1">{formatDate(invite.expiresAt)}</td>
                    <td className="py-1">{invite.auctionHouse?.name || '-'}</td>
                    <td className="py-1">
                      {invite.status === 'PENDING' && (
                        <button
                          className="rounded border border-neutral-300 px-2 py-1"
                          type="button"
                          onClick={() => void handleRevoke(invite.id)}
                        >
                          Revogar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

export default AdminApp;
