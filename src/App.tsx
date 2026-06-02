import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import './App.css';
import { login, register } from './api/authApi';
import { createAuction, listAuctions } from './api/auctionsApi';
import { authStorage } from './api/http';
import { createLot, listLots } from './api/lotsApi';
import { upsertSellerProfile } from './api/usersApi';
import type { Auction } from './types/auction';
import type { CreateAuctionPayload } from './types/auction';
import type { CreateLotPayload, Lot } from './types/lot';
import type {
  AuctionHouse,
  CreateSellerProfilePayload,
  CreateUserPayload,
  User,
  UserAccountType,
} from './types/user';

const emptyLotForm = {
  code: '',
  title: '',
  description: '',
  breed: '',
  category: '',
  sex: '',
  ageMonths: '',
  weightKg: '',
  quantity: '1',
  initialPrice: '',
  auctionId: '',
};

const emptyAuctionForm = {
  title: '',
  description: '',
  scheduledAt: '',
  mode: 'LIVE',
};

const emptyUserForm = {
  name: '',
  email: '',
  password: '',
  phone: '',
  document: '',
};

const emptySellerProfileForm = {
  farmName: '',
  ruralRegistration: '',
  stateRegistration: '',
  city: '',
  state: '',
  country: 'BR',
};

type LotFormState = typeof emptyLotForm;
type AuctionFormState = typeof emptyAuctionForm;
type UserFormState = typeof emptyUserForm;
type SellerProfileFormState = typeof emptySellerProfileForm;
type View = 'home' | 'registerLot' | 'sellerProfile' | 'createAuction' | 'auctionRoom';
type AuthMode = 'login' | 'register';

function toNumber(value: string) {
  return value.trim() === '' ? undefined : Number(value);
}

function formatCurrency(value?: string | number | null) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function getStoredUser() {
  const storedUser = localStorage.getItem(authStorage.userKey);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as User;
  } catch {
    localStorage.removeItem(authStorage.userKey);
    localStorage.removeItem(authStorage.tokenKey);
    return null;
  }
}

function getStoredAuctionHouse() {
  const storedAuctionHouse = localStorage.getItem(authStorage.auctionHouseKey);

  if (!storedAuctionHouse) {
    return null;
  }

  try {
    return JSON.parse(storedAuctionHouse) as AuctionHouse;
  } catch {
    localStorage.removeItem(authStorage.auctionHouseKey);
    localStorage.removeItem(authStorage.tokenKey);
    localStorage.removeItem(authStorage.actorTypeKey);
    return null;
  }
}

function persistUserAuth(accessToken: string, user: User) {
  localStorage.setItem(authStorage.tokenKey, accessToken);
  localStorage.setItem(authStorage.actorTypeKey, 'USER');
  localStorage.setItem(authStorage.userKey, JSON.stringify(user));
  localStorage.removeItem(authStorage.auctionHouseKey);
}

function persistAuctionHouseAuth(accessToken: string, auctionHouse: AuctionHouse) {
  localStorage.setItem(authStorage.tokenKey, accessToken);
  localStorage.setItem(authStorage.actorTypeKey, 'AUCTION_HOUSE');
  localStorage.setItem(authStorage.auctionHouseKey, JSON.stringify(auctionHouse));
  localStorage.removeItem(authStorage.userKey);
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    Boolean(localStorage.getItem(authStorage.tokenKey)),
  );
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [view, setView] = useState<View>('home');
  const [lots, setLots] = useState<Lot[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [lotForm, setLotForm] = useState<LotFormState>(emptyLotForm);
  const [auctionForm, setAuctionForm] = useState<AuctionFormState>(emptyAuctionForm);
  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm);
  const [accountType, setAccountType] = useState<UserAccountType>('BUYER');
  const [sellerProfileForm, setSellerProfileForm] = useState<SellerProfileFormState>(
    emptySellerProfileForm,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingLots, setIsLoadingLots] = useState(false);
  const [error, setError] = useState('');
  const [createdLotId, setCreatedLotId] = useState<string | null>(null);
  const [createdAuctionId, setCreatedAuctionId] = useState<string | null>(null);
  const [createdUserName, setCreatedUserName] = useState<string | null>(null);
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser());
  const [currentAuctionHouse, setCurrentAuctionHouse] = useState<AuctionHouse | null>(() =>
    getStoredAuctionHouse(),
  );

  const featuredLots = useMemo(() => {
    return lots;
  }, [lots]);

  const selectableAuctions = useMemo(() => {
    if (!currentAuctionHouse) {
      return auctions;
    }

    return auctions.filter(
      (auction) =>
        auction.auctionHouseId === currentAuctionHouse.id ||
        auction.auctionHouse?.id === currentAuctionHouse.id,
    );
  }, [auctions, currentAuctionHouse]);

  const selectedAuction = useMemo(() => {
    return auctions.find((auction) => auction.id === selectedAuctionId) ?? null;
  }, [auctions, selectedAuctionId]);

  const selectedAuctionLots = useMemo(() => {
    if (!selectedAuctionId) {
      return [];
    }

    return lots.filter(
      (lot) => lot.auctionId === selectedAuctionId || lot.auction?.id === selectedAuctionId,
    );
  }, [lots, selectedAuctionId]);

  async function loadLots() {
    setIsLoadingLots(true);
    setError('');

    try {
      setLots(await listLots());
    } catch {
      setError('Nao foi possivel carregar os lotes agora.');
    } finally {
      setIsLoadingLots(false);
    }
  }

  async function loadAuctions() {
    try {
      const data = await listAuctions();
      setAuctions(data);
      setLotForm((current) => ({
        ...current,
        auctionId: current.auctionId || data[0]?.id || '',
      }));
    } catch {
      setAuctions([]);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      void loadLots();
      void loadAuctions();
    });
  }, []);

  function updateLotField(field: keyof LotFormState, value: string) {
    setLotForm((current) => ({ ...current, [field]: value }));
  }

  function updateAuctionField(field: keyof AuctionFormState, value: string) {
    setAuctionForm((current) => ({ ...current, [field]: value }));
  }

  function updateUserField(field: keyof UserFormState, value: string) {
    setUserForm((current) => ({ ...current, [field]: value }));
  }

  function updateSellerProfileField(field: keyof SellerProfileFormState, value: string) {
    setSellerProfileForm((current) => ({ ...current, [field]: value }));
  }

  function enterAuctionRoom(auctionId: string) {
    setSelectedAuctionId(auctionId);
    setLotForm({ ...emptyLotForm, auctionId });
    setError('');
    setView('auctionRoom');
  }

  async function handleUserSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    const payload: CreateUserPayload = {
      name: userForm.name.trim(),
      email: userForm.email.trim(),
      password: userForm.password,
      phone: userForm.phone.trim() || undefined,
      document: userForm.document.trim() || undefined,
      accountType,
    };

    if (accountType === 'SELLER') {
      payload.sellerProfile = {
        farmName: sellerProfileForm.farmName.trim() || undefined,
        ruralRegistration: sellerProfileForm.ruralRegistration.trim() || undefined,
        stateRegistration: sellerProfileForm.stateRegistration.trim() || undefined,
        city: sellerProfileForm.city.trim() || undefined,
        state: sellerProfileForm.state.trim() || undefined,
        country: sellerProfileForm.country.trim() || undefined,
      };
    }

    try {
      const createdUser = await register(payload);
      const auth = await login({
        email: userForm.email.trim(),
        password: userForm.password,
      });

      if (!auth.user) {
        throw new Error('Login de usuario invalido');
      }

      persistUserAuth(auth.accessToken, auth.user);
      setCreatedUserName(createdUser.name);
      setCurrentUser(auth.user);
      setCurrentAuctionHouse(null);
      setUserForm(emptyUserForm);
      setSellerProfileForm(emptySellerProfileForm);
      setAccountType('BUYER');
      await loadLots();
      await loadAuctions();
      setIsAuthenticated(true);
      setView('home');
    } catch {
      setError('Nao foi possivel cadastrar o usuario. Confira os dados e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const auth = await login({
        email: userForm.email.trim(),
        password: userForm.password,
      });

      if (auth.actorType === 'AUCTION_HOUSE') {
        if (!auth.auctionHouse) {
          throw new Error('Login de escritorio invalido');
        }

        persistAuctionHouseAuth(auth.accessToken, auth.auctionHouse);
        setCreatedUserName(auth.auctionHouse.name);
        setCurrentAuctionHouse(auth.auctionHouse);
        setCurrentUser(null);
      } else {
        if (!auth.user) {
          throw new Error('Login de usuario invalido');
        }

        persistUserAuth(auth.accessToken, auth.user);
        setCreatedUserName(auth.user.name);
        setCurrentUser(auth.user);
        setCurrentAuctionHouse(null);
      }

      await loadLots();
      await loadAuctions();
      setIsAuthenticated(true);
      setView('home');
    } catch {
      setError('E-mail ou senha invalidos.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLotSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    const selectedAuctionId =
      view === 'auctionRoom' && selectedAuction
        ? selectedAuction.id
        : selectableAuctions.some((auction) => auction.id === lotForm.auctionId)
          ? lotForm.auctionId
          : selectableAuctions[0]?.id || '';

    const payload: CreateLotPayload = {
      code: lotForm.code.trim(),
      title: lotForm.title.trim(),
      description: lotForm.description.trim() || undefined,
      breed: lotForm.breed.trim() || undefined,
      category: lotForm.category.trim() || undefined,
      sex: lotForm.sex.trim() || undefined,
      ageMonths: toNumber(lotForm.ageMonths),
      weightKg: toNumber(lotForm.weightKg),
      quantity: toNumber(lotForm.quantity),
      initialPrice: toNumber(lotForm.initialPrice),
      auctionId: selectedAuctionId,
    };

    try {
      const createdLot = await createLot(payload);
      setCreatedLotId(createdLot.id);
      setLotForm({
        ...emptyLotForm,
        auctionId: view === 'auctionRoom' ? selectedAuctionId : selectableAuctions[0]?.id || '',
      });
      await loadLots();
      setView(view === 'auctionRoom' ? 'auctionRoom' : 'home');
    } catch {
      setError('Nao foi possivel enviar o lote para aprovacao. Confira o remate e os campos.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAuctionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    const payload: CreateAuctionPayload = {
      title: auctionForm.title.trim(),
      description: auctionForm.description.trim() || undefined,
      scheduledAt: auctionForm.scheduledAt
        ? new Date(auctionForm.scheduledAt).toISOString()
        : undefined,
      mode: auctionForm.mode,
      status: auctionForm.scheduledAt ? 'SCHEDULED' : 'DRAFT',
    };

    try {
      const auction = await createAuction(payload);
      setCreatedAuctionId(auction.id);
      setSelectedAuctionId(auction.id);
      setAuctionForm(emptyAuctionForm);
      await loadAuctions();
      setLotForm({ ...emptyLotForm, auctionId: auction.id });
      setView('auctionRoom');
    } catch {
      setError('Nao foi possivel criar o remate. Confira os dados e tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSellerProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    const payload: CreateSellerProfilePayload = {
      farmName: sellerProfileForm.farmName.trim() || undefined,
      ruralRegistration: sellerProfileForm.ruralRegistration.trim() || undefined,
      stateRegistration: sellerProfileForm.stateRegistration.trim() || undefined,
      city: sellerProfileForm.city.trim() || undefined,
      state: sellerProfileForm.state.trim() || undefined,
      country: sellerProfileForm.country.trim() || undefined,
    };

    try {
      const user = await upsertSellerProfile(payload);
      persistUserAuth(localStorage.getItem(authStorage.tokenKey) || '', user);
      setCurrentUser(user);
      setSellerProfileForm(emptySellerProfileForm);
      setError('');
      setView('registerLot');
    } catch {
      setError('Nao foi possivel completar o cadastro de produtor.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem(authStorage.tokenKey);
    localStorage.removeItem(authStorage.userKey);
    localStorage.removeItem(authStorage.auctionHouseKey);
    localStorage.removeItem(authStorage.actorTypeKey);
    setIsAuthenticated(false);
    setCreatedUserName(null);
    setCreatedLotId(null);
    setCreatedAuctionId(null);
    setCurrentUser(null);
    setCurrentAuctionHouse(null);
    setSelectedAuctionId(null);
    setView('home');
  }

  const canRequestLot = Boolean(currentAuctionHouse || currentUser?.sellerProfile);
  const canCompleteSellerProfile = Boolean(
    currentUser && !currentUser.buyerProfile && !currentUser.sellerProfile,
  );
  const isRegisterMode = authMode === 'register';
  const selectedLotAuctionId = selectableAuctions.some(
    (auction) => auction.id === lotForm.auctionId,
  )
    ? lotForm.auctionId
    : selectableAuctions[0]?.id || '';

  if (!isAuthenticated) {
    return (
      <main className="app-shell auth-shell">
        <section className="register-page user-register-page">
          <div className="register-copy">
            <span className="brand-inline">
              <span className="brand-mark">CA</span>
              Cattle Auction
            </span>
            <span className="eyebrow">Acesso da plataforma</span>
            <h1>Acesso aos remates</h1>
            <p>
              Entre com seu e-mail e senha. O sistema identifica automaticamente
              contas de usuarios e escritorios.
            </p>
          </div>

          <form
            className="lot-form user-form"
            onSubmit={isRegisterMode ? handleUserSubmit : handleLoginSubmit}
          >
            <div className="auth-tabs" role="tablist" aria-label="Acesso">
              <button
                className={authMode === 'login' ? 'selected' : ''}
                type="button"
                onClick={() => {
                  setAuthMode('login');
                  setError('');
                }}
              >
                Login
              </button>
              <button
                className={authMode === 'register' ? 'selected' : ''}
                type="button"
                onClick={() => {
                  setAuthMode('register');
                  setError('');
                }}
              >
                Cadastro
              </button>
            </div>

            <div className="form-header">
              <h2>
                {authMode === 'register'
                  ? 'Cadastro de usuario'
                  : 'Entrar na conta'}
              </h2>
            </div>

            {authMode === 'register' && (
              <label>
                Nome completo
                <input
                  required
                  value={userForm.name}
                  onChange={(event) => updateUserField('name', event.target.value)}
                  placeholder="Pedro Ribeiro"
                />
              </label>
            )}

            {authMode === 'register' && (
              <div className="account-type-group" aria-label="Tipo de cadastro">
                <button
                  className={accountType === 'BUYER' ? 'selected' : ''}
                  type="button"
                  onClick={() => setAccountType('BUYER')}
                >
                  Comprador
                </button>
                <button
                  className={accountType === 'SELLER' ? 'selected' : ''}
                  type="button"
                  onClick={() => setAccountType('SELLER')}
                >
                  Vendedor
                </button>
              </div>
            )}

            <div className="form-grid">
              <label>
                E-mail
                <input
                  required
                  type="email"
                  value={userForm.email}
                  onChange={(event) => updateUserField('email', event.target.value)}
                  placeholder="pedro@email.com"
                />
              </label>

              <label>
                Senha
                <input
                  required
                  minLength={6}
                  type="password"
                  value={userForm.password}
                  onChange={(event) => updateUserField('password', event.target.value)}
                  placeholder="Minimo 6 caracteres"
                />
              </label>
            </div>

            {authMode === 'register' && (
              <>
                <div className="form-grid">
                  <label>
                    Telefone
                    <input
                      value={userForm.phone}
                      onChange={(event) => updateUserField('phone', event.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </label>

                  <label>
                    Documento
                    <input
                      value={userForm.document}
                      onChange={(event) => updateUserField('document', event.target.value)}
                      placeholder="CPF ou CNPJ"
                    />
                  </label>
                </div>

                {accountType === 'SELLER' && (
                  <div className="seller-inline-fields">
                    <div className="form-header compact">
                      <h2>Dados do vendedor</h2>
                    </div>

                    <label>
                      Nome da fazenda
                      <input
                        value={sellerProfileForm.farmName}
                        onChange={(event) =>
                          updateSellerProfileField('farmName', event.target.value)
                        }
                        placeholder="Fazenda Santa Maria"
                      />
                    </label>

                    <div className="form-grid">
                      <label>
                        Inscricao rural
                        <input
                          value={sellerProfileForm.ruralRegistration}
                          onChange={(event) =>
                            updateSellerProfileField(
                              'ruralRegistration',
                              event.target.value,
                            )
                          }
                          placeholder="Registro do produtor"
                        />
                      </label>

                      <label>
                        Inscricao estadual
                        <input
                          value={sellerProfileForm.stateRegistration}
                          onChange={(event) =>
                            updateSellerProfileField(
                              'stateRegistration',
                              event.target.value,
                            )
                          }
                          placeholder="IE"
                        />
                      </label>
                    </div>

                    <div className="form-grid three">
                      <label>
                        Cidade
                        <input
                          value={sellerProfileForm.city}
                          onChange={(event) =>
                            updateSellerProfileField('city', event.target.value)
                          }
                          placeholder="Campo Grande"
                        />
                      </label>

                      <label>
                        Estado
                        <input
                          maxLength={2}
                          value={sellerProfileForm.state}
                          onChange={(event) =>
                            updateSellerProfileField(
                              'state',
                              event.target.value.toUpperCase(),
                            )
                          }
                          placeholder="MS"
                        />
                      </label>

                      <label>
                        Pais
                        <input
                          value={sellerProfileForm.country}
                          onChange={(event) =>
                            updateSellerProfileField('country', event.target.value)
                          }
                          placeholder="BR"
                        />
                      </label>
                    </div>
                  </div>
                )}
              </>
            )}

            {authMode === 'login' && (
              <p className="helper-message">
                Escritorios usam as credenciais institucionais criadas pelo sistema.
              </p>
            )}

            {error && <p className="form-error">{error}</p>}

            <button className="primary-action" disabled={isSubmitting} type="submit">
              {isSubmitting
                ? 'Processando...'
                : authMode === 'register'
                  ? 'Criar conta e entrar'
                  : 'Entrar'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setView('home')}>
          <span className="brand-mark">CA</span>
          <span>Cattle Auction</span>
        </button>

        <nav className="nav-actions" aria-label="Navegacao principal">
          {!currentAuctionHouse && canRequestLot && (
            <button
              className={view === 'registerLot' ? 'nav-link active' : 'nav-link'}
              type="button"
              onClick={() => setView('registerLot')}
            >
              Solicitar lote
            </button>
          )}
          {currentAuctionHouse && (
            <button
              className={view === 'createAuction' ? 'nav-link active' : 'nav-link'}
              type="button"
              onClick={() => setView('createAuction')}
            >
              Criar remate
            </button>
          )}
          {canCompleteSellerProfile && (
            <button
              className={view === 'sellerProfile' ? 'nav-link active' : 'nav-link'}
              type="button"
              onClick={() => setView('sellerProfile')}
            >
              Cadastro produtor
            </button>
          )}
          <button
            className={view === 'home' ? 'nav-link active' : 'nav-link'}
            type="button"
            onClick={() => setView('home')}
          >
            Remates
          </button>
          <button className="nav-link" type="button" onClick={handleLogout}>
            Sair
          </button>
        </nav>
      </header>

      {view === 'auctionRoom' ? (
        <section className="auction-room">
          <div className="video-column">
            <button className="text-action" type="button" onClick={() => setView('home')}>
              Voltar aos remates
            </button>

            <div className="auction-player">
              <div className="player-status">
                <span className="live-dot"></span>
                <strong>{selectedAuction?.status || 'DRAFT'}</strong>
              </div>
              <div className="player-center">
                <span className="play-button large">Play</span>
              </div>
              <div className="player-footer">
                <span>{selectedAuction?.mode || 'LIVE'}</span>
                <span>{selectedAuctionLots.length} lotes</span>
              </div>
            </div>

            <div className="auction-room-header">
              <div>
                <span className="eyebrow">Sala do remate</span>
                <h1>{selectedAuction?.title || 'Remate'}</h1>
                {selectedAuction?.description && <p>{selectedAuction.description}</p>}
              </div>
              <button
                className="secondary-action"
                type="button"
                onClick={() => setView('createAuction')}
              >
                Novo remate
              </button>
            </div>

            <div className="auction-lot-list">
              <div className="section-title-row">
                <h2>Lotes do remate</h2>
                <span>{selectedAuctionLots.length}</span>
              </div>

              {selectedAuctionLots.length === 0 ? (
                <p className="loading-message">Nenhum lote adicionado neste remate.</p>
              ) : (
                <div className="room-lots">
                  {selectedAuctionLots.map((lot) => (
                    <article
                      className={lot.id === createdLotId ? 'room-lot highlighted' : 'room-lot'}
                      key={lot.id}
                    >
                      <strong>{lot.code}</strong>
                      <div>
                        <h3>{lot.title}</h3>
                        <span>{formatCurrency(lot.initialPrice)}</span>
                      </div>
                      <small>{lot.status}</small>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>

          <aside className="room-side-panel">
            <div className="form-header compact">
              <h2>Adicionar lote</h2>
            </div>

            <form className="room-lot-form" onSubmit={handleLotSubmit}>
              <label>
                Codigo
                <input
                  required
                  value={lotForm.code}
                  onChange={(event) => updateLotField('code', event.target.value)}
                  placeholder="LOTE-001"
                />
              </label>

              <label>
                Titulo
                <input
                  required
                  value={lotForm.title}
                  onChange={(event) => updateLotField('title', event.target.value)}
                  placeholder="Nelore PO - lote jovem"
                />
              </label>

              <div className="form-grid">
                <label>
                  Raca
                  <input
                    value={lotForm.breed}
                    onChange={(event) => updateLotField('breed', event.target.value)}
                    placeholder="Nelore"
                  />
                </label>

                <label>
                  Categoria
                  <input
                    value={lotForm.category}
                    onChange={(event) => updateLotField('category', event.target.value)}
                    placeholder="Corte"
                  />
                </label>
              </div>

              <div className="form-grid">
                <label>
                  Quantidade
                  <input
                    min="1"
                    type="number"
                    value={lotForm.quantity}
                    onChange={(event) => updateLotField('quantity', event.target.value)}
                  />
                </label>

                <label>
                  Valor inicial
                  <input
                    min="0"
                    type="number"
                    value={lotForm.initialPrice}
                    onChange={(event) => updateLotField('initialPrice', event.target.value)}
                    placeholder="15000"
                  />
                </label>
              </div>

              <label>
                Descricao
                <textarea
                  value={lotForm.description}
                  onChange={(event) => updateLotField('description', event.target.value)}
                  placeholder="Descricao do lote."
                />
              </label>

              {error && <p className="form-error">{error}</p>}
              {createdLotId && (
                <p className="success-message">Lote adicionado ao remate.</p>
              )}

              <button
                className="primary-action"
                disabled={isSubmitting || !selectedAuction}
                type="submit"
              >
                {isSubmitting ? 'Adicionando...' : 'Adicionar lote'}
              </button>
            </form>
          </aside>
        </section>
      ) : view === 'createAuction' ? (
        <section className="register-page">
          <div className="register-copy">
            <span className="eyebrow">Remate do escritorio</span>
            <h1>Crie ou agende um remate e adicione os lotes.</h1>
            <p>
              O remate fica vinculado ao escritorio logado. Depois de salvar, a
              tela abre direto no cadastro de lotes desse remate.
            </p>
          </div>

          <form className="lot-form" onSubmit={handleAuctionSubmit}>
            <div className="form-header">
              <h2>Novo remate</h2>
            </div>

            <label>
              Titulo
              <input
                required
                value={auctionForm.title}
                onChange={(event) => updateAuctionField('title', event.target.value)}
                placeholder="Remate Primavera 2026"
              />
            </label>

            <label>
              Data e hora
              <input
                type="datetime-local"
                value={auctionForm.scheduledAt}
                onChange={(event) => updateAuctionField('scheduledAt', event.target.value)}
              />
            </label>

            <label>
              Modalidade
              <select
                value={auctionForm.mode}
                onChange={(event) => updateAuctionField('mode', event.target.value)}
              >
                <option value="LIVE">Ao vivo</option>
                <option value="PRE_BID">Pre-lance</option>
                <option value="TIMED">Temporizado</option>
                <option value="HYBRID">Hibrido</option>
              </select>
            </label>

            <label>
              Descricao
              <textarea
                value={auctionForm.description}
                onChange={(event) => updateAuctionField('description', event.target.value)}
                placeholder="Conjunto de lotes, condicoes comerciais e detalhes do evento."
              />
            </label>

            {error && <p className="form-error">{error}</p>}

            <button className="primary-action" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Salvando...' : 'Criar remate e adicionar lotes'}
            </button>
          </form>
        </section>
      ) : view === 'sellerProfile' ? (
        <section className="register-page">
          <div className="register-copy">
            <span className="eyebrow">Cadastro de produtor</span>
            <h1>Complete seus dados para solicitar lotes em remates.</h1>
            <p>
              O cadastro inicial continua sendo uma conta comum. Estes dados rurais
              habilitam o envio de lotes para analise do escritorio responsavel.
            </p>
          </div>

          <form className="lot-form" onSubmit={handleSellerProfileSubmit}>
            <div className="form-header">
              <h2>Dados do produtor</h2>
            </div>

            <label>
              Nome da fazenda
              <input
                value={sellerProfileForm.farmName}
                onChange={(event) => updateSellerProfileField('farmName', event.target.value)}
                placeholder="Fazenda Santa Maria"
              />
            </label>

            <div className="form-grid">
              <label>
                Inscricao rural
                <input
                  value={sellerProfileForm.ruralRegistration}
                  onChange={(event) =>
                    updateSellerProfileField('ruralRegistration', event.target.value)
                  }
                  placeholder="Registro do produtor"
                />
              </label>

              <label>
                Inscricao estadual
                <input
                  value={sellerProfileForm.stateRegistration}
                  onChange={(event) =>
                    updateSellerProfileField('stateRegistration', event.target.value)
                  }
                  placeholder="IE"
                />
              </label>
            </div>

            <div className="form-grid three">
              <label>
                Cidade
                <input
                  value={sellerProfileForm.city}
                  onChange={(event) => updateSellerProfileField('city', event.target.value)}
                  placeholder="Campo Grande"
                />
              </label>

              <label>
                Estado
                <input
                  maxLength={2}
                  value={sellerProfileForm.state}
                  onChange={(event) =>
                    updateSellerProfileField('state', event.target.value.toUpperCase())
                  }
                  placeholder="MS"
                />
              </label>

              <label>
                Pais
                <input
                  value={sellerProfileForm.country}
                  onChange={(event) => updateSellerProfileField('country', event.target.value)}
                  placeholder="BR"
                />
              </label>
            </div>

            {error && <p className="form-error">{error}</p>}

            <button className="primary-action" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Salvando...' : 'Salvar e solicitar lote'}
            </button>
          </form>
        </section>
      ) : view === 'registerLot' ? (
        <section className="register-page">
          <div className="register-copy">
            <span className="eyebrow">
              {currentAuctionHouse ? 'Lote do remate' : 'Solicitacao de lote'}
            </span>
            <h1>
              {currentAuctionHouse
                ? 'Adicione lotes aos remates do escritorio.'
                : 'Associe o lote a um remate antes de enviar.'}
            </h1>
            <p>
              {currentAuctionHouse
                ? 'Escolha um remate criado pelo escritorio e cadastre os lotes que farao parte da oferta.'
                : 'O lote nao entra direto na vitrine. Ele fica em analise e precisa ser aprovado pelo escritorio responsavel pelo remate.'}
            </p>

            <div className="market-panel">
              <div className="market-image" aria-hidden="true">
                <span className="live-dot"></span>
                <strong>Em analise</strong>
              </div>
              <div>
                <strong>Regra de publicacao</strong>
                <span>Lote sempre vinculado a um remate e enviado para aprovacao.</span>
              </div>
            </div>
          </div>

          <form className="lot-form" onSubmit={handleLotSubmit}>
            <div className="form-header">
              <h2>{currentAuctionHouse ? 'Adicionar lote' : 'Novo lote'}</h2>
            </div>

            {selectableAuctions.length === 0 ? (
              <p className="form-error">
                {currentAuctionHouse
                  ? 'Crie um remate antes de adicionar lotes.'
                  : 'Nenhum remate disponivel para associar. Selecione um remate antes de solicitar um lote.'}
              </p>
            ) : (
              <label>
                Remate
                <select
                  required
                  value={selectedLotAuctionId}
                  onChange={(event) => updateLotField('auctionId', event.target.value)}
                >
                  {selectableAuctions.map((auction) => (
                    <option key={auction.id} value={auction.id}>
                      {auction.title}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>
              Codigo do lote
              <input
                required
                value={lotForm.code}
                onChange={(event) => updateLotField('code', event.target.value)}
                placeholder="LOTE-001"
              />
            </label>

            <label>
              Titulo
              <input
                required
                value={lotForm.title}
                onChange={(event) => updateLotField('title', event.target.value)}
                placeholder="Nelore PO - lote jovem"
              />
            </label>

            <div className="form-grid">
              <label>
                Raca
                <input
                  value={lotForm.breed}
                  onChange={(event) => updateLotField('breed', event.target.value)}
                  placeholder="Nelore"
                />
              </label>

              <label>
                Categoria
                <input
                  value={lotForm.category}
                  onChange={(event) => updateLotField('category', event.target.value)}
                  placeholder="Corte"
                />
              </label>
            </div>

            <div className="form-grid three">
              <label>
                Quantidade
                <input
                  min="1"
                  type="number"
                  value={lotForm.quantity}
                  onChange={(event) => updateLotField('quantity', event.target.value)}
                />
              </label>

              <label>
                Peso kg
                <input
                  min="0"
                  type="number"
                  value={lotForm.weightKg}
                  onChange={(event) => updateLotField('weightKg', event.target.value)}
                  placeholder="420"
                />
              </label>

              <label>
                Idade meses
                <input
                  min="0"
                  type="number"
                  value={lotForm.ageMonths}
                  onChange={(event) => updateLotField('ageMonths', event.target.value)}
                  placeholder="24"
                />
              </label>
            </div>

            <div className="form-grid">
              <label>
                Sexo
                <select
                  value={lotForm.sex}
                  onChange={(event) => updateLotField('sex', event.target.value)}
                >
                  <option value="">Nao informado</option>
                  <option value="Macho">Macho</option>
                  <option value="Femea">Femea</option>
                  <option value="Misto">Misto</option>
                </select>
              </label>

              <label>
                Valor inicial
                <input
                  min="0"
                  type="number"
                  value={lotForm.initialPrice}
                  onChange={(event) => updateLotField('initialPrice', event.target.value)}
                  placeholder="15000"
                />
              </label>
            </div>

            <label>
              Descricao
              <textarea
                value={lotForm.description}
                onChange={(event) => updateLotField('description', event.target.value)}
                placeholder="Lote com animais jovens, bom padrao racial e documentacao em dia."
              />
            </label>

            {error && <p className="form-error">{error}</p>}

            <button
              className="primary-action"
              disabled={isSubmitting || selectableAuctions.length === 0}
              type="submit"
            >
              {isSubmitting
                ? 'Enviando...'
                : currentAuctionHouse
                  ? 'Adicionar lote ao remate'
                  : 'Enviar para aprovacao'}
            </button>
          </form>
        </section>
      ) : (
        <section className="home-page">
          <div className="home-heading">
            <div>
              <span className="eyebrow">Remates</span>
              <h1>{currentAuctionHouse ? 'Meus remates' : 'Remates e lotes disponiveis'}</h1>
            </div>
            {currentAuctionHouse ? (
              <button
                className="secondary-action"
                type="button"
                onClick={() => setView('createAuction')}
              >
                Criar remate
              </button>
            ) : (
              canRequestLot && (
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => setView('registerLot')}
                >
                  Solicitar lote
                </button>
              )
            )}
            {canCompleteSellerProfile && (
              <button
                className="secondary-action"
                type="button"
                onClick={() => setView('sellerProfile')}
              >
                Completar cadastro de produtor
              </button>
            )}
          </div>

          {createdUserName && (
            <p className="success-message">Bem-vindo, {createdUserName}.</p>
          )}
          {createdLotId && (
            <p className="success-message">
              {currentAuctionHouse
                ? 'Lote adicionado ao remate.'
                : 'Lote enviado para aprovacao do escritorio.'}
            </p>
          )}
          {createdAuctionId && (
            <p className="success-message">Remate criado e pronto para receber lotes.</p>
          )}

          {currentAuctionHouse ? (
            selectableAuctions.length === 0 ? (
              <p className="loading-message">Nenhum remate criado por este escritorio.</p>
            ) : (
              <div className="auction-grid">
                {selectableAuctions.map((auction) => {
                  const auctionLots = lots.filter(
                    (lot) => lot.auctionId === auction.id || lot.auction?.id === auction.id,
                  );

                  return (
                    <article
                      className={
                        auction.id === createdAuctionId
                          ? 'auction-card highlighted'
                          : 'auction-card'
                      }
                      key={auction.id}
                    >
                      <button
                        aria-label={`Entrar no remate ${auction.title}`}
                        className="auction-card-player"
                        type="button"
                        onClick={() => enterAuctionRoom(auction.id)}
                      >
                        <span className="live-dot"></span>
                        <span className="play-button">Play</span>
                      </button>
                      <div className="auction-card-body">
                        <span className="eyebrow">{auction.status}</span>
                        <h2>{auction.title}</h2>
                        <p>{auction.description || 'Remate cadastrado pelo escritorio.'}</p>
                        <dl className="lot-stats">
                          <div>
                            <dt>Lotes</dt>
                            <dd>{auctionLots.length}</dd>
                          </div>
                          <div>
                            <dt>Modo</dt>
                            <dd>{auction.mode}</dd>
                          </div>
                          <div>
                            <dt>Data</dt>
                            <dd className="date-value">
                              {auction.scheduledAt
                                ? new Date(auction.scheduledAt).toLocaleDateString('pt-BR')
                                : '-'}
                            </dd>
                          </div>
                        </dl>
                        <button
                          className="primary-action"
                          type="button"
                          onClick={() => enterAuctionRoom(auction.id)}
                        >
                          Entrar no remate
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          ) : isLoadingLots ? (
            <p className="loading-message">Carregando lotes...</p>
          ) : featuredLots.length === 0 ? (
            <p className="loading-message">Nenhum lote disponivel no momento.</p>
          ) : (
            <div className="live-grid">
              {featuredLots.map((lot, index) => (
                <article
                  className={lot.id === createdLotId ? 'live-card highlighted' : 'live-card'}
                  key={lot.id}
                >
                  <div className={`thumbnail tone-${index % 3}`}>
                    <div className="thumbnail-top">
                      <span>{index === 0 ? 'AO VIVO' : 'LOTE'}</span>
                      <strong>{lot.code}</strong>
                    </div>
                    <div className="thumbnail-stage">
                      <span className="arena-line"></span>
                      <span className="play-button">Play</span>
                    </div>
                  </div>

                  <div className="card-body">
                    <div className="card-title-row">
                      <h2>{lot.title}</h2>
                      <span>{formatCurrency(lot.initialPrice)}</span>
                    </div>
                    <p>{lot.description || 'Lote disponivel para acompanhamento online.'}</p>

                    <dl className="lot-stats">
                      <div>
                        <dt>Qtd.</dt>
                        <dd>{lot.quantity}</dd>
                      </div>
                      <div>
                        <dt>Peso</dt>
                        <dd>{lot.weightKg ? `${lot.weightKg} kg` : '-'}</dd>
                      </div>
                      <div>
                        <dt>Idade</dt>
                        <dd>{lot.ageMonths ? `${lot.ageMonths} m` : '-'}</dd>
                      </div>
                      <div>
                        <dt>Raca</dt>
                        <dd>{lot.breed || '-'}</dd>
                      </div>
                    </dl>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default App;
