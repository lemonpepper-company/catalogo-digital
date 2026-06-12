import Link from "next/link";

export const metadata = {
  title: "Entrar — Catálogo Digital",
};

export default function LoginPage() {
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
          href="/cadastro"
          className="font-body text-[14px] text-graphite hover:text-obsidian transition-colors"
        >
          Não tem conta?{" "}
          <span className="font-medium text-obsidian">Criar grátis</span>
        </Link>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px]">
          <div className="text-center mb-8">
            <h1 className="font-display font-semibold text-[28px] text-obsidian">
              Entrar na sua conta
            </h1>
            <p className="font-body text-[15px] text-graphite mt-2">
              Acesse seu painel do lojista
            </p>
          </div>

          <div className="bg-white border border-sand rounded-card p-8 flex flex-col gap-5">
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
              <div className="flex items-center justify-between">
                <label className="font-body font-medium text-[13px] text-obsidian">
                  Senha
                </label>
                <Link
                  href="#"
                  className="font-body text-[13px] text-graphite hover:text-obsidian transition-colors"
                >
                  Esqueci a senha
                </Link>
              </div>
              <input
                type="password"
                placeholder="••••••••"
                className="h-11 w-full rounded-input border border-sand bg-white px-3 font-body text-[14px] text-obsidian placeholder:text-inactive focus:outline-none focus:border-obsidian focus:ring-2 focus:ring-obsidian focus:ring-offset-2 transition-all"
              />
            </div>

            <Link
              href="/painel"
              className="w-full h-11 rounded-btn bg-obsidian text-white font-display font-medium text-[15px] flex items-center justify-center hover:bg-[#1f1f1f] transition-colors mt-2"
            >
              Entrar
            </Link>
          </div>

          <p className="text-center font-body text-[14px] text-graphite mt-6">
            Não tem conta?{" "}
            <Link
              href="/cadastro"
              className="font-medium text-obsidian hover:underline"
            >
              Criar grátis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
