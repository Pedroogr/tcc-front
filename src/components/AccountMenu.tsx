import { motion } from 'motion/react';
import type { ComponentType } from 'react';
import {
  Building2,
  ChevronDown,
  Gavel,
  KeyRound,
  LogOut,
  PackageCheck,
  Sprout,
  Trophy,
  UserRound,
} from 'lucide-react';
import type { AuctionHouse, User } from '@/types/user';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type AccountMenuProps = {
  currentUser: User | null;
  currentAuctionHouse: AuctionHouse | null;
  onShowAccountDetails: () => void;
  onShowSellerProfile: () => void;
  onShowSales: () => void;
  onShowMyWins: () => void;
  onShowMySales: () => void;
  onChangePassword: () => void;
  onLogout: () => void;
};

type AccountMenuItemProps = {
  children: string;
  danger?: boolean;
  icon: ComponentType<{ className?: string }>;
  onSelect: () => void;
};

export function AccountMenuItem({
  children,
  danger,
  icon: Icon,
  onSelect,
}: AccountMenuItemProps) {
  return (
    <DropdownMenuItem
      variant={danger ? 'destructive' : 'default'}
      className="h-10 cursor-pointer rounded-md px-3 text-sm font-medium"
      onSelect={onSelect}
    >
      <Icon className="size-4" />
      {children}
    </DropdownMenuItem>
  );
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function AccountMenu({
  currentUser,
  currentAuctionHouse,
  onShowAccountDetails,
  onShowSellerProfile,
  onShowSales,
  onShowMyWins,
  onShowMySales,
  onChangePassword,
  onLogout,
}: AccountMenuProps) {
  const isSeller = Boolean(currentUser?.sellerProfile);
  const accountName = currentAuctionHouse?.name ?? currentUser?.name ?? 'Conta';
  const accountSubtitle = currentAuctionHouse ? 'Escritório' : 'Usuário';
  const initials = getInitials(accountName) || 'CA';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-10 gap-2 rounded-md border-border bg-card px-1.5 pr-2 text-foreground shadow-none hover:bg-accent sm:pr-3"
        >
          <Avatar className="size-7 border border-brand-line">
            <AvatarFallback className="bg-brand-tint text-[10px] font-semibold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden min-w-0 text-left leading-tight sm:grid">
            <strong className="max-w-44 truncate text-sm font-semibold">
              {accountName}
            </strong>
            <small className="text-xs text-muted-foreground">
              {accountSubtitle}
            </small>
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={12}
        className="w-72 rounded-lg border-border bg-popover p-2 shadow-[0_18px_50px_rgb(0_0_0/0.32)]"
      >
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
        >
          <DropdownMenuLabel className="flex items-center gap-3 px-3 py-3">
            <Avatar className="size-10 border border-brand-line">
              <AvatarFallback className="bg-brand-tint text-sm font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <strong className="block truncate text-sm font-semibold text-foreground">
                {accountName}
              </strong>
              <small className="text-xs text-muted-foreground">
                {accountSubtitle}
              </small>
            </span>
          </DropdownMenuLabel>

          <DropdownMenuSeparator className="my-2 bg-border" />

          {currentAuctionHouse ? (
            <>
              <AccountMenuItem icon={Building2} onSelect={onShowAccountDetails}>
                Dados do escritório
              </AccountMenuItem>
              <AccountMenuItem icon={Gavel} onSelect={onShowSales}>
                Vendas / Arremates
              </AccountMenuItem>
            </>
          ) : (
            <>
              <AccountMenuItem icon={UserRound} onSelect={onShowAccountDetails}>
                Meus dados
              </AccountMenuItem>
              <AccountMenuItem icon={Trophy} onSelect={onShowMyWins}>
                Meus arremates
              </AccountMenuItem>
              {isSeller && (
                <AccountMenuItem icon={PackageCheck} onSelect={onShowMySales}>
                  Minhas vendas
                </AccountMenuItem>
              )}
              <AccountMenuItem icon={Sprout} onSelect={onShowSellerProfile}>
                Cadastro de produtor
              </AccountMenuItem>
            </>
          )}

          <AccountMenuItem icon={KeyRound} onSelect={onChangePassword}>
            Alterar senha
          </AccountMenuItem>

          <DropdownMenuSeparator className="my-2 bg-border" />

          <AccountMenuItem danger icon={LogOut} onSelect={onLogout}>
            Sair
          </AccountMenuItem>
        </motion.div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
