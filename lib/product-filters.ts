export const NO_CATEGORY_VALUE = "sem-categoria";

export const STATUS_OPTIONS = [
  { value: "ativo", label: "Ativos" },
  { value: "esgotado", label: "Esgotados" },
  { value: "inativo", label: "Inativos" },
] as const;

export type ProductStatusFilter = (typeof STATUS_OPTIONS)[number]["value"];

export function isValidStatus(
  value: string | undefined
): value is ProductStatusFilter {
  return !!value && STATUS_OPTIONS.some((o) => o.value === value);
}

export function isValidCategoria(
  value: string | undefined,
  categories: { id: string }[]
): boolean {
  if (!value) return false;
  if (value === NO_CATEGORY_VALUE) return true;
  return categories.some((c) => c.id === value);
}
