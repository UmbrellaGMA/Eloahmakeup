/**
 * Regras de SEO das listagens (catálogo e categorias).
 * - "Ofertas", "Lançamentos" e "Mais vendidos" são páginas próprias, indexáveis.
 * - Paginação mantém o próprio endereço canônico.
 * - Busca, faixa de preço e outras ordenações não são indexadas (evita conteúdo duplicado).
 */
type SP = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export const LANDINGS = {
  promocao: {
    title: "Ofertas",
    description: "Maquiagens e acessórios em promoção na Eloah Make Up. Preços especiais por tempo limitado, com Pix ou parcelamento no cartão.",
  },
  lancamentos: {
    title: "Lançamentos",
    description: "As novidades que acabaram de chegar na Eloah Make Up: maquiagens e acessórios recém-lançados, com entrega para todo o Brasil.",
  },
  "mais-vendidos": {
    title: "Mais vendidos",
    description: "Os produtos mais vendidos da Eloah Make Up: as maquiagens e acessórios favoritos das nossas clientes.",
  },
} as const;

export type Landing = keyof typeof LANDINGS;

export function catalogSeo(basePath: string, sp: SP) {
  const landing: Landing | null =
    one(sp.promocao) === "1" ? "promocao" : one(sp.lancamentos) === "1" ? "lancamentos" : one(sp.ordem) === "mais-vendidos" || one(sp["mais-vendidos"]) === "1" ? "mais-vendidos" : null;

  const page = Number(one(sp.pagina)) || 1;
  const allowed = new Set(["pagina", ...(landing === "promocao" ? ["promocao"] : []), ...(landing === "lancamentos" ? ["lancamentos"] : []), ...(landing === "mais-vendidos" ? ["ordem"] : [])]);
  const extra = Object.entries(sp).some(([k, v]) => {
    const val = one(v);
    if (!val) return false;
    if (k === "mais-vendidos") return false;
    if (k === "ordem" && landing === "mais-vendidos") return val !== "mais-vendidos";
    return !allowed.has(k);
  });

  const params = new URLSearchParams();
  if (landing === "promocao") params.set("promocao", "1");
  if (landing === "lancamentos") params.set("lancamentos", "1");
  if (landing === "mais-vendidos") params.set("ordem", "mais-vendidos");
  if (page > 1) params.set("pagina", String(page));

  return {
    landing,
    page,
    canonical: `${basePath}${params.size ? `?${params}` : ""}`,
    index: !extra,
  };
}
