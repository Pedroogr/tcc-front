import { motion } from 'motion/react';
import type { ComponentType } from 'react';
import {
  Building2,
  ChevronDown,
  KeyRound,
  LogOut,
  Sprout,
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
      className="h-11 cursor-pointer rounded-xl px-3 text-[15px] font-extrabold"
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
  onChangePassword,
  onLogout,
}: AccountMenuProps) {
  const accountName = currentAuctionHouse?.name ?? currentUser?.name ?? 'Conta';
  const accountSubtitle = currentAuctionHouse ? 'Escritório' : 'Usuário';
  const initials = getInitials(accountName) || 'CA';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-12 gap-3 rounded-full border-primary/15 bg-white px-2.5 pr-4 text-foreground shadow-[0_8px_22px_rgba(15,23,42,0.07)] hover:bg-white"
        >
          <Avatar className="size-9 border border-white/70 shadow-sm">
            <AvatarFallback className="bg-primary text-xs font-black text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden min-w-0 text-left leading-tight sm:grid">
            <strong className="max-w-44 truncate text-sm font-black">
              {accountName}
            </strong>
            <small className="text-xs font-bold text-muted-foreground">
              {accountSubtitle}
            </small>
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={12}
        className="w-72 rounded-2xl border-primary/10 bg-popover/95 p-2 shadow-[0_28px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl"
      >
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
        >
          <DropdownMenuLabel className="flex items-center gap-3 px-3 py-3">
            <Avatar className="size-11 border border-primary/10">
              <AvatarFallback className="bg-primary text-sm font-black text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <span className="min-w-0">
              <strong className="block truncate text-sm font-black text-foreground">
                {accountName}
              </strong>
              <small className="text-xs font-bold text-muted-foreground">
                {accountSubtitle}
              </small>
            </span>
          </DropdownMenuLabel>

          <DropdownMenuSeparator className="my-2 bg-border" />

          {currentAuctionHouse ? (
            <AccountMenuItem icon={Building2} onSelect={onShowAccountDetails}>
              Dados do escritório
            </AccountMenuItem>
          ) : (
            <>
              <AccountMenuItem icon={UserRound} onSelect={onShowAccountDetails}>
                Meus dados
              </AccountMenuItem>
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
