import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Copy, LogOut, RefreshCw, ShieldCheck, Ticket, XCircle } from 'lucide-react';
import { authStorage } from '../api/http';
import {
  createOfficeInvite,
  listOfficeInvites,
  revokeOfficeInvite,
  type OfficeInvite,
} from '../api/adminApi';
import type { User } from '../types/user';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

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

function formatInviteStatus(status: string) {
  const labels: Record<string, string> = {
    PENDING: 'Pendente',
    USED: 'Utilizado',
    REVOKED: 'Revogado',
    EXPIRED: 'Expirado',
  };

  return labels[status] || status;
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
  const [invitesError, setInvitesError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadInvites = useCallback(async () => {
    setIsLoadingInvites(true);
    setInvitesError('');

    try {
      setInvites(await listOfficeInvites());
    } catch (error) {
      setInvites([]);
      setInvitesError(parseErrorMessage(error, 'Não foi possível carregar os convites.'));
    } finally {
      setIsLoadingInvites(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      window.location.assign('/');
      return;
    }

    // A carga inicial sincroniza esta tela com a API; as atualizacoes de estado
    // acontecem dentro da rotina assincrona e nao derivam do render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadInvites();
  }, [isAdmin, loadInvites]);

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-sm text-muted-foreground">
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/95 backdrop-blur-lg">
        <div className="mx-auto flex min-h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-brand-line bg-brand-tint text-primary">
              <ShieldCheck className="size-4" />
            </span>
            <div className="min-w-0">
              <strong className="block truncate text-sm font-semibold">Administração</strong>
              <span className="block truncate text-xs text-muted-foreground">
                {user?.name} · {user?.email}
              </span>
            </div>
          </div>
          <Button size="sm" type="button" variant="outline" onClick={handleLogout}>
            <LogOut /> Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
        <div className="flex flex-col gap-2 border-b border-border pb-5">
          <span className="t-label">Sistema</span>
          <h1 className="t-section text-[1.85rem]">Painel administrativo</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Crie e acompanhe convites de cadastro para escritórios de remates.
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 lg:sticky lg:top-6">
            <header className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-brand-line bg-brand-tint text-primary">
                <Ticket className="size-4" />
              </span>
              <div>
                <span className="t-label">Novo acesso</span>
                <h2 className="mt-1 text-base font-semibold">Convite para escritório</h2>
              </div>
            </header>

            <form className="flex flex-col gap-4 [&_input]:font-normal" onSubmit={handleCreateInvite}>
              <label className="flex flex-col gap-1.5 font-normal">
                <span className="text-sm font-medium">Validade (dias)</span>
                <Input
                  className="h-11 w-full tabular-nums"
                  min="1"
                  type="number"
                  value={expiresInDays}
                  onChange={(event) => setExpiresInDays(event.target.value)}
                />
              </label>

              <Button className="h-11" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Criando...' : 'Criar convite'}
              </Button>
            </form>

            {createdLink && (
              <div className="flex flex-col gap-2 rounded-lg border border-brand-line bg-brand-tint p-3" role="status">
                <span className="t-label text-primary">Link criado</span>
                <code className="break-all text-xs leading-relaxed text-muted-foreground">
                  {createdLink}
                </code>
                <Button size="sm" type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(createdLink)}>
                  <Copy /> Copiar link
                </Button>
              </div>
            )}

            {actionError && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-[13px] text-destructive" role="alert">
                {actionError}
              </p>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-border bg-card">
            <header className="flex items-center justify-between gap-4 border-b border-border px-4.5 py-4">
              <div>
                <span className="t-label">Histórico</span>
                <h2 className="mt-1 text-base font-semibold">Convites</h2>
              </div>
              {!isLoadingInvites && !invitesError && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {invites.length} {invites.length === 1 ? 'convite' : 'convites'}
                </span>
              )}
            </header>

            {isLoadingInvites ? (
              <div aria-busy="true" className="flex flex-col gap-3 px-4.5 py-5" role="status">
                <span className="sr-only">Carregando convites...</span>
                {[0, 1, 2].map((row) => (
                  <div className="h-16 animate-pulse rounded-lg bg-muted" key={row} />
                ))}
              </div>
            ) : invitesError ? (
              <div className="flex flex-col items-center gap-3 px-5 py-10 text-center" role="alert">
                <p className="text-sm text-destructive">{invitesError}</p>
                <Button size="sm" type="button" variant="outline" onClick={() => void loadInvites()}>
                  <RefreshCw /> Tentar novamente
                </Button>
              </div>
            ) : invites.length === 0 ? (
              <p className="px-5 py-12 text-center text-sm text-muted-foreground">
                Nenhum convite criado ainda.
              </p>
            ) : (
              <ul className="flex flex-col">
                {invites.map((invite) => (
                  <li className="grid gap-4 border-b border-border px-4.5 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1.2fr)_minmax(150px,0.8fr)_auto] sm:items-center" key={invite.id}>
                    <div className="min-w-0">
                      <strong className="block break-words text-[13.5px] font-medium">
                        {invite.auctionHouse?.name || invite.email || 'Convite sem e-mail'}
                      </strong>
                      <span className="mt-1 block break-all text-xs text-muted-foreground">
                        {invite.email || 'Cadastro aberto por link'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-foreground">
                        {formatInviteStatus(invite.status)}
                      </span>
                      <span className="text-[11.5px] text-text-subtle">
                        Expira em {formatDate(invite.expiresAt)}
                      </span>
                    </div>
                    {invite.status === 'PENDING' ? (
                      <Button size="sm" type="button" variant="outline" onClick={() => void handleRevoke(invite.id)}>
                        <XCircle /> Revogar
                      </Button>
                    ) : (
                      <span className="hidden size-8 sm:block" />
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!isLoadingInvites && !invitesError && (
              <footer className="flex justify-end border-t border-border px-4.5 py-3">
                <Button size="sm" type="button" variant="ghost" onClick={() => void loadInvites()}>
                  <RefreshCw /> Atualizar
                </Button>
              </footer>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default AdminApp;
