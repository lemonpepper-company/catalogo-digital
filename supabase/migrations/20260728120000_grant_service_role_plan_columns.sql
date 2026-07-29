-- Prepara o terreno para a futura integração de pagamento: quando ela existir,
-- o webhook do provedor (rota de servidor, sem sessão de usuário) vai precisar
-- gravar plan/trial_ends_at depois de confirmar um pagamento. service_role já
-- é um client totalmente confiável — nunca chega ao navegador (lib/supabase/
-- admin.ts é "server-only") — então ampliar o que ele pode escrever não reabre
-- o achado da revisão final: aquele problema era authenticated (a sessão do
-- próprio lojista) ter acesso a essas colunas, e authenticated continua sem
-- nenhum grant nelas (20260728110000). Nenhum código usa este grant ainda.
grant update (plan, trial_ends_at) on public.stores to service_role;
