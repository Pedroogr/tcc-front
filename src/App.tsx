import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import './App.css';
import { login, register } from './api/authApi';
import {
  createAuction,
  listAuctions,
  listPublicAuctions,
  uploadAuctionThumbnail,
} from './api/auctionsApi';
import { getAuctionStream } from './api/streamsApi';
import {
  getMyBuyerRegistration,
  listMyBuyerRegistrations,
  registerAuctionHouseWithInvite,
  requestAuctionHouseApproval,
  reviewBuyerRegistration,
  validateAuctionHouseInvite,
} from './api/auctionHousesApi';
import { apiUrl, authStorage } from './api/http';
import {
  createBid,
  createLot,
  listLots,
  listLotBidHistory,
  updateLot,
} from './api/lotsApi';
import { listAuctionHouseSales, listMySales, listMyWins } from './api/salesApi';
import { createCommerceSocket } from './api/socket';
import { upsertSellerProfile } from './api/usersApi';
import { AccountMenu } from './components/AccountMenu';
import { AuctionRoomPage } from './pages/AuctionRoomPage';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { AccountDetailsPage } from './pages/AccountDetailsPage';
import { CreateAuctionPage } from './pages/CreateAuctionPage';
import { MyWinsPage } from './pages/MyWinsPage';
import { MySalesPage } from './pages/MySalesPage';
import { OfficeInvitePage } from './pages/OfficeInvitePage';
import { RegisterLotPage } from './pages/RegisterLotPage';
import { SalesPage } from './pages/SalesPage';
import { SellerProfilePage } from './pages/SellerProfilePage';
import { Button } from './components/ui/button';
import type { Auction, AuctionStreamState } from './types/auction';
import type { CreateAuctionPayload } from './types/auction';
import type { CreateLotPayload, Lot, LotImagePayload, OfficeBid } from './types/lot';
import type {
  OfficeSale,
  SaleWonNotification,
  SellerSale,
  WinnerSale,
} from './types/sale';
import type {
  AuctionHouse,
  BuyerRegistration,
  CreateAuctionHouseInvitePayload,
  CreateSellerProfilePayload,
  CreateUserPayload,
  User,
  UserAccountType,
} from './types/user';
import {
  formatCnpj,
  formatCpf,
  formatCpfOrCnpj,
  formatPhone,
  generateValidCnpj,
  generateValidCpf,
  onlyDigits,
  validateCnpj,
  validateCpfOrCnpj,
  validatePhone,
} from './utils/brFields';
import { Plus, Radio } from 'lucide-react';

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

const emptyAuctionHouseInviteForm = {
  name: '',
  document: '',
  email: '',
  phone: '',
  password: '',
  city: '',
  state: '',
  country: 'BR',
};

type LotFormState = typeof emptyLotForm;
type AuctionFormState = typeof emptyAuctionForm;
type UserFormState = typeof emptyUserForm;
type SellerProfileFormState = typeof emptySellerProfileForm;
type AuctionHouseInviteFormState = typeof emptyAuctionHouseInviteForm;
type View =
  | 'home'
  | 'registerLot'
  | 'sellerProfile'
  | 'createAuction'
  | 'auctionRoom'
  | 'accountDetails'
  | 'sales'
  | 'myWins'
  | 'mySales';
type AuthMode = 'login' | 'register';
type AuctionStatusFilter = 'ALL' | 'LIVE' | 'SCHEDULED' | 'FINISHED';

type LotImageFormItem = LotImagePayload & {
  id: string;
};

type AuctionThumbnailFormState = {
  file: File;
  previewUrl: string;
};

const acceptedAuctionThumbnailTypes = ['image/jpeg', 'image/png', 'image/webp'];
const auctionThumbnailMaxSize = 5 * 1024 * 1024;

// Incremento sugerido de lance, padrao da plataforma (nao do escritorio).
const PLATFORM_BID_INCREMENT = 100;

// Passo das setas do campo de lance.
const BID_STEP = 5;

const showDevDocumentTools = import.meta.env.DEV;

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

function resolveMediaUrl(url: string) {
  if (/^https?:\/\//.test(url)) {
    return url;
  }

  return `${apiUrl}${url}`;
}

function getAuctionDisplayStatus(auction: Auction) {
  if (auction.stream?.status === 'LIVE') {
    return 'LIVE';
  }

  if (auction.stream?.status === 'ENDED') {
    return 'FINISHED';
  }

  if (auction.stream?.status === 'ERROR') {
    return 'STREAM_INTERRUPTED';
  }

  return auction.status;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function parseApiErrorMessage(error: unknown, fallback: string) {
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

function getStoredUser() {
  const storedUser = sessionStorage.getItem(authStorage.userKey);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as User;
  } catch {
    sessionStorage.removeItem(authStorage.userKey);
    sessionStorage.removeItem(authStorage.tokenKey);
    return null;
  }
}

function getStoredAuctionHouse() {
  const storedAuctionHouse = sessionStorage.getItem(authStorage.auctionHouseKey);

  if (!storedAuctionHouse) {
    return null;
  }

  try {
    return JSON.parse(storedAuctionHouse) as AuctionHouse;
  } catch {
    sessionStorage.removeItem(authStorage.auctionHouseKey);
    sessionStorage.removeItem(authStorage.tokenKey);
    sessionStorage.removeItem(authStorage.actorTypeKey);
    return null;
  }
}

function getOfficeInviteTokenFromPath() {
  const match = window.location.pathname.match(
    /^\/(?:cadastro-escritorio|office-register)\/([^/]+)\/?$/,
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function persistUserAuth(accessToken: string, user: User) {
  sessionStorage.setItem(authStorage.tokenKey, accessToken);
  sessionStorage.setItem(authStorage.actorTypeKey, 'USER');
  sessionStorage.setItem(authStorage.userKey, JSON.stringify(user));
  sessionStorage.removeItem(authStorage.auctionHouseKey);
}

function persistAuctionHouseAuth(accessToken: string, auctionHouse: AuctionHouse) {
  sessionStorage.setItem(authStorage.tokenKey, accessToken);
  sessionStorage.setItem(authStorage.actorTypeKey, 'AUCTION_HOUSE');
  sessionStorage.setItem(authStorage.auctionHouseKey, JSON.stringify(auctionHouse));
  sessionStorage.removeItem(authStorage.userKey);
}

function getLotStageMessage(status: string, consignmentId?: string | null) {
  if (status === 'IN_AUCTION') {
    return 'Este lote está em pista e recebendo lances.';
  }
  if (status === 'AVAILABLE') {
    return 'Lote liberado, aguardando ser colocado em pista.';
  }
  // UNDER_REVIEW only means "awaiting confirmation" when the lot came from a
  // seller's consignment. A lot the auction house registered itself is
  // already approved, even if its stored status still says UNDER_REVIEW.
  if (status === 'UNDER_REVIEW' && consignmentId) {
    return 'Lote enviado por um vendedor, aguardando sua confirmação.';
  }
  return 'Lote pronto para ser liberado.';
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    Boolean(sessionStorage.getItem(authStorage.tokenKey)),
  );
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const [view, setView] = useState<View>('home');
  const [lots, setLots] = useState<Lot[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [lotForm, setLotForm] = useState<LotFormState>(emptyLotForm);
  const [lotImages, setLotImages] = useState<LotImageFormItem[]>([]);
  const [detailLotImages, setDetailLotImages] = useState<LotImageFormItem[]>([]);
  const [auctionForm, setAuctionForm] = useState<AuctionFormState>(emptyAuctionForm);
  const [auctionThumbnail, setAuctionThumbnail] =
    useState<AuctionThumbnailFormState | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm);
  const [auctionHouseInviteForm, setAuctionHouseInviteForm] =
    useState<AuctionHouseInviteFormState>(emptyAuctionHouseInviteForm);
  const [officeInviteToken, setOfficeInviteToken] = useState(() =>
    getOfficeInviteTokenFromPath(),
  );
  const [isValidatingOfficeInvite, setIsValidatingOfficeInvite] = useState(() =>
    Boolean(getOfficeInviteTokenFromPath()),
  );
  const [officeInviteStatus, setOfficeInviteStatus] = useState<
    'idle' | 'valid' | 'invalid'
  >('idle');
  const [isOfficeInviteEmailLocked, setIsOfficeInviteEmailLocked] = useState(false);
  const [accountType, setAccountType] = useState<UserAccountType>('BUYER');
  const [sellerProfileForm, setSellerProfileForm] = useState<SellerProfileFormState>(
    emptySellerProfileForm,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingLots, setIsLoadingLots] = useState(false);
  const [isLoadingAuctions, setIsLoadingAuctions] = useState(false);
  const [auctionStatusFilter, setAuctionStatusFilter] =
    useState<AuctionStatusFilter>('ALL');
  const [error, setError] = useState('');
  const [createdLotId, setCreatedLotId] = useState<string | null>(null);
  const [createdAuctionId, setCreatedAuctionId] = useState<string | null>(null);
  const [createdUserName, setCreatedUserName] = useState<string | null>(null);
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  const [selectedStreamState, setSelectedStreamState] =
    useState<AuctionStreamState | null>(null);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState('');
  const [myRegistration, setMyRegistration] = useState<BuyerRegistration | null | undefined>(
    undefined,
  );
  const [buyerRegistrations, setBuyerRegistrations] = useState<BuyerRegistration[]>([]);
  const [isLoadingBuyerRegistrations, setIsLoadingBuyerRegistrations] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser());
  const [currentAuctionHouse, setCurrentAuctionHouse] = useState<AuctionHouse | null>(() =>
    getStoredAuctionHouse(),
  );
  const [auctionHouseSales, setAuctionHouseSales] = useState<OfficeSale[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(false);
  const [salesError, setSalesError] = useState('');
  const [myWins, setMyWins] = useState<WinnerSale[]>([]);
  const [isLoadingMyWins, setIsLoadingMyWins] = useState(false);
  const [myWinsError, setMyWinsError] = useState('');
  const [mySales, setMySales] = useState<SellerSale[]>([]);
  const [isLoadingMySales, setIsLoadingMySales] = useState(false);
  const [mySalesError, setMySalesError] = useState('');
  const [winToast, setWinToast] = useState<SaleWonNotification | null>(null);
  // Historico nominal, so carregado e exibido para o escritorio dono (RF07).
  const [officeBidHistory, setOfficeBidHistory] = useState<OfficeBid[]>([]);

  const isAuctionOwnedByCurrentOffice = useCallback(
    (auction: Auction) =>
      Boolean(
        currentAuctionHouse &&
          (auction.auctionHouseId === currentAuctionHouse.id ||
            auction.auctionHouse?.id === currentAuctionHouse.id),
      ),
    [currentAuctionHouse],
  );

  const publicAuctions = useMemo(() => {
    return auctions.filter((auction) => !['DRAFT', 'CANCELED'].includes(auction.status));
  }, [auctions]);

  const visibleAuctions = useMemo(() => {
    if (!currentAuctionHouse) {
      return publicAuctions;
    }

    return auctions.filter(
      (auction) =>
        isAuctionOwnedByCurrentOffice(auction) ||
        !['DRAFT', 'CANCELED'].includes(auction.status),
    );
  }, [auctions, currentAuctionHouse, isAuctionOwnedByCurrentOffice, publicAuctions]);

  const filteredVisibleAuctions = useMemo(() => {
    if (auctionStatusFilter === 'ALL') {
      return visibleAuctions;
    }

    return visibleAuctions.filter(
      (auction) => getAuctionDisplayStatus(auction) === auctionStatusFilter,
    );
  }, [auctionStatusFilter, visibleAuctions]);

  const selectableAuctions = useMemo(() => {
    if (!currentAuctionHouse) {
      return publicAuctions;
    }

    return auctions.filter((auction) => isAuctionOwnedByCurrentOffice(auction));
  }, [auctions, currentAuctionHouse, isAuctionOwnedByCurrentOffice, publicAuctions]);

  const selectedAuction = useMemo(() => {
    return auctions.find((auction) => auction.id === selectedAuctionId) ?? null;
  }, [auctions, selectedAuctionId]);

  const selectedAuctionStreamState = useMemo(() => {
    return selectedStreamState?.auctionId === selectedAuctionId ? selectedStreamState : null;
  }, [selectedAuctionId, selectedStreamState]);

  const canManageSelectedAuction = Boolean(
    selectedAuction && currentAuctionHouse && isAuctionOwnedByCurrentOffice(selectedAuction),
  );

  const selectedAuctionLots = useMemo(() => {
    if (!selectedAuctionId) {
      return [];
    }

    return lots.filter(
      (lot) => lot.auctionId === selectedAuctionId || lot.auction?.id === selectedAuctionId,
    );
  }, [lots, selectedAuctionId]);

  const selectedLot = useMemo(() => {
    return selectedAuctionLots.find((lot) => lot.id === selectedLotId) ?? null;
  }, [selectedAuctionLots, selectedLotId]);

  const selectedAuctionHouseId =
    selectedAuction?.auctionHouseId || selectedAuction?.auctionHouse?.id || null;

  const inPistaLot = useMemo(
    () => selectedAuctionLots.find((lot) => lot.status === 'IN_AUCTION') ?? null,
    [selectedAuctionLots],
  );

  // Lance vencedor com identidade, derivado somente do historico do escritorio.
  // Compradores nunca alimentam esta lista, logo nunca veem o autor do lance.
  const officeWinningBid = useMemo(
    () => officeBidHistory.find((bid) => bid.status === 'WINNING') ?? null,
    [officeBidHistory],
  );

  const inPistaLotIdRef = useRef<string | null>(null);
  useEffect(() => {
    inPistaLotIdRef.current = inPistaLot?.id ?? null;
  }, [inPistaLot?.id]);

  const syncSelectedStreamState = useCallback((streamState: AuctionStreamState) => {
    setSelectedStreamState(streamState);
    setAuctions((currentAuctions) =>
      currentAuctions.map((auction) =>
        auction.id === streamState.auctionId
          ? {
              ...auction,
              auctionHouseId: streamState.auction.auctionHouseId,
              status: streamState.auction.status,
              stream: streamState.stream,
            }
          : auction,
      ),
    );
  }, []);

  useEffect(() => {
    if (!officeInviteToken) {
      return;
    }

    let isCanceled = false;

    queueMicrotask(() => {
      if (isCanceled) {
        return;
      }

      setIsValidatingOfficeInvite(true);
      setOfficeInviteStatus('idle');
      setError('');

      validateAuctionHouseInvite(officeInviteToken)
        .then((invite) => {
          if (isCanceled) {
            return;
          }

          setAuctionHouseInviteForm((current) => ({
            ...current,
            email: invite.email ?? '',
          }));
          setIsOfficeInviteEmailLocked(Boolean(invite.email));
          setOfficeInviteStatus('valid');
        })
        .catch(() => {
          if (!isCanceled) {
            setOfficeInviteStatus('invalid');
          }
        })
        .finally(() => {
          if (!isCanceled) {
            setIsValidatingOfficeInvite(false);
          }
        });
    });

    return () => {
      isCanceled = true;
    };
  }, [officeInviteToken]);

  function getAuctionLotCount(auction: Auction) {
    const loadedLots = lots.filter(
      (lot) => lot.auctionId === auction.id || lot.auction?.id === auction.id,
    );

    return loadedLots.length || auction.lots?.length || auction._count?.lots || 0;
  }

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

  async function refreshLotsQuietly() {
    try {
      setLots(await listLots());
    } catch {
      // mantem a ultima lista carregada se a atualizacao silenciosa falhar
    }
  }

  const loadAuctionHouseSales = useCallback(async () => {
    setIsLoadingSales(true);
    setSalesError('');

    try {
      setAuctionHouseSales(await listAuctionHouseSales());
    } catch {
      setAuctionHouseSales([]);
      setSalesError('Não foi possível carregar as vendas agora.');
    } finally {
      setIsLoadingSales(false);
    }
  }, []);

  const loadMyWins = useCallback(async () => {
    setIsLoadingMyWins(true);
    setMyWinsError('');

    try {
      setMyWins(await listMyWins());
    } catch {
      setMyWins([]);
      setMyWinsError('Não foi possível carregar seus arremates agora.');
    } finally {
      setIsLoadingMyWins(false);
    }
  }, []);

  const loadMySales = useCallback(async () => {
    setIsLoadingMySales(true);
    setMySalesError('');

    try {
      setMySales(await listMySales());
    } catch {
      setMySales([]);
      setMySalesError('Não foi possível carregar suas vendas agora.');
    } finally {
      setIsLoadingMySales(false);
    }
  }, []);

  // Cliente unico de eventos comerciais enquanto a sala esta aberta (RF06/RF09):
  // atualiza o preco anonimo para todos, alimenta o historico so do escritorio
  // dono e entrega a notificacao privada de vitoria apenas ao comprador.
  useEffect(() => {
    if (view !== 'auctionRoom' || !selectedAuctionId || !isAuthenticated) {
      return;
    }

    const auctionId = selectedAuctionId;
    const isOfficeOwner = canManageSelectedAuction;
    const isBuyer = Boolean(currentUser) && !currentAuctionHouse;
    const socket = createCommerceSocket();

    socket.on('connect', () => {
      socket.emit('auction:join', { auctionId });

      if (isBuyer) {
        socket.emit('notifications:join');
      }

      void refreshLotsQuietly();

      // Sincroniza o historico do escritorio ao (re)conectar.
      if (isOfficeOwner && inPistaLotIdRef.current) {
        void listLotBidHistory(inPistaLotIdRef.current)
          .then(setOfficeBidHistory)
          .catch(() => setOfficeBidHistory([]));
      }
    });

    socket.on('bid:price-updated', (payload) => {
      setLots((current) =>
        current.map((lot) =>
          lot.id === payload.lotId ? { ...lot, currentPrice: payload.amount } : lot,
        ),
      );
    });

    if (isOfficeOwner) {
      socket.on('bid:office-recorded', (payload) => {
        setOfficeBidHistory((current) => [
          {
            id: payload.bidId,
            lotId: payload.lotId,
            amount: payload.amount,
            status: 'WINNING',
            createdAt: payload.createdAt,
            bidder: payload.bidder,
          },
          ...current.map((bid) =>
            bid.status === 'WINNING' && bid.lotId === payload.lotId
              ? { ...bid, status: 'OUTBID' }
              : bid,
          ),
        ]);
      });
    }

    socket.on('lot:sold', (payload) => {
      setLots((current) =>
        current.map((lot) =>
          lot.id === payload.lotId
            ? { ...lot, status: 'SOLD', currentPrice: payload.finalPrice }
            : lot,
        ),
      );
    });

    if (isBuyer) {
      socket.on('sale:won', (payload) => {
        setWinToast(payload);
        void loadMyWins();
        void refreshLotsQuietly();
      });
    }

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [
    view,
    selectedAuctionId,
    isAuthenticated,
    currentUser,
    currentAuctionHouse,
    canManageSelectedAuction,
    loadMyWins,
  ]);

  // Escritorio dono: carrega o historico nominal do lote em pista e o recarrega
  // quando o lote em pista muda. Compradores nunca disparam esta busca.
  useEffect(() => {
    let isCanceled = false;

    if (view !== 'auctionRoom' || !canManageSelectedAuction || !inPistaLot?.id) {
      queueMicrotask(() => {
        if (!isCanceled) {
          setOfficeBidHistory([]);
        }
      });
      return () => {
        isCanceled = true;
      };
    }

    const lotId = inPistaLot.id;

    listLotBidHistory(lotId)
      .then((history) => {
        if (!isCanceled) {
          setOfficeBidHistory(history);
        }
      })
      .catch(() => {
        if (!isCanceled) {
          setOfficeBidHistory([]);
        }
      });

    return () => {
      isCanceled = true;
    };
  }, [view, canManageSelectedAuction, inPistaLot?.id]);

  const loadAuctions = useCallback(async (includePrivateAuctions = Boolean(currentAuctionHouse)) => {
    setIsLoadingAuctions(true);

    try {
      const data = await (includePrivateAuctions ? listAuctions() : listPublicAuctions());
      setAuctions(data);
      setLotForm((current) => ({
        ...current,
        auctionId: current.auctionId || data[0]?.id || '',
      }));
    } catch {
      setAuctions([]);
    } finally {
      setIsLoadingAuctions(false);
    }
  }, [currentAuctionHouse]);

  const loadBuyerRegistrations = useCallback(async () => {
    if (!currentAuctionHouse) {
      return;
    }

    setIsLoadingBuyerRegistrations(true);

    try {
      setBuyerRegistrations(await listMyBuyerRegistrations());
    } catch {
      setBuyerRegistrations([]);
    } finally {
      setIsLoadingBuyerRegistrations(false);
    }
  }, [currentAuctionHouse]);

  useEffect(() => {
    queueMicrotask(() => {
      void loadAuctions(Boolean(currentAuctionHouse));
    });
  }, [currentAuctionHouse, loadAuctions]);

  useEffect(() => {
    if (view !== 'auctionRoom' || !selectedAuctionId || !isAuthenticated) {
      return;
    }

    let isCanceled = false;

    getAuctionStream(selectedAuctionId)
      .then((streamState) => {
        if (!isCanceled) {
          syncSelectedStreamState(streamState);
        }
      })
      .catch(() => {
        if (!isCanceled) {
          setSelectedStreamState(null);
        }
      });

    return () => {
      isCanceled = true;
    };
  }, [isAuthenticated, selectedAuctionId, syncSelectedStreamState, view]);

  // Escritorio: carrega e atualiza as solicitacoes de comprador sem precisar
  // dar refresh (o que antes interrompia a transmissao).
  useEffect(() => {
    if (view !== 'auctionRoom' || !canManageSelectedAuction) {
      return;
    }

    let isCanceled = false;
    queueMicrotask(() => {
      if (!isCanceled) {
        void loadBuyerRegistrations();
      }
    });
    const interval = setInterval(() => {
      void loadBuyerRegistrations();
    }, 5000);

    return () => {
      isCanceled = true;
      clearInterval(interval);
    };
  }, [view, canManageSelectedAuction, loadBuyerRegistrations]);

  // Comprador: a liberacao e por escritorio (vale para todos os remates dele),
  // entao buscamos ao entrar na sala e mantemos atualizado por polling.
  useEffect(() => {
    let isCanceled = false;

    if (
      view !== 'auctionRoom' ||
      !currentUser ||
      currentAuctionHouse ||
      !selectedAuctionHouseId
    ) {
      queueMicrotask(() => {
        if (!isCanceled) {
          setMyRegistration(undefined);
        }
      });
      return () => {
        isCanceled = true;
      };
    }

    const auctionHouseId = selectedAuctionHouseId;

    const fetchRegistration = () => {
      getMyBuyerRegistration(auctionHouseId)
        .then((registration) => {
          if (!isCanceled) {
            setMyRegistration(registration);
          }
        })
        .catch(() => {
          if (!isCanceled) {
            setMyRegistration(null);
          }
        });
    };

    fetchRegistration();
    const interval = setInterval(fetchRegistration, 5000);

    return () => {
      isCanceled = true;
      clearInterval(interval);
    };
  }, [view, currentUser, currentAuctionHouse, selectedAuctionHouseId]);

  // Pre-preenche o campo de lance com o proximo valor sugerido (incremento
  // padrao da plataforma) quando o lote em pista muda.
  useEffect(() => {
    if (!inPistaLot) {
      return;
    }

    const currentPrice = inPistaLot.currentPrice ?? inPistaLot.initialPrice ?? 0;
    const suggested = Number(currentPrice) + PLATFORM_BID_INCREMENT;

    let isCanceled = false;
    queueMicrotask(() => {
      if (!isCanceled) {
        setBidAmount(String(suggested));
      }
    });

    return () => {
      isCanceled = true;
    };
    // O valor digitado nao pode ser sobrescrito a cada refresh do mesmo lote.
    // A sugestao so deve mudar quando a identidade do lote em pista mudar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inPistaLot?.id]);

  useEffect(() => {
    return () => {
      if (auctionThumbnail) {
        URL.revokeObjectURL(auctionThumbnail.previewUrl);
      }
    };
  }, [auctionThumbnail]);

  function updateLotField(field: keyof LotFormState, value: string) {
    setLotForm((current) => ({ ...current, [field]: value }));
  }

  async function filesToLotImages(files: File[]) {
    return Promise.all(
      files.map(async (file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        fileName: file.name,
        dataUrl: await readFileAsDataUrl(file),
      })),
    );
  }

  async function handleLotImageChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    try {
      const images = await filesToLotImages(files);
      setLotImages((current) => [...current, ...images]);
      event.target.value = '';
    } catch {
      setError('Nao foi possivel carregar as imagens selecionadas.');
    }
  }

  function removeLotImage(imageId: string) {
    setLotImages((current) => current.filter((image) => image.id !== imageId));
  }

  async function handleDetailLotImageChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    try {
      const images = await filesToLotImages(files);
      setDetailLotImages((current) => [...current, ...images]);
      event.target.value = '';
    } catch {
      setError('Nao foi possivel carregar as imagens selecionadas.');
    }
  }

  function removeDetailLotImage(imageId: string) {
    setDetailLotImages((current) => current.filter((image) => image.id !== imageId));
  }

  async function saveDetailLotImages() {
    if (!selectedLot || detailLotImages.length === 0) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await updateLot(selectedLot.id, {
        images: detailLotImages.map(({ fileName, dataUrl, description }) => ({
          fileName,
          dataUrl,
          description,
        })),
      });
      setDetailLotImages([]);
      await loadLots();
    } catch {
      setError('Nao foi possivel salvar as imagens do lote.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSetLotStage(nextStatus: string) {
    if (!selectedLot) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await updateLot(selectedLot.id, { status: nextStatus });
      await loadLots();
    } catch {
      setError('Nao foi possivel atualizar o status do lote.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRequestApproval() {
    if (!selectedAuctionHouseId) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      setMyRegistration(await requestAuctionHouseApproval(selectedAuctionHouseId));
    } catch (submitError) {
      setError(parseApiErrorMessage(submitError, 'Nao foi possivel solicitar a liberacao.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  function stepBid(delta: number) {
    setBidAmount((current) => {
      const base = Number(current) || 0;
      const next = Math.max(0, base + delta);
      return String(next);
    });
  }

  async function handleSubmitBid(event: FormEvent) {
    event.preventDefault();

    if (!inPistaLot) {
      return;
    }

    const amount = Number(bidAmount);

    if (!bidAmount.trim() || Number.isNaN(amount)) {
      setError('Informe um valor de lance valido.');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const bid = await createBid(inPistaLot.id, amount);
      // Resposta segura (sem historico): atualiza so o proprio preco atual. Os
      // demais participantes recebem a atualizacao pelo socket.
      setLots((current) =>
        current.map((lot) =>
          lot.id === bid.lotId ? { ...lot, currentPrice: bid.amount } : lot,
        ),
      );
    } catch (submitError) {
      setError(parseApiErrorMessage(submitError, 'Nao foi possivel registrar o lance.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReviewRegistration(
    registrationId: string,
    status: 'APPROVED' | 'REJECTED',
  ) {
    try {
      await reviewBuyerRegistration(registrationId, status);
      await loadBuyerRegistrations();
    } catch {
      setError('Nao foi possivel atualizar a solicitacao do comprador.');
    }
  }

  function updateAuctionField(field: keyof AuctionFormState, value: string) {
    setAuctionForm((current) => ({ ...current, [field]: value }));
  }

  function clearAuctionThumbnail() {
    setAuctionThumbnail((current) => {
      if (current) {
        URL.revokeObjectURL(current.previewUrl);
      }

      return null;
    });
  }

  function handleAuctionThumbnailChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (!acceptedAuctionThumbnailTypes.includes(file.type)) {
      setError('Imagem inválida. Envie JPG, PNG ou WEBP.');
      return;
    }

    if (file.size > auctionThumbnailMaxSize) {
      setError('A imagem de capa deve ter no máximo 5 MB.');
      return;
    }

    setError('');
    setAuctionThumbnail((current) => {
      if (current) {
        URL.revokeObjectURL(current.previewUrl);
      }

      return {
        file,
        previewUrl: URL.createObjectURL(file),
      };
    });
  }

  function updateUserField(field: keyof UserFormState, value: string) {
    setUserForm((current) => ({ ...current, [field]: value }));
  }

  function updateUserPhone(value: string) {
    setUserForm((current) => ({ ...current, phone: formatPhone(value) }));
  }

  function updateUserDocument(value: string) {
    setUserForm((current) => ({ ...current, document: formatCpfOrCnpj(value) }));
  }

  function fillDevUserCpf() {
    setUserForm((current) => ({
      ...current,
      document: formatCpf(generateValidCpf()),
    }));
  }

  function updateAuctionHouseInviteField(
    field: keyof AuctionHouseInviteFormState,
    value: string,
  ) {
    setAuctionHouseInviteForm((current) => ({ ...current, [field]: value }));
  }

  function updateAuctionHouseInvitePhone(value: string) {
    setAuctionHouseInviteForm((current) => ({
      ...current,
      phone: formatPhone(value),
    }));
  }

  function updateAuctionHouseInviteDocument(value: string) {
    setAuctionHouseInviteForm((current) => ({
      ...current,
      document: formatCnpj(value),
    }));
  }

  function fillDevAuctionHouseCnpj() {
    setAuctionHouseInviteForm((current) => ({
      ...current,
      document: formatCnpj(generateValidCnpj()),
    }));
  }

  function updateSellerProfileField(field: keyof SellerProfileFormState, value: string) {
    setSellerProfileForm((current) => ({ ...current, [field]: value }));
  }

  function enterAuctionRoom(auctionId: string) {
    setSelectedAuctionId(auctionId);
    setSelectedStreamState(null);
    setLotForm({ ...emptyLotForm, auctionId });
    setLotImages([]);
    setSelectedLotId(null);
    setError('');
    setView('auctionRoom');
    void loadLots();
  }

  async function handleUserSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    const phoneError = validatePhone(userForm.phone);
    const documentError = validateCpfOrCnpj(userForm.document);

    if (phoneError || documentError) {
      setError(phoneError || documentError);
      setIsSubmitting(false);
      return;
    }

    const payload: CreateUserPayload = {
      name: userForm.name.trim(),
      email: userForm.email.trim(),
      password: userForm.password,
      phone: onlyDigits(userForm.phone) || undefined,
      document: onlyDigits(userForm.document) || undefined,
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
        throw new Error('Login de usuário inválido');
      }

      persistUserAuth(auth.accessToken, auth.user);
      setCreatedUserName(createdUser.name);
      setCurrentUser(auth.user);
      setCurrentAuctionHouse(null);
      setUserForm(emptyUserForm);
      setSellerProfileForm(emptySellerProfileForm);
      setAccountType('BUYER');
      await loadAuctions(false);
      setIsAuthenticated(true);
      setView('home');
    } catch {
      setError('Não foi possível cadastrar o usuário. Confira os dados e tente novamente.');
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
          throw new Error('Login de escritório inválido');
        }

        persistAuctionHouseAuth(auth.accessToken, auth.auctionHouse);
        setCreatedUserName(auth.auctionHouse.name);
        setCurrentAuctionHouse(auth.auctionHouse);
        setCurrentUser(null);
      } else {
        if (!auth.user) {
          throw new Error('Login de usuário inválido');
        }

        persistUserAuth(auth.accessToken, auth.user);

        if (auth.user.platformRole === 'SYSTEM_ADMIN') {
          window.location.assign('/admin');
          return;
        }

        setCreatedUserName(auth.user.name);
        setCurrentUser(auth.user);
        setCurrentAuctionHouse(null);
      }

      await loadAuctions(auth.actorType === 'AUCTION_HOUSE');
      setIsAuthenticated(true);
      setView('home');
    } catch {
      setError('E-mail ou senha inválidos.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAuctionHouseInviteSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!officeInviteToken) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    const phoneError = validatePhone(auctionHouseInviteForm.phone);
    const documentError = validateCnpj(auctionHouseInviteForm.document);

    if (phoneError || documentError) {
      setError(phoneError || documentError);
      setIsSubmitting(false);
      return;
    }

    const payload: CreateAuctionHouseInvitePayload = {
      name: auctionHouseInviteForm.name.trim(),
      document: onlyDigits(auctionHouseInviteForm.document) || undefined,
      email: auctionHouseInviteForm.email.trim(),
      phone: onlyDigits(auctionHouseInviteForm.phone) || undefined,
      password: auctionHouseInviteForm.password,
      city: auctionHouseInviteForm.city.trim() || undefined,
      state: auctionHouseInviteForm.state.trim() || undefined,
      country: auctionHouseInviteForm.country.trim() || undefined,
    };

    try {
      const auth = await registerAuctionHouseWithInvite(officeInviteToken, payload);

      if (!auth.auctionHouse) {
        throw new Error('Cadastro de escritorio invalido');
      }

      persistAuctionHouseAuth(auth.accessToken, auth.auctionHouse);
      setCreatedUserName(auth.auctionHouse.name);
      setCurrentAuctionHouse(auth.auctionHouse);
      setCurrentUser(null);
      setAuctionHouseInviteForm(emptyAuctionHouseInviteForm);
      setOfficeInviteToken(null);
      setOfficeInviteStatus('idle');
      setIsOfficeInviteEmailLocked(false);
      setIsAuthenticated(true);
      setView('home');
      window.history.replaceState(null, '', '/');
      await loadAuctions(true);
    } catch {
      setError('Nao foi possivel cadastrar o escritorio com este convite.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLotSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError('');

    let selectedAuctionId: string;
    if (view === 'auctionRoom' && selectedAuction && canManageSelectedAuction) {
      selectedAuctionId = selectedAuction.id;
    } else if (selectableAuctions.some((auction) => auction.id === lotForm.auctionId)) {
      selectedAuctionId = lotForm.auctionId;
    } else {
      selectedAuctionId = selectableAuctions[0]?.id || '';
    }

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
      images: lotImages.map(({ fileName, dataUrl, description }) => ({
        fileName,
        dataUrl,
        description,
      })),
    };

    try {
      const createdLot = await createLot(payload);
      setCreatedLotId(createdLot.id);
      setLotForm({
        ...emptyLotForm,
        auctionId: view === 'auctionRoom' ? selectedAuctionId : selectableAuctions[0]?.id || '',
      });
      setLotImages([]);
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
      status: auctionForm.scheduledAt ? 'SCHEDULED' : 'DRAFT',
    };

    try {
      let auction = await createAuction(payload);

      if (auctionThumbnail) {
        try {
          auction = await uploadAuctionThumbnail(auction.id, auctionThumbnail.file);
        } catch (thumbnailError) {
          setError(
            parseApiErrorMessage(
              thumbnailError,
              'Remate criado, mas não foi possível salvar a imagem de capa.',
            ),
          );
        }
      }

      setCreatedAuctionId(auction.id);
      setSelectedAuctionId(auction.id);
      setAuctionForm(emptyAuctionForm);
      clearAuctionThumbnail();
      await loadAuctions(true);
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
      persistUserAuth(sessionStorage.getItem(authStorage.tokenKey) || '', user);
      setCurrentUser(user);
      setSellerProfileForm(emptySellerProfileForm);
      setError('');
      setView('home');
    } catch {
      setError('Nao foi possivel completar o cadastro de produtor.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(authStorage.tokenKey);
    sessionStorage.removeItem(authStorage.userKey);
    sessionStorage.removeItem(authStorage.auctionHouseKey);
    sessionStorage.removeItem(authStorage.actorTypeKey);
    setIsAuthenticated(false);
    setCreatedUserName(null);
    setCreatedLotId(null);
    setCreatedAuctionId(null);
    setCurrentUser(null);
    setCurrentAuctionHouse(null);
    setSelectedAuctionId(null);
    setSelectedStreamState(null);
    setAuctionHouseSales([]);
    setSalesError('');
    setMyWins([]);
    setMyWinsError('');
    setMySales([]);
    setMySalesError('');
    setOfficeBidHistory([]);
    clearAuctionThumbnail();
    setView('home');
  }

  function showAccountDetails() {
    setError('');
    setView('accountDetails');
  }

  function showChangePasswordPlaceholder() {
    setError('A alteração de senha ainda será disponibilizada nesta interface.');
    setView('accountDetails');
  }

  const canCompleteSellerProfile = Boolean(
    currentUser && !currentUser.buyerProfile && !currentUser.sellerProfile,
  );
  const selectedLotAuctionId = selectableAuctions.some(
    (auction) => auction.id === lotForm.auctionId,
  )
    ? lotForm.auctionId
    : selectableAuctions[0]?.id || '';

  if (officeInviteToken) {
    return (
      <OfficeInvitePage
        form={auctionHouseInviteForm}
        status={officeInviteStatus}
        isValidating={isValidatingOfficeInvite}
        isEmailLocked={isOfficeInviteEmailLocked}
        showDevDocumentTools={showDevDocumentTools}
        isSubmitting={isSubmitting}
        error={error}
        onSubmit={handleAuctionHouseInviteSubmit}
        onFieldChange={updateAuctionHouseInviteField}
        onDocumentChange={updateAuctionHouseInviteDocument}
        onPhoneChange={updateAuctionHouseInvitePhone}
        onFillDevDocument={fillDevAuctionHouseCnpj}
      />
    );
  }

  if (!isAuthenticated) {
    return (
      <AuthPage
        authMode={authMode}
        accountType={accountType}
        userForm={userForm}
        sellerProfileForm={sellerProfileForm}
        isSubmitting={isSubmitting}
        error={error}
        showDevDocumentTools={showDevDocumentTools}
        onSubmit={authMode === 'register' ? handleUserSubmit : handleLoginSubmit}
        onAuthModeChange={(mode) => {
          setAuthMode(mode);
          setError('');
        }}
        onAccountTypeChange={setAccountType}
        onUserFieldChange={updateUserField}
        onUserPhoneChange={updateUserPhone}
        onUserDocumentChange={updateUserDocument}
        onFillDevUserCpf={fillDevUserCpf}
        onSellerProfileFieldChange={updateSellerProfileField}
      />
    );
  }

  return (
    <main className="app-shell">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-lg">
        <div className="mx-auto flex min-h-15 w-full max-w-[1360px] items-center justify-between gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <button
            className="flex min-w-0 items-center gap-3 rounded-md text-left transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            type="button"
            onClick={() => setView('home')}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-brand-line bg-brand-tint text-xs font-semibold text-primary">
              CA
            </span>
            <span className="hidden min-w-0 sm:grid">
              <strong className="text-sm font-semibold leading-tight text-foreground">
                Cattle Auction
              </strong>
              <small className="truncate text-xs text-muted-foreground">
                Remates e transmissões ao vivo
              </small>
            </span>
          </button>

          <nav
            className="flex min-w-0 items-center justify-end gap-2 sm:gap-3"
            aria-label="Navegacao principal"
          >
            <Button
              variant={view === 'home' ? 'secondary' : 'ghost'}
              className="hidden rounded-md font-semibold sm:inline-flex"
              type="button"
              onClick={() => setView('home')}
            >
              <Radio className="size-4" />
              Remates
            </Button>
          {currentAuctionHouse && (
            <Button
              aria-label="Criar remate"
              className="rounded-md px-3 font-semibold sm:px-4"
              type="button"
              onClick={() => setView('createAuction')}
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Criar remate</span>
            </Button>
          )}
          <AccountMenu
            currentUser={currentUser}
            currentAuctionHouse={currentAuctionHouse}
            onShowAccountDetails={showAccountDetails}
            onShowSellerProfile={() => {
              setError('');
              setView('sellerProfile');
            }}
            onShowSales={() => {
              setError('');
              setView('sales');
              void loadAuctionHouseSales();
            }}
            onShowMyWins={() => {
              setError('');
              setView('myWins');
              void loadMyWins();
            }}
            onShowMySales={() => {
              setError('');
              setView('mySales');
              void loadMySales();
            }}
            onChangePassword={showChangePasswordPlaceholder}
            onLogout={handleLogout}
          />
        </nav>
        </div>
      </header>

      {winToast && (
        <div className="win-toast" role="status">
          <div className="win-toast-body">
            <strong>Você arrematou o lote {winToast.lotCode}! 🎉</strong>
            <span>
              {winToast.lotTitle} · {formatCurrency(winToast.finalPrice)}
            </span>
          </div>
          <div className="win-toast-actions">
            <button
              className="secondary-action"
              type="button"
              onClick={() => {
                setWinToast(null);
                setView('myWins');
                void loadMyWins();
              }}
            >
              Ver meus arremates
            </button>
            <button
              className="text-action"
              type="button"
              onClick={() => setWinToast(null)}
            >
              Dispensar
            </button>
          </div>
        </div>
      )}

      {view === 'auctionRoom' ? (
        <AuctionRoomPage
          auction={selectedAuction}
          bidAmount={bidAmount}
          bidStep={BID_STEP}
          buyerRegistrations={buyerRegistrations}
          canManage={canManageSelectedAuction}
          createdLotId={createdLotId}
          detailImages={detailLotImages}
          error={error}
          inPistaLot={inPistaLot}
          officeBidHistory={officeBidHistory}
          officeWinningBid={officeWinningBid}
          isBidder={Boolean(currentUser) && !currentAuctionHouse}
          isLoadingBuyerRegistrations={isLoadingBuyerRegistrations}
          isLoadingLots={isLoadingLots}
          isSubmitting={isSubmitting}
          lotForm={lotForm}
          lotImages={lotImages}
          lots={selectedAuctionLots}
          myRegistration={myRegistration}
          resolveMediaUrl={resolveMediaUrl}
          selectedLot={selectedLot}
          selectedLotStageMessage={
            selectedLot
              ? getLotStageMessage(selectedLot.status, selectedLot.consignmentId)
              : ''
          }
          streamState={selectedAuctionStreamState}
          onBack={() => setView('home')}
          onBidAmountChange={setBidAmount}
          onCloseLotDetail={() => {
            setDetailLotImages([]);
            setSelectedLotId(null);
          }}
          onCreateAuction={() => setView('createAuction')}
          onDetailImagesChange={handleDetailLotImageChange}
          onLotFieldChange={updateLotField}
          onLotImagesChange={handleLotImageChange}
          onLotSubmit={handleLotSubmit}
          onRemoveLotImage={removeLotImage}
          onRemoveDetailImage={removeDetailLotImage}
          onRequestApproval={handleRequestApproval}
          onReviewRegistration={handleReviewRegistration}
          onSaveDetailImages={saveDetailLotImages}
          onSelectLot={(lotId) => {
            setDetailLotImages([]);
            setSelectedLotId(lotId);
          }}
          onSetLotStage={handleSetLotStage}
          onStepBid={stepBid}
          onStreamStateChange={syncSelectedStreamState}
          onSubmitBid={handleSubmitBid}
          onWinnerDeclared={refreshLotsQuietly}
        />
      ) : view === 'accountDetails' ? (
        <AccountDetailsPage
          auctionHouse={currentAuctionHouse}
          user={currentUser}
          error={error}
          onBack={() => {
            setError('');
            setView('home');
          }}
          resolveMediaUrl={resolveMediaUrl}
        />
      ) : view === 'createAuction' ? (
        <CreateAuctionPage
          auctionForm={auctionForm}
          auctionThumbnail={auctionThumbnail}
          error={error}
          isSubmitting={isSubmitting}
          onClearThumbnail={clearAuctionThumbnail}
          onFieldChange={updateAuctionField}
          onSubmit={handleAuctionSubmit}
          onThumbnailChange={handleAuctionThumbnailChange}
        />
      ) : view === 'sellerProfile' ? (
        <SellerProfilePage
          error={error}
          form={sellerProfileForm}
          isSubmitting={isSubmitting}
          onFieldChange={updateSellerProfileField}
          onSubmit={handleSellerProfileSubmit}
        />
      ) : view === 'sales' ? (
        <SalesPage
          error={salesError}
          isLoading={isLoadingSales}
          sales={auctionHouseSales}
          onBack={() => setView('home')}
          onRetry={() => void loadAuctionHouseSales()}
        />
      ) : view === 'myWins' ? (
        <MyWinsPage
          error={myWinsError}
          isLoading={isLoadingMyWins}
          sales={myWins}
          onBack={() => setView('home')}
          onRetry={() => void loadMyWins()}
        />
      ) : view === 'mySales' ? (
        <MySalesPage
          error={mySalesError}
          isLoading={isLoadingMySales}
          sales={mySales}
          onBack={() => setView('home')}
          onRetry={() => void loadMySales()}
        />
      ) : view === 'registerLot' ? (
        <RegisterLotPage
          auctions={selectableAuctions}
          error={error}
          isAuctionHouse={Boolean(currentAuctionHouse)}
          isSubmitting={isSubmitting}
          lotForm={lotForm}
          lotImages={lotImages}
          selectedAuctionId={selectedLotAuctionId}
          onFieldChange={updateLotField}
          onImagesChange={handleLotImageChange}
          onRemoveImage={removeLotImage}
          onSubmit={handleLotSubmit}
        />
      ) : (
        <HomePage
          auctions={visibleAuctions}
          filteredAuctions={filteredVisibleAuctions}
          auctionStatusFilter={auctionStatusFilter}
          isLoading={isLoadingAuctions}
          error={error}
          createdUserName={createdUserName}
          createdLotId={createdLotId}
          createdAuctionId={createdAuctionId}
          isAuctionHouse={Boolean(currentAuctionHouse)}
          isSeller={Boolean(currentUser?.sellerProfile)}
          canCompleteSellerProfile={canCompleteSellerProfile}
          canRegisterLot={Boolean(
            selectableAuctions.length > 0 &&
              (currentAuctionHouse || currentUser?.sellerProfile),
          )}
          getAuctionLotCount={getAuctionLotCount}
          isOwnAuction={isAuctionOwnedByCurrentOffice}
          onFilterChange={setAuctionStatusFilter}
          onEnterAuction={enterAuctionRoom}
          onCreateAuction={() => setView('createAuction')}
          onRegisterLot={() => setView('registerLot')}
          onCompleteSellerProfile={() => setView('sellerProfile')}
        />

      )}
    </main>
  );
}

export default App;
