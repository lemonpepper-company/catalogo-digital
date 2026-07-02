"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Tag, Layers, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  name: string;
  monogram: string | null;
  logoUrl: string | null;
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

export function Sidebar({ name, monogram, logoUrl }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (path: string) =>
    path === "/painel"
      ? pathname === "/painel"
      : pathname.startsWith(path);

  const initials = monogram ?? name.slice(0, 2).toUpperCase();

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
        <NavItem
          href="/painel"
          icon={<LayoutDashboard size={19} />}
          label="Dashboard"
          active={isActive("/painel")}
        />
        <NavItem
          href="/painel/produtos"
          icon={<Tag size={19} />}
          label="Produtos"
          active={isActive("/painel/produtos")}
        />
        <NavItem
          href="/painel/categorias"
          icon={<Layers size={19} />}
          label="Categorias"
          active={isActive("/painel/categorias")}
        />
        <NavItem
          href="/painel/configuracoes"
          icon={<Settings size={19} />}
          label="Configurações"
          active={isActive("/painel/configuracoes")}
        />
      </nav>
    </aside>
  );
}
