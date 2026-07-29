import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client com a service role — ignora RLS, então só pode existir em código de
 * servidor. A env var não tem prefixo NEXT_PUBLIC_ (nunca entra no bundle) e o
 * `import "server-only"` quebra o build se um Client Component importar este
 * módulo. Uso stateless: nenhuma sessão é persistida ou renovada.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada — a gravação de pedidos está indisponível."
    );
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
