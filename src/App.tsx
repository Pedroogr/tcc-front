import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import './App.css';
import { login, register } from './api/authApi';
import { createAuction, listAuctions, listPublicAuctions } from './api/auctionsApi';
import {
  registerAuctionHouseWithInvite,
  validateAuctionHouseInvite,
} from './api/auctionHousesApi';
import { apiUrl, authStorage } from './api/http';
import { createLot, listLots, updateLot } from './api/lotsApi';
import { upsertSellerProfile } from './api/usersApi';
import type { Auction } from './types/auction';
import type { CreateAuctionPayload } from './types/auction';
import type { CreateLotPayload, Lot, LotImagePayload } from './types/lot';
import type {
  AuctionHouse,
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
type View = 'home' | 'registerLot' | 'sellerProfile' | 'createAuction' | 'auctionRoom';
type AuthMode = 'login' | 'register';

type LotImageFormItem = LotImagePayload & {
  id: string;
};

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

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
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
  const [error, setError] = useState('');
  const [createdLotId, setCreatedLotId] = useState<string | null>(null);
  const [createdAuctionId, setCreatedAuctionId] = useState<string | null>(null);
  const [createdUserName, setCreatedUserName] = useState<string | null>(null);
  const [selectedAuctionId, setSelectedAuctionId] = useState<string | null>(null);
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredUser());
  const [currentAuctionHouse, setCurrentAuctionHouse] = useState<AuctionHouse | null>(() =>
    getStoredAuctionHouse(),
  );

  const publicAuctions = useMemo(() => {
    return auctions.filter((auction) => !['DRAFT', 'CANCELED'].includes(auction.status));
  }, [auctions]);

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

  const selectedLot = useMemo(() => {
    return selectedAuctionLots.find((lot) => lot.id === selectedLotId) ?? null;
  }, [selectedAuctionLots, selectedLotId]);

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

  useEffect(() => {
    queueMicrotask(() => {
      void loadAuctions(Boolean(currentAuctionHouse));
    });
  }, [currentAuctionHouse, loadAuctions]);

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
        throw new Error('Login de usuario invalido');
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

      await loadAuctions(auth.actorType === 'AUCTION_HOUSE');
      setIsAuthenticated(true);
      setView('home');
    } catch {
      setError('E-mail ou senha invalidos.');
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
      const auction = await createAuction(payload);
      setCreatedAuctionId(auction.id);
      setSelectedAuctionId(auction.id);
      setAuctionForm(emptyAuctionForm);
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
    setView('home');
  }

  const canCompleteSellerProfile = Boolean(
    currentUser && !currentUser.buyerProfile && !currentUser.sellerProfile,
  );
  const isRegisterMode = authMode === 'register';
  const selectedLotAuctionId = selectableAuctions.some(
    (auction) => auction.id === lotForm.auctionId,
  )
    ? lotForm.auctionId
    : selectableAuctions[0]?.id || '';

  if (officeInviteToken) {
    return (
      <main className="app-shell auth-shell">
        <section className="register-page user-register-page">
          <div className="register-copy">
            <span className="brand-inline">
              <span className="brand-mark">CA</span>
              Cattle Auction
            </span>
            <span className="eyebrow">Convite de escritorio</span>
            <h1>Cadastro do escritorio</h1>
            <p>
              Este cadastro e liberado apenas pelo link de convite enviado pela
              plataforma.
            </p>
          </div>

          <form className="lot-form user-form" onSubmit={handleAuctionHouseInviteSubmit}>
            <div className="form-header">
              <h2>Dados do escritorio</h2>
            </div>

            {isValidatingOfficeInvite || officeInviteStatus === 'idle' ? (
              <p className="loading-message">Validando convite...</p>
            ) : officeInviteStatus === 'invalid' ? (
              <p className="form-error">
                Link invalido, expirado ou ja utilizado. Solicite um novo convite.
              </p>
            ) : (
              <>
                <label>
                  Nome do escritorio
                  <input
                    required
                    value={auctionHouseInviteForm.name}
                    onChange={(event) =>
                      updateAuctionHouseInviteField('name', event.target.value)
                    }
                    placeholder="Leiloes Campo Alto"
                  />
                </label>

                <div className="form-grid">
                  <label>
                    E-mail
                    <input
                      required
                      readOnly={isOfficeInviteEmailLocked}
                      type="email"
                      value={auctionHouseInviteForm.email}
                      onChange={(event) =>
                        updateAuctionHouseInviteField('email', event.target.value)
                      }
                      placeholder="escritorio@email.com"
                    />
                  </label>

                  <label>
                    Senha
                    <input
                      required
                      minLength={6}
                      type="password"
                      value={auctionHouseInviteForm.password}
                      onChange={(event) =>
                        updateAuctionHouseInviteField('password', event.target.value)
                      }
                      placeholder="Minimo 6 caracteres"
                    />
                  </label>
                </div>

                <div className="form-grid">
                  <label>
                    CNPJ
                    <input
                      inputMode="numeric"
                      maxLength={18}
                      value={auctionHouseInviteForm.document}
                      onChange={(event) =>
                        updateAuctionHouseInviteDocument(event.target.value)
                      }
                      placeholder="00.000.000/0000-00"
                    />
                    {showDevDocumentTools && (
                      <button
                        className="inline-helper-action"
                        type="button"
                        onClick={fillDevAuctionHouseCnpj}
                      >
                        Gerar CNPJ de teste
                      </button>
                    )}
                  </label>

                  <label>
                    Telefone
                    <input
                      inputMode="numeric"
                      maxLength={15}
                      value={auctionHouseInviteForm.phone}
                      onChange={(event) =>
                        updateAuctionHouseInvitePhone(event.target.value)
                      }
                      placeholder="(00) 00000-0000"
                    />
                  </label>
                </div>

                <div className="form-grid three">
                  <label>
                    Cidade
                    <input
                      value={auctionHouseInviteForm.city}
                      onChange={(event) =>
                        updateAuctionHouseInviteField('city', event.target.value)
                      }
                      placeholder="Campo Grande"
                    />
                  </label>

                  <label>
                    Estado
                    <input
                      maxLength={2}
                      value={auctionHouseInviteForm.state}
                      onChange={(event) =>
                        updateAuctionHouseInviteField(
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
                      value={auctionHouseInviteForm.country}
                      onChange={(event) =>
                        updateAuctionHouseInviteField('country', event.target.value)
                      }
                      placeholder="BR"
                    />
                  </label>
                </div>

                {error && <p className="form-error">{error}</p>}

                <button
                  className="primary-action"
                  disabled={isSubmitting || officeInviteStatus !== 'valid'}
                  type="submit"
                >
                  {isSubmitting ? 'Criando escritorio...' : 'Criar conta do escritorio'}
                </button>
              </>
            )}
          </form>
        </section>
      </main>
    );
  }

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
                      inputMode="numeric"
                      maxLength={15}
                      value={userForm.phone}
                      onChange={(event) => updateUserPhone(event.target.value)}
                      placeholder="(00) 00000-0000"
                    />
                  </label>

                  <label>
                    Documento
                    <input
                      inputMode="numeric"
                      maxLength={18}
                      value={userForm.document}
                      onChange={(event) => updateUserDocument(event.target.value)}
                      placeholder="CPF ou CNPJ"
                    />
                    {showDevDocumentTools && (
                      <button
                        className="inline-helper-action"
                        type="button"
                        onClick={fillDevUserCpf}
                      >
                        Gerar CPF de teste
                      </button>
                    )}
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
              {currentAuctionHouse && (
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => setView('createAuction')}
                >
                  Novo remate
                </button>
              )}
            </div>

            <div className="auction-lot-list">
              <div className="section-title-row">
                <h2>Lotes do remate</h2>
                <span>{selectedAuctionLots.length}</span>
              </div>

              {isLoadingLots ? (
                <p className="loading-message">Carregando lotes do remate...</p>
              ) : selectedAuctionLots.length === 0 ? (
                <p className="loading-message">Nenhum lote adicionado neste remate.</p>
              ) : (
                <div className="room-lots">
                  {selectedAuctionLots.map((lot) => (
                    <button
                      className={lot.id === createdLotId ? 'room-lot highlighted' : 'room-lot'}
                      key={lot.id}
                      type="button"
                      onClick={() => {
                        setDetailLotImages([]);
                        setSelectedLotId(lot.id);
                      }}
                    >
                      <strong>{lot.code}</strong>
                      <div>
                        <h3>{lot.title}</h3>
                        <span>{formatCurrency(lot.initialPrice)}</span>
                      </div>
                      <small>
                        {lot.media?.length ? `${lot.media.length} imagens` : lot.status}
                      </small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {currentAuctionHouse && (
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

                {renderLotImageInput()}

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
          )}

          {selectedLot && (
            <div
              aria-labelledby="lot-detail-title"
              aria-modal="true"
              className="modal-backdrop"
              role="dialog"
            >
              <section className="lot-detail-modal">
                <div className="modal-header">
                  <div>
                    <span className="eyebrow">Detalhes do lote</span>
                    <h2 id="lot-detail-title">{selectedLot.title}</h2>
                  </div>
                  <button
                    className="text-action"
                    type="button"
                    onClick={() => {
                      setDetailLotImages([]);
                      setSelectedLotId(null);
                    }}
                  >
                    Fechar
                  </button>
                </div>

                {selectedLot.media?.length ? (
                  <div className="lot-gallery">
                    {selectedLot.media.map((media) => (
                      <img
                        alt={media.description || selectedLot.title}
                        key={media.id}
                        src={resolveMediaUrl(media.url)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="loading-message">Este lote ainda nao possui imagens.</p>
                )}

                <dl className="lot-stats detail-stats">
                  <div>
                    <dt>Codigo</dt>
                    <dd>{selectedLot.code}</dd>
                  </div>
                  <div>
                    <dt>Valor</dt>
                    <dd>{formatCurrency(selectedLot.initialPrice)}</dd>
                  </div>
                  <div>
                    <dt>Qtd.</dt>
                    <dd>{selectedLot.quantity}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>{selectedLot.status}</dd>
                  </div>
                </dl>

                {selectedLot.description && <p>{selectedLot.description}</p>}

                {currentAuctionHouse && (
                  <div className="detail-image-editor">
                    <div className="form-header compact">
                      <h2>Adicionar imagens</h2>
                    </div>

                    <label>
                      Novas imagens
                      <input
                        accept="image/*"
                        multiple
                        type="file"
                        onChange={handleDetailLotImageChange}
                      />
                    </label>

                    {detailLotImages.length > 0 && (
                      <div className="image-upload-list">
                        {detailLotImages.map((image) => (
                          <div className="image-upload-item" key={image.id}>
                            <img alt="" src={image.dataUrl} />
                            <span>{image.fileName}</span>
                            <button
                              type="button"
                              onClick={() => removeDetailLotImage(image.id)}
                            >
                              Remover
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {error && <p className="form-error">{error}</p>}

                    <button
                      className="primary-action"
                      disabled={isSubmitting || detailLotImages.length === 0}
                      type="button"
                      onClick={saveDetailLotImages}
                    >
                      {isSubmitting ? 'Salvando...' : 'Salvar imagens'}
                    </button>
                  </div>
                )}
              </section>
            </div>
          )}
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

            {renderLotImageInput()}

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
              <h1>{currentAuctionHouse ? 'Meus remates' : 'Remates disponiveis'}</h1>
            </div>
            {currentAuctionHouse ? (
              <button
                className="secondary-action"
                type="button"
                onClick={() => setView('createAuction')}
              >
                Criar remate
              </button>
            ) : null}
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
                  const auctionLotCount = getAuctionLotCount(auction);

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
                            <dd>{auctionLotCount}</dd>
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
          ) : isLoadingAuctions ? (
            <p className="loading-message">Carregando remates...</p>
          ) : publicAuctions.length === 0 ? (
            <p className="loading-message">Nenhum remate disponivel no momento.</p>
          ) : (
            <div className="auction-grid">
              {publicAuctions.map((auction) => {
                const auctionLotCount = getAuctionLotCount(auction);

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
                      <p>{auction.description || 'Remate disponivel para acompanhamento online.'}</p>
                      <dl className="lot-stats">
                        <div>
                          <dt>Lotes</dt>
                          <dd>{auctionLotCount}</dd>
                        </div>
                        <div>
                          <dt>Escritorio</dt>
                          <dd>{auction.auctionHouse?.name || '-'}</dd>
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
          )}
        </section>
      )}
    </main>
  );
}

export default App;
