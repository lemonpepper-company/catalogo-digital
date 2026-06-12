import Link from "next/link";

export const metadata = {
  title: "Criar conta — Catálogo Digital",
};

export default function CadastroPage() {
  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <nav className="flex items-center justify-between px-6 py-5 border-b border-sand">
        <Link href="/landing" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[7px] bg-obsidian flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-gold block" />
          </div>
          <span className="font-display font-semibold text-[16px] text-obsidian">
            Catálogo Digital
          </span>
        </Link>
        <Link
          href="/login"
          className="font-body text-[14px] text-graphite hover:text-obsidian transition-colors"
        >
          Já tem conta?{" "}
          <span className="font-medium text-obsidian">Entrar</span>
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[440px]">
          <div className="text-center mb-8">
            <h1 className="font-display font-semibold text-[28px] text-obsidian">
              Criar sua conta grátis
            </h1>
            <p className="font-body text-[15px] text-graphite mt-2">
              14 dias grátis, sem cartão de crédito
            </p>
          </div>

          <div className="bg-white border border-sand rounded-card p-8 flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="font-body font-medium text-[13px] text-obsidian">
                  Nome da loja
                </label>
                <input
                  type="text"
                  placeholder="Ex: Ateliê Mira"
                  className="h-11 w-full rounded-input border border-sand bg-white px-3 font-body text-[14px] text-obsidian placeholder:text-inactive focus:outline-none focus:border-obsidian focus:ring-2 focus:ring-obsidian focus:ring-offset-2 transition-all"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="font-body font-medium text-[13px] text-obsidian">
                  Seu nome
                </label>
                <input
                  type="text"
                  placeholder="Nome completo"
                  className="h-11 w-full rounded-input border border-sand bg-white px-3 font-body text-[14px] text-obsidian placeholder:text-inactive focus:outline-none focus:border-obsidian focus:ring-2 focus:ring-obsidian focus:ring-offset-2 transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-body font-medium text-[13px] text-obsidian">
                E-mail
              </label>
              <input
                type="email"
                placeholder="seu@email.com"
                className="h-11 w-full rounded-input border border-sand bg-white px-3 font-body text-[14px] text-obsidian placeholder:text-inactive focus:outline-none focus:border-obsidian focus:ring-2 focus:ring-obsidian focus:ring-offset-2 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-body font-medium text-[13px] text-obsidian">
                WhatsApp
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 font-body text-[14px] text-graphite pointer-events-none">
                  +55
                </span>
                <input
                  type="tel"
                  placeholder="(11) 99999-0000"
                  className="h-11 w-full rounded-input border border-sand bg-white pl-10 pr-3 font-body text-[14px] text-obsidian placeholder:text-inactive focus:outline-none focus:border-obsidian focus:ring-2 focus:ring-obsidian focus:ring-offset-2 transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-body font-medium text-[13px] text-obsidian">
                Senha
              </label>
              <input
                type="password"
                placeholder="Mínimo 8 caracteres"
                className="h-11 w-full rounded-input border border-sand bg-white px-3 font-body text-[14px] text-obsidian placeholder:text-inactive focus:outline-none focus:border-obsidian focus:ring-2 focus:ring-obsidian focus:ring-offset-2 transition-all"
              />
            </div>

            <Link
              href="/planos"
              className="w-full h-11 rounded-btn bg-gold text-white font-display font-medium text-[15px] flex items-center justify-center hover:bg-gold-hover transition-colors mt-2"
            >
              Criar conta e escolher plano
            </Link>

            <p className="text-center font-body text-[12px] text-graphite">
              Ao criar sua conta, você concorda com os{" "}
              <Link href="#" className="underline hover:text-obsidian">
                Termos de uso
              </Link>{" "}
              e{" "}
              <Link href="#" className="underline hover:text-obsidian">
                Política de privacidade
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
