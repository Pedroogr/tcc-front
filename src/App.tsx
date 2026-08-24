import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { createBid, createLot, listLots, updateLot } from './api/lotsApi';
import { listAuctionHouseSales, listMyWins } from './api/salesApi';
import { createNotificationSocket } from './api/socket';
import { upsertSellerProfile } from './api/usersApi';
import { AccountMenu } from './components/AccountMenu';
import { AuctionRoomPage } from './pages/AuctionRoomPage';
import { AuthPage } from './pages/AuthPage';
import { HomePage } from './pages/HomePage';
import { AccountDetailsPage } from './pages/AccountDetailsPage';
import { OfficeInvitePage } from './pages/OfficeInvitePage';
import { Button } from './components/ui/button';
import { Input } from './components/ui/input';
import type { Auction, AuctionStreamState } from './types/auction';
import type { CreateAuctionPayload } from './types/auction';
import type { CreateLotPayload, Lot, LotImagePayload } from './types/lot';
import type { Sale, SaleWonNotification } from './types/sale';
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
  | 'myWins';
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

function getOfficeInviteTokenFromPath() {
  const match = window.location.pathname.match(
    /^\/(?:cadastro-escritorio|office-register)\/([^/]+)\/?$/,
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
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

function getLotSubmitLabel(isSubmitting: boolean, currentAuctionHouse: AuctionHouse | null) {
  if (isSubmitting) {
    return 'Enviando...';
  }
  if (currentAuctionHouse) {
    return 'Adicionar lote ao remate';
  }
  return 'Enviar para aprovacao';
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
  const [auctionHouseSales, setAuctionHouseSales] = useState<Sale[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(false);
  const [myWins, setMyWins] = useState<Sale[]>([]);
  const [isLoadingMyWins, setIsLoadingMyWins] = useState(false);
  const [winToast, setWinToast] = useState<SaleWonNotification | null>(null);

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

  const lotWinningBid = useMemo(() => {
    if (!selectedLot?.bids?.length) {
      return null;
    }

    return selectedLot.bids.find((bid) => bid.status === 'WINNING') ?? null;
  }, [selectedLot]);

  const inPistaLot = useMemo(
    () => selectedAuctionLots.find((lot) => lot.status === 'IN_AUCTION') ?? null,
    [selectedAuctionLots],
  );

  const inPistaWinningBid = useMemo(
    () => inPistaLot?.bids?.find((bid) => bid.status === 'WINNING') ?? null,
    [inPistaLot],
  );

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

    try {
      setAuctionHouseSales(await listAuctionHouseSales());
    } catch {
      setAuctionHouseSales([]);
    } finally {
      setIsLoadingSales(false);
    }
  }, []);

  const loadMyWins = useCallback(async () => {
    setIsLoadingMyWins(true);

    try {
      setMyWins(await listMyWins());
    } catch {
      setMyWins([]);
    } finally {
      setIsLoadingMyWins(false);
    }
  }, []);

  // Notificacao em tempo real: avisa o comprador quando um lance dele vence.
  useEffect(() => {
    if (!isAuthenticated || !currentUser || currentAuctionHouse) {
      return;
    }

    const socket = createNotificationSocket();

    socket.on('connect', () => {
      socket.emit('notifications:join');
    });

    socket.on('sale:won', (payload) => {
      setWinToast(payload);
      void loadMyWins();
      void refreshLotsQuietly();
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [isAuthenticated, currentUser, currentAuctionHouse, loadMyWins]);

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

  // Mantem os lances do lote em pista atualizados para todos na sala.
  useEffect(() => {
    if (view !== 'auctionRoom' || !inPistaLot?.id) {
      return;
    }

    const interval = setInterval(() => {
      void refreshLotsQuietly();
    }, 4000);

    return () => clearInterval(interval);
  }, [view, inPistaLot?.id]);

  // Pre-preenche o campo de lance com o proximo valor sugerido (incremento
  // padrao da plataforma) quando o lote em pista muda.
  useEffect(() => {
    if (!inPistaLot) {
      return;
    }

    const winning = inPistaLot.bids?.find((bid) => bid.status === 'WINNING');
    const suggested = winning
      ? Number(winning.amount) + PLATFORM_BID_INCREMENT
      : Number(inPistaLot.initialPrice ?? 0);

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
      await createBid(inPistaLot.id, amount);
      await refreshLotsQuietly();
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

  function renderLotImageInput() {
    return (
      <div className="image-upload-field">
        <label>
          Imagens do lote
          <input accept="image/*" multiple type="file" onChange={handleLotImageChange} />
        </label>

        {lotImages.length > 0 && (
          <div className="image-upload-list">
            {lotImages.map((image) => (
              <div className="image-upload-item" key={image.id}>
                <img alt="" src={image.dataUrl} />
                <span>{image.fileName}</span>
                <button type="button" onClick={() => removeLotImage(image.id)}>
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
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
      persistUserAuth(localStorage.getItem(authStorage.tokenKey) || '', user);
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
    setSelectedStreamState(null);
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
          inPistaWinningBid={inPistaWinningBid}
          isBidder={Boolean(currentUser) && !currentAuctionHouse}
          isLoadingBuyerRegistrations={isLoadingBuyerRegistrations}
          isLoadingLots={isLoadingLots}
          isSubmitting={isSubmitting}
          lotForm={lotForm}
          lotImageInput={renderLotImageInput()}
          lots={selectedAuctionLots}
          myRegistration={myRegistration}
          resolveMediaUrl={resolveMediaUrl}
          selectedLot={selectedLot}
          selectedLotStageMessage={
            selectedLot
              ? getLotStageMessage(selectedLot.status, selectedLot.consignmentId)
              : ''
          }
          selectedLotWinningBid={lotWinningBid}
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
          onLotSubmit={handleLotSubmit}
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
              <Input
                required
                value={auctionForm.title}
                onChange={(event) => updateAuctionField('title', event.target.value)}
                placeholder="Remate Primavera 2026"
                className="mt-2 h-12 rounded-xl border-primary/15 bg-white/75 font-semibold"
              />
            </label>

            <label>
              Data e hora
              <Input
                type="datetime-local"
                value={auctionForm.scheduledAt}
                onChange={(event) => updateAuctionField('scheduledAt', event.target.value)}
                className="mt-2 h-12 rounded-xl border-primary/15 bg-white/75 font-semibold"
              />
            </label>

            <label>
              Descricao
              <textarea
                value={auctionForm.description}
                onChange={(event) => updateAuctionField('description', event.target.value)}
                placeholder="Conjunto de lotes, condicoes comerciais e detalhes do evento."
              />
            </label>

            <div className="auction-cover-field">
              <div>
                <span>Imagem de capa do remate</span>
                <small>JPG, PNG ou WEBP. Tamanho máximo de 5 MB.</small>
              </div>

              {auctionThumbnail ? (
                <div className="auction-cover-preview">
                  <img alt="" src={auctionThumbnail.previewUrl} />
                  <div>
                    <strong>{auctionThumbnail.file.name}</strong>
                    <span>{(auctionThumbnail.file.size / 1024 / 1024).toFixed(2)} MB</span>
                    <div className="auction-cover-actions">
                      <label className="secondary-action">
                        Substituir imagem
                        <input
                          accept="image/jpeg,image/png,image/webp"
                          type="file"
                          onChange={handleAuctionThumbnailChange}
                        />
                      </label>
                      <button className="inline-helper-action" type="button" onClick={clearAuctionThumbnail}>
                        Remover imagem
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <label className="auction-cover-dropzone">
                  <span>Selecionar imagem do dispositivo</span>
                  <small>A capa será exibida nos cards de remates disponíveis.</small>
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    type="file"
                    onChange={handleAuctionThumbnailChange}
                  />
                </label>
              )}
            </div>

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
                Inscrição rural
                <input
                  value={sellerProfileForm.ruralRegistration}
                  onChange={(event) =>
                    updateSellerProfileField('ruralRegistration', event.target.value)
                  }
                  placeholder="Registro do produtor"
                />
              </label>

              <label>
                Inscrição estadual
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
      ) : view === 'sales' ? (
        <section className="sales-page">
          <button className="text-action" type="button" onClick={() => setView('home')}>
            Voltar aos remates
          </button>

          <div className="form-header">
            <span className="eyebrow">Escritório</span>
            <h1>Vendas / Arremates</h1>
            <p>
              Compradores vencedores de cada lote, com os contatos para combinar
              o transporte e a logística.
            </p>
          </div>

          {isLoadingSales ? (
            <p className="loading-message">Carregando vendas...</p>
          ) : auctionHouseSales.length === 0 ? (
            <p className="loading-message">Nenhuma venda registrada ainda.</p>
          ) : (
            <div className="sales-list">
              {auctionHouseSales.map((sale) => (
                <article className="sale-card" key={sale.id}>
                  <div className="sale-card-head">
                    <strong>
                      {sale.lot?.code} · {sale.lot?.title}
                    </strong>
                    <span className="sale-price">{formatCurrency(sale.finalPrice)}</span>
                  </div>
                  {sale.lot?.auction?.title && (
                    <span className="loading-message compact">
                      Remate: {sale.lot.auction.title}
                    </span>
                  )}
                  <dl className="winner-buyer-contact">
                    <div>
                      <dt>Comprador</dt>
                      <dd>{sale.buyer?.name ?? 'Comprador'}</dd>
                    </div>
                    {sale.buyer?.email && (
                      <div>
                        <dt>E-mail</dt>
                        <dd>{sale.buyer.email}</dd>
                      </div>
                    )}
                    {sale.buyer?.phone && (
                      <div>
                        <dt>Telefone</dt>
                        <dd>{sale.buyer.phone}</dd>
                      </div>
                    )}
                    {sale.buyer?.document && (
                      <div>
                        <dt>Documento</dt>
                        <dd>{sale.buyer.document}</dd>
                      </div>
                    )}
                  </dl>
                  <small className="sale-date">
                    Arrematado em {new Date(sale.soldAt).toLocaleString('pt-BR')}
                  </small>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : view === 'myWins' ? (
        <section className="sales-page">
          <button className="text-action" type="button" onClick={() => setView('home')}>
            Voltar aos remates
          </button>

          <div className="form-header">
            <span className="eyebrow">Comprador</span>
            <h1>Meus arremates</h1>
            <p>Lotes que você arrematou. O escritório entra em contato para a logística.</p>
          </div>

          {isLoadingMyWins ? (
            <p className="loading-message">Carregando arremates...</p>
          ) : myWins.length === 0 ? (
            <p className="loading-message">Você ainda não arrematou nenhum lote.</p>
          ) : (
            <div className="sales-list">
              {myWins.map((sale) => (
                <article className="sale-card" key={sale.id}>
                  <div className="sale-card-head">
                    <strong>
                      {sale.lot?.code} · {sale.lot?.title}
                    </strong>
                    <span className="sale-price">{formatCurrency(sale.finalPrice)}</span>
                  </div>
                  {sale.lot?.auction?.title && (
                    <span className="loading-message compact">
                      Remate: {sale.lot.auction.title}
                    </span>
                  )}
                  {sale.saleRecordedByAuctionHouse && (
                    <dl className="winner-buyer-contact">
                      <div>
                        <dt>Escritório</dt>
                        <dd>{sale.saleRecordedByAuctionHouse.name}</dd>
                      </div>
                      {sale.saleRecordedByAuctionHouse.email && (
                        <div>
                          <dt>Contato</dt>
                          <dd>{sale.saleRecordedByAuctionHouse.email}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                  <small className="sale-date">
                    Arrematado em {new Date(sale.soldAt).toLocaleString('pt-BR')}
                  </small>
                </article>
              ))}
            </div>
          )}
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

            {renderLotImageInput()}

            {error && <p className="form-error">{error}</p>}

            <button
              className="primary-action"
              disabled={isSubmitting || selectableAuctions.length === 0}
              type="submit"
            >
              {getLotSubmitLabel(isSubmitting, currentAuctionHouse)}
            </button>
          </form>
        </section>
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
