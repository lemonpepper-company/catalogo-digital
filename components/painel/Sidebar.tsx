"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Tag,
  Receipt,
  Layers,
  Palette,
  Settings,
  ExternalLink,
  HelpCircle,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/actions/auth";
import { vtrineWhatsAppHref, SUPPORT_WHATSAPP_MESSAGE } from "@/lib/contact";

interface SidebarProps {
  name: string;
  monogram: string | null;
  logoUrl: string | null;
  catalogUrl: string | null;
  hideDashboard?: boolean;
}

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}

function NavItem({ href, icon, label, active }: NavItemProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 w-full px-3.5 py-[11px] rounded-btn",
        "font-body text-[15px] transition-all duration-200",
        active
          ? "bg-linen text-obsidian font-medium"
          : "text-graphite font-normal hover:bg-surface-hover"
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

export function Sidebar({
  name,
  monogram,
  logoUrl,
  catalogUrl,
  hideDashboard = false,
}: SidebarProps) {
  const pathname = usePathname();

  const isActive = (path: string) =>
    path === "/painel"
      ? pathname === "/painel"
      : pathname.startsWith(path);

  const initials = monogram ?? name.slice(0, 2).toUpperCase();
  const catalogLabel = catalogUrl?.replace(/^https?:\/\//, "") ?? null;

  return (
    <aside className="hidden lg:flex w-[248px] flex-shrink-0 border-r border-sand/50 p-5 flex-col gap-6 h-full">
      <div className="flex items-center gap-3 px-1.5 py-1">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={name}
            className="w-9 h-9 rounded-full object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-obsidian text-white flex items-center justify-center font-display font-semibold text-[15px] flex-shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <div className="font-display font-semibold text-[15px] text-obsidian truncate">
            {name}
          </div>
          <div className="font-body text-[12px] text-graphite">
            Painel do lojista
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-1">
        {!hideDashboard && (
          <NavItem
            href="/painel"
            icon={<LayoutDashboard size={19} />}
            label="Dashboard"
            active={isActive("/painel")}
          />
        )}
        <NavItem
          href="/painel/produtos"
          icon={<Tag size={19} />}
          label="Produtos"
          active={isActive("/painel/produtos")}
        />
        <NavItem
          href="/painel/pedidos"
          icon={<Receipt size={19} />}
          label="Pedidos"
          active={isActive("/painel/pedidos")}
        />
        <NavItem
          href="/painel/categorias"
          icon={<Layers size={19} />}
          label="Categorias"
          active={isActive("/painel/categorias")}
        />
        <NavItem
          href="/painel/personalizacao"
          icon={<Palette size={19} />}
          label="Personalização"
          active={isActive("/painel/personalizacao")}
        />
        <NavItem
          href="/painel/configuracoes"
          icon={<Settings size={19} />}
          label="Configurações"
          active={isActive("/painel/configuracoes")}
        />
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        {catalogUrl && (
          <div className="p-3.5 rounded-card bg-linen border border-sand/50">
            <p className="font-body text-[12px] text-graphite mb-1">
              Catálogo público em
            </p>
            <a
              href={catalogUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-body font-medium text-[12px] text-obsidian flex items-center gap-1 hover:underline min-w-0"
            >
              <span className="truncate">{catalogLabel}</span>
              <ExternalLink size={11} className="flex-shrink-0" />
            </a>
          </div>
        )}

        <a
          href={vtrineWhatsAppHref(SUPPORT_WHATSAPP_MESSAGE)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 w-full px-3.5 py-[11px] rounded-btn font-body text-[15px] text-graphite hover:bg-surface-hover transition-all duration-200"
        >
          <HelpCircle size={19} />
          Suporte
        </a>

        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-3 w-full px-3.5 py-[11px] rounded-btn font-body text-[15px] text-graphite hover:bg-surface-hover transition-all duration-200"
          >
            <LogOut size={19} />
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
