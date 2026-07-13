import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

const SLUG_REGEX = /^[a-z0-9-]{2,50}$/;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.ADMIN_REVALIDATE_SECRET;
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "");

  const provided = Buffer.from(token);
  const expected = Buffer.from(secret);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

// Ferramenta de suporte: força a invalidação do cache do catálogo público de
// uma loja quando a revalidação automática (disparada pelas Server Actions do
// painel ao editar produtos/categorias/configurações) não é suficiente — por
// exemplo, lojas seed/demo sem dono com acesso ao painel para salvar uma edição.
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { slug } = await request.json().catch(() => ({ slug: null }));
  if (typeof slug !== "string" || !SLUG_REGEX.test(slug)) {
    return NextResponse.json({ error: "Slug inválido." }, { status: 400 });
  }

  revalidateTag(`catalog-${slug}`, { expire: 0 });
  return NextResponse.json({ revalidated: true, slug });
}
