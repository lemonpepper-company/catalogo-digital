import { describe, it, expect } from "vitest";
import { buildSlugCandidates, pickAvailableSlug } from "../lib/server/slug-suggest";

describe("buildSlugCandidates", () => {
  it("gera 9 candidatos com sufixo de 2 a 10", () => {
    expect(buildSlugCandidates("boutique")).toEqual([
      "boutique-2",
      "boutique-3",
      "boutique-4",
      "boutique-5",
      "boutique-6",
      "boutique-7",
      "boutique-8",
      "boutique-9",
      "boutique-10",
    ]);
  });
});

describe("pickAvailableSlug", () => {
  it("retorna o primeiro candidato quando nenhum está em uso", () => {
    const candidates = buildSlugCandidates("boutique");
    expect(pickAvailableSlug(candidates, [])).toBe("boutique-2");
  });

  it("pula candidatos já em uso", () => {
    const candidates = buildSlugCandidates("boutique");
    expect(pickAvailableSlug(candidates, ["boutique-2", "boutique-3"])).toBe("boutique-4");
  });

  it("retorna undefined quando todos os candidatos estão em uso", () => {
    const candidates = buildSlugCandidates("boutique");
    expect(pickAvailableSlug(candidates, candidates)).toBeUndefined();
  });
});
