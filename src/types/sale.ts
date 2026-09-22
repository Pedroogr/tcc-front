// Projecoes de venda por papel, espelhando as views seguras do backend
// (RF08-RF10). Cada perspectiva so recebe os contatos que pode ver.

export type SaleContact = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
};

export type ResponsibleContact = SaleContact & {
  kind: 'SELLER' | 'AUCTION_HOUSE';
};

export type SaleBase = {
  id: string;
  lotId: string;
  lotCode: string;
  lotTitle: string;
  auctionId: string;
  auctionTitle: string;
  finalPrice: string | number;
  soldAt: string;
  status: string;
  notes?: string | null;
};

// Escritorio: ve comprador e vendedor (ou o responsavel quando nao ha vendedor).
export type OfficeSale = SaleBase & {
  buyer: SaleContact;
  seller: SaleContact | null;
  responsible: ResponsibleContact;
};

// Comprador vencedor: ve apenas o responsavel pela negociacao.
export type WinnerSale = SaleBase & {
  responsible: ResponsibleContact;
};

// Vendedor: ve apenas o comprador do seu lote.
export type SellerSale = SaleBase & {
  buyer: SaleContact;
};

export type DeclareWinnerPayload = {
  lotId: string;
  notes?: string;
};

export type SaleWonNotification = {
  saleId: string;
  lotId: string;
  lotCode: string;
  lotTitle: string;
  auctionId: string;
  auctionTitle: string;
  finalPrice: string;
};
