"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Tag, Layers, Palette, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

interface TabItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}

function TabItem({ href, icon, label, active }: TabItemProps) {
  return (
    <Link href={href} className="flex flex-1 items-center justify-center py-2">
      <span
        className={cn(
          "flex flex-col items-center gap-1 px-3.5 py-1.5 rounded-btn",
          "font-body text-[11px] transition-colors duration-200",
          active
            ? "bg-linen text-obsidian font-medium"
            : "text-graphite font-normal"
        )}
      >
        {icon}
        {label}
      </span>
    </Link>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();

  const isActive = (path: string) =>
    path === "/painel" ? pathname === "/painel" : pathname.startsWith(path);

  return (
    <nav
      aria-label="Navegação do painel"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch h-16 bg-ivory border-t border-sand/50"
    >
      <TabItem
        href="/painel"
        icon={<LayoutDashboard size={20} />}
        label="Dashboard"
        active={isActive("/painel")}
      />
      <TabItem
        href="/painel/produtos"
        icon={<Tag size={20} />}
        label="Produtos"
        active={isActive("/painel/produtos")}
      />
      <TabItem
        href="/painel/categorias"
        icon={<Layers size={20} />}
        label="Categorias"
        active={isActive("/painel/categorias")}
      />
      <TabItem
        href="/painel/personalizacao"
        icon={<Palette size={20} />}
        label="Personalização"
        active={isActive("/painel/personalizacao")}
      />
      <TabItem
        href="/painel/configuracoes"
        icon={<Settings size={20} />}
        label="Config."
        active={isActive("/painel/configuracoes")}
      />
    </nav>
  );
}
