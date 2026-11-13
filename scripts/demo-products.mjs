/**
 * Catálogo de DEMONSTRAÇÃO para visualizar a loja.
 * - Ilustrações próprias (SVG → WebP) geradas aqui; nenhuma foto de terceiros.
 * - Todos os produtos têm SKU "DEMO-..." e a tag "demo".
 *
 * Uso:
 *   node scripts/demo-products.mjs            cria/atualiza o catálogo demo
 *   node scripts/demo-products.mjs --remove   remove produtos e imagens demo
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

config({ path: ".env.local", quiet: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------
// Ilustrações
// ---------------------------------------------------------------------------
const TONES = {
  blush: ["#fdf7f8", "#f3e4e8"],
  lilac: ["#faf7fe", "#e9def9"],
  cream: ["#fffdfb", "#f1ebe4"],
  ink: ["#2a2133", "#120e17"],
};

const sparkle = (x, y, s, c, o = 1) =>
  `<path transform="translate(${x} ${y}) scale(${s})" d="M0-20 4-4 20 0 4 4 0 20-4 4-20 0-4-4Z" fill="${c}" opacity="${o}"/>`;

function frame(inner, tone = "lilac", zoom = 1) {
  const [a, b] = TONES[tone];
  const dark = tone === "ink";
  const z = zoom !== 1 ? `transform="translate(600 820) scale(${zoom}) translate(-600 -820)"` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1500" viewBox="0 0 1200 1500">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>
    <linearGradient id="gold" x1="0" x2="1"><stop offset="0" stop-color="#b8925a"/><stop offset=".5" stop-color="#f1d9a6"/><stop offset="1" stop-color="#a77f45"/></linearGradient>
    <linearGradient id="gloss" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".0"/><stop offset=".25" stop-color="#fff" stop-opacity=".35"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="case" x1="0" x2="1"><stop offset="0" stop-color="#0d0a11"/><stop offset=".35" stop-color="#2a2331"/><stop offset="1" stop-color="#0d0a11"/></linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="22"/></filter>
  </defs>
  <rect width="1200" height="1500" fill="url(#bg)"/>
  <circle cx="600" cy="760" r="420" fill="${dark ? "#8656bf" : "#ffffff"}" opacity="${dark ? 0.18 : 0.55}"/>
  ${sparkle(190, 230, 1.4, "#b691e4", 0.55)}${sparkle(1010, 330, 0.9, "#cdb3ef", 0.8)}${sparkle(980, 1270, 1.1, "#b691e4", 0.35)}
  <ellipse cx="600" cy="1330" rx="330" ry="38" fill="#3d2858" opacity=".18" filter="url(#soft)"/>
  <g ${z}>${inner}</g>
</svg>`;
}

const wordmark = (x, y, size = 42, fill = "#cdb3ef") =>
  `<text x="${x}" y="${y}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="${size}" fill="${fill}">Eloah</text>`;

const ART = {
  lipstick: (c) => `
    <rect x="470" y="820" width="260" height="490" rx="26" fill="url(#case)"/>
    <rect x="470" y="790" width="260" height="44" rx="6" fill="url(#gold)"/>
    <rect x="505" y="610" width="190" height="190" rx="10" fill="url(#gold)"/>
    <path d="M528 620V440Q528 405 562 384L672 300V620Z" fill="${c}"/>
    <path d="M528 620V440Q528 405 562 384L590 366V620Z" fill="#fff" opacity=".22"/>
    <rect x="470" y="820" width="260" height="490" rx="26" fill="url(#gloss)"/>
    ${wordmark(600, 1200)}`,
  gloss: (c) => `
    <rect x="535" y="240" width="130" height="330" rx="22" fill="url(#case)"/>
    <rect x="535" y="540" width="130" height="34" fill="url(#gold)"/>
    <rect x="515" y="574" width="170" height="730" rx="46" fill="#ffffff" opacity=".55" stroke="#ffffff" stroke-width="6"/>
    <rect x="532" y="640" width="136" height="645" rx="34" fill="${c}" opacity=".92"/>
    <rect x="590" y="600" width="20" height="560" rx="10" fill="#2a2331" opacity=".25"/>
    <rect x="515" y="574" width="170" height="730" rx="46" fill="url(#gloss)"/>
    ${wordmark(600, 1210, 38, "#ffffff")}`,
  foundation: (c) => `
    <rect x="500" y="430" width="200" height="74" rx="18" fill="url(#case)"/>
    <rect x="690" y="452" width="96" height="28" rx="12" fill="#15111a"/>
    <rect x="548" y="500" width="104" height="110" fill="url(#case)"/>
    <rect x="410" y="600" width="380" height="680" rx="56" fill="#ffffff" opacity=".6" stroke="#ffffff" stroke-width="8"/>
    <rect x="436" y="700" width="328" height="555" rx="40" fill="${c}"/>
    <rect x="410" y="600" width="380" height="680" rx="56" fill="url(#gloss)"/>
    ${wordmark(600, 990, 64, "#ffffff")}
    <text x="600" y="1040" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" letter-spacing="8" fill="#ffffff" opacity=".85">SKIN</text>`,
  compact: (c) => `
    <circle cx="600" cy="800" r="340" fill="url(#case)"/>
    <circle cx="600" cy="800" r="300" fill="url(#gold)"/>
    <circle cx="600" cy="800" r="284" fill="${c}"/>
    <g opacity=".22" fill="#fff">
      <rect x="520" y="690" width="22" height="220" rx="11"/>
      <rect x="530" y="690" width="150" height="24" rx="12"/><rect x="530" y="788" width="110" height="24" rx="12"/><rect x="530" y="886" width="150" height="24" rx="12"/>
    </g>
    <circle cx="600" cy="800" r="340" fill="url(#gloss)"/>`,
  blush: (c) => `
    <rect x="290" y="500" width="620" height="620" rx="70" fill="url(#case)"/>
    <rect x="345" y="555" width="510" height="510" rx="46" fill="${c}"/>
    <g stroke="#fff" stroke-width="14" opacity=".18">${[0, 1, 2, 3, 4, 5].map((i) => `<line x1="${380 + i * 80}" y1="1030" x2="${520 + i * 80}" y2="590"/>`).join("")}</g>
    <rect x="290" y="500" width="620" height="620" rx="70" fill="url(#gloss)"/>
    ${wordmark(600, 1185, 40)}`,
  palette: (colors) => `
    <rect x="220" y="430" width="760" height="700" rx="44" fill="url(#case)"/>
    ${colors
      .map((col, i) => {
        const x = 268 + (i % 4) * 172;
        const y = 480 + Math.floor(i / 4) * 172;
        return `<rect x="${x}" y="${y}" width="148" height="148" rx="22" fill="${col}"/><rect x="${x}" y="${y}" width="148" height="60" rx="22" fill="#fff" opacity=".1"/>`;
      })
      .join("")}
    ${wordmark(600, 1060, 44)}
    <text x="600" y="1100" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" letter-spacing="10" fill="#cdb3ef">AMETISTA</text>`,
  mascara: () => `
    <rect x="410" y="520" width="160" height="780" rx="74" fill="url(#case)"/>
    <rect x="410" y="760" width="160" height="40" fill="#9d70d5"/>
    <rect x="410" y="520" width="160" height="780" rx="74" fill="url(#gloss)"/>
    <text transform="translate(505 1150) rotate(-90)" font-family="Georgia, serif" font-style="italic" font-size="52" fill="#cdb3ef">Eloah</text>
    <g transform="rotate(16 760 700)">
      <rect x="700" y="260" width="130" height="330" rx="56" fill="url(#case)"/>
      <rect x="700" y="560" width="130" height="30" fill="#9d70d5"/>
      <rect x="756" y="590" width="18" height="400" fill="#2a2331"/>
      <rect x="738" y="960" width="54" height="230" rx="27" fill="#0f0c13"/>
      <g stroke="#0f0c13" stroke-width="6">${Array.from({ length: 12 }, (_, i) => `<line x1="726" y1="${975 + i * 18}" x2="804" y2="${975 + i * 18}"/>`).join("")}</g>
    </g>`,
  pencil: (c) => `
    <g transform="rotate(-32 600 780)">
      <rect x="560" y="300" width="80" height="900" rx="14" fill="url(#case)"/>
      <rect x="560" y="1150" width="80" height="40" fill="url(#gold)"/>
      <path d="M560 300 600 170 640 300Z" fill="#e8c9a0"/>
      <path d="M586 216 600 170 614 216Z" fill="${c}"/>
      <rect x="590" y="1190" width="20" height="70" fill="#2a2331"/>
      <rect x="578" y="1250" width="44" height="120" rx="20" fill="#0f0c13"/>
      <text transform="translate(612 900) rotate(-90)" font-family="Georgia, serif" font-style="italic" font-size="40" fill="#cdb3ef">Eloah</text>
    </g>`,
  brushes: () => {
    const brush = (a, len, head, tip) => `
      <g transform="rotate(${a} 600 1050)">
        <rect x="584" y="${1000 - len}" width="32" height="${len + 80}" rx="14" fill="#15111a"/>
        <rect x="578" y="${930 - len}" width="44" height="90" rx="6" fill="url(#gold)"/>
        <path d="M578 ${935 - len} C ${578 - head} ${830 - len} ${590} ${760 - len} 600 ${745 - len} C ${610} ${760 - len} ${622 + head} ${830 - len} 622 ${935 - len}Z" fill="#efe3d3"/>
        <path d="M590 ${770 - len} C 594 ${758 - len} 606 ${758 - len} 610 ${770 - len} L 616 ${800 - len} L 584 ${800 - len}Z" fill="${tip}"/>
      </g>`;
    return `${brush(-26, 260, 40, "#3d2858")}${brush(-12, 330, 22, "#6e449f")}${brush(2, 380, 30, "#0f0c13")}${brush(15, 320, 50, "#8656bf")}${brush(28, 250, 18, "#3d2858")}
      <path d="M390 860H810L780 1300Q776 1320 756 1320H444Q424 1320 420 1300Z" fill="#b691e4"/>
      <path d="M390 860H810L806 920H394Z" fill="#9d70d5"/>
      ${wordmark(600, 1140, 58, "#ffffff")}`;
  },
  sponge: (c) => `
    <path d="M600 360C770 590 830 760 830 900A230 230 0 0 1 370 900C370 760 430 590 600 360Z" fill="${c}"/>
    <path d="M520 560C470 660 445 760 450 850" stroke="#fff" stroke-width="34" stroke-linecap="round" opacity=".28" fill="none"/>
    <g fill="#000" opacity=".06">${Array.from({ length: 40 }, (_, i) => `<circle cx="${430 + ((i * 97) % 360)}" cy="${640 + ((i * 53) % 470)}" r="${5 + (i % 4)}"/>`).join("")}</g>`,
  necessaire: () => `
    <path d="M270 620Q270 560 330 560H870Q930 560 930 620L960 1180Q962 1240 902 1240H298Q238 1240 240 1180Z" fill="#b691e4"/>
    <path d="M270 620Q270 560 330 560H870Q930 560 930 620L934 700H266Z" fill="#9d70d5"/>
    <rect x="300" y="616" width="600" height="14" rx="7" fill="url(#gold)"/>
    <rect x="770" y="600" width="44" height="120" rx="14" fill="url(#gold)"/>
    <rect x="440" y="860" width="320" height="170" rx="22" fill="#15111a"/>
    ${wordmark(600, 955, 62)}
    <text x="600" y="998" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" letter-spacing="9" fill="#cdb3ef">MAKE UP</text>`,
  spray: () => `
    <rect x="530" y="300" width="140" height="210" rx="34" fill="url(#case)"/>
    <rect x="560" y="510" width="80" height="60" fill="#2a2331"/>
    <rect x="460" y="560" width="280" height="740" rx="70" fill="#e9def9" opacity=".75" stroke="#fff" stroke-width="8"/>
    <rect x="482" y="760" width="236" height="520" rx="54" fill="#cdb3ef" opacity=".85"/>
    <rect x="460" y="560" width="280" height="740" rx="70" fill="url(#gloss)"/>
    ${wordmark(600, 1000, 56, "#3d2858")}
    <text x="600" y="1046" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" letter-spacing="8" fill="#3d2858">FIX</text>
    <g fill="#b691e4" opacity=".5">${Array.from({ length: 18 }, (_, i) => `<circle cx="${700 + (i % 6) * 34 + i * 6}" cy="${300 + Math.floor(i / 6) * 34 - (i % 6) * 8}" r="${6 - (i % 3)}"/>`).join("")}</g>`,
};

async function render(svg) {
  return sharp(Buffer.from(svg)).webp({ quality: 88 }).toBuffer();
}

// ---------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------
const PRODUCTS = [
  {
    slug: "batom-matte-veludo", sku: "DEMO-BAT-VEL", cat: "labios", name: "Batom Matte Veludo", brand: "Eloah",
    price: 49.9, promo: 39.9, featured: true, isNew: false, sales: 48, art: "lipstick", tone: "blush", weight: 40, dims: [3, 11, 16],
    short: "Cor intensa em uma passada, acabamento aveludado e conforto o dia inteiro.",
    desc: "O Batom Matte Veludo tem alta pigmentação e textura cremosa que seca em acabamento matte sem ressecar.\n\nEnriquecido com vitamina E e manteiga de karité, desliza com facilidade e garante até 8 horas de cor.\n\nModo de usar: aplique diretamente nos lábios, começando pelo centro e espalhando para os cantos.",
    variants: [["Nude Rosé", "#b7737a", 18], ["Vinho", "#6e1f3a", 12], ["Lilás Ousado", "#9d70d5", 9], ["Vermelho Clássico", "#b3202e", 0]],
  },
  {
    slug: "gloss-labial-glow", sku: "DEMO-GLO-GLW", cat: "labios", name: "Gloss Labial Glow", brand: "Eloah",
    price: 39.9, promo: null, featured: false, isNew: true, sales: 22, art: "gloss", tone: "lilac", weight: 30, dims: [3, 11, 16],
    short: "Brilho espelhado, efeito volumoso e toque não pegajoso.",
    desc: "Gloss de alto brilho com ácido hialurônico, que hidrata e dá efeito de lábios mais volumosos.\n\nPode ser usado sozinho ou sobre o batom para um acabamento iluminado.",
    variants: [["Cristal", "#f3d7e3", 20], ["Rosé", "#d98aa3", 15], ["Lilás", "#c9a5ee", 11]],
  },
  {
    slug: "base-liquida-pele-perfeita", sku: "DEMO-BAS-PEL", cat: "rosto", name: "Base Líquida Pele Perfeita", brand: "Eloah",
    price: 89.9, promo: null, featured: true, isNew: false, sales: 35, art: "foundation", tone: "cream", weight: 120, dims: [5, 11, 16],
    short: "Cobertura média a alta, acabamento natural e longa duração.",
    desc: "Base de textura leve com cobertura construível e acabamento natural aveludado.\n\nControla a oleosidade por até 12 horas, não obstrui os poros e tem FPS 20.\n\nModo de usar: aplique com pincel ou esponja úmida, do centro do rosto para as extremidades.",
    variants: [["Claro 01", "#f1d2b6", 14], ["Médio 03", "#d4a27d", 16], ["Médio 05", "#b98058", 10], ["Escuro 08", "#7a4e33", 8]],
  },
  {
    slug: "po-compacto-matte", sku: "DEMO-PO-MAT", cat: "rosto", name: "Pó Compacto Matte", brand: "Eloah",
    price: 59.9, promo: 49.9, featured: false, isNew: false, sales: 30, art: "compact", tone: "lilac", artArg: "#e8c4a6", weight: 80, dims: [3, 11, 16],
    short: "Sela a maquiagem e controla o brilho sem pesar.",
    desc: "Pó compacto ultrafino que uniformiza a pele e prolonga a duração da maquiagem.\n\nCom espelho e esponja inclusos, ideal para retoques ao longo do dia.",
    stock: 25,
  },
  {
    slug: "blush-cremoso-pessego", sku: "DEMO-BLU-PES", cat: "rosto", name: "Blush Cremoso Pêssego", brand: "Eloah",
    price: 44.9, promo: null, featured: false, isNew: true, sales: 12, art: "blush", tone: "blush", artArg: "#f2a48a", weight: 60, dims: [3, 11, 16],
    short: "Corado saudável que se funde à pele.",
    desc: "Textura cremosa que vira pó ao toque, com cor modulável e acabamento natural.\n\nAplique com os dedos ou pincel nas maçãs do rosto.",
    stock: 3,
  },
  {
    slug: "paleta-de-sombras-ametista", sku: "DEMO-PAL-AME", cat: "olhos", name: "Paleta de Sombras Ametista — 12 cores", brand: "Eloah",
    price: 129.9, promo: 99.9, featured: true, isNew: true, sales: 62, art: "palette", tone: "lilac", weight: 180, dims: [3, 15, 18],
    artArg: ["#f3e6dc", "#e2c4b0", "#c99a86", "#a8707a", "#d9b8ee", "#b691e4", "#8656bf", "#5a3a86", "#cfa77c", "#9c6b4e", "#6b4433", "#2b1d2a"],
    short: "12 tons entre mattes, cintilantes e metálicos — do dia à noite.",
    desc: "A paleta Ametista combina neutros quentes com lilases e roxos para looks versáteis.\n\nSombras de alta pigmentação, fácil esfumado e mínima queda de produto.",
    stock: 22,
  },
  {
    slug: "mascara-de-cilios-volume-extremo", sku: "DEMO-MAS-VOL", cat: "olhos", name: "Máscara de Cílios Volume Extremo", brand: "Eloah",
    price: 54.9, promo: null, featured: false, isNew: false, sales: 80, art: "mascara", tone: "ink", weight: 50, dims: [3, 11, 16],
    short: "Volume e alongamento sem grumos, à prova d'água.",
    desc: "Escova de fibras que separa e envolve cada cílio, com fórmula à prova d'água que dura o dia todo.\n\nRemova com demaquilante bifásico.",
    stock: 40,
  },
  {
    slug: "lapis-para-sobrancelha", sku: "DEMO-LAP-SOB", cat: "sobrancelhas", name: "Lápis para Sobrancelha com Escovinha", brand: "Eloah",
    price: 34.9, promo: null, featured: false, isNew: false, sales: 18, art: "pencil", tone: "cream", weight: 20, dims: [2, 11, 16],
    short: "Traço preciso e natural, com escovinha para esfumar.",
    desc: "Ponta fina para desenhar fio a fio e escovinha para pentear e esfumar o produto.",
    variants: [["Castanho Claro", "#8a6648", 15], ["Castanho Escuro", "#4a3324", 12]],
  },
  {
    slug: "kit-pinceis-essenciais", sku: "DEMO-KIT-PIN", cat: "pinceis", name: "Kit Pincéis Essenciais — 5 peças", brand: "Eloah",
    price: 119.9, promo: 89.9, featured: true, isNew: false, sales: 41, art: "brushes", tone: "lilac", weight: 220, dims: [6, 12, 22],
    short: "Os 5 pincéis que você precisa: base, pó, blush, sombra e esfumado.",
    desc: "Cerdas sintéticas macias, veganas e de fácil limpeza, com cabo ergonômico.\n\nInclui: pincel de base, pó, blush, sombra e esfumado.",
    stock: 16,
  },
  {
    slug: "esponja-de-maquiagem-gota", sku: "DEMO-ESP-GOT", cat: "esponjas", name: "Esponja de Maquiagem Gota", brand: "Eloah",
    price: 24.9, promo: null, featured: false, isNew: true, sales: 55, art: "sponge", tone: "blush", weight: 15, dims: [5, 11, 16],
    short: "Acabamento impecável com base, corretivo e pó.",
    desc: "Esponja sem látex que dobra de tamanho ao ser umedecida, para aplicação uniforme e sem marcas.",
    variants: [["Lilás", "#b691e4", 30], ["Rosa", "#f0a6bd", 25], ["Preta", "#2a2331", 18]],
  },
  {
    slug: "necessaire-eloah-lilas", sku: "DEMO-NEC-LIL", cat: "necessaires", name: "Necessaire Eloah Lilás", brand: "Eloah",
    price: 79.9, promo: null, featured: false, isNew: true, sales: 9, art: "necessaire", tone: "cream", weight: 150, dims: [8, 15, 24],
    short: "Espaçosa, impermeável por dentro e com zíper dourado.",
    desc: "Necessaire em material sintético de toque macio, forro impermeável e zíper metálico.\n\nMedidas: 24 × 15 × 8 cm.",
    stock: 12,
  },
  {
    slug: "bruma-fixadora", sku: "DEMO-BRU-FIX", cat: "rosto", name: "Bruma Fixadora de Maquiagem", brand: "Eloah",
    price: 64.9, promo: null, featured: false, isNew: false, sales: 20, art: "spray", tone: "lilac", weight: 130, dims: [5, 11, 18],
    short: "Fixa a maquiagem por até 16 horas com efeito refrescante.",
    desc: "Bruma ultrafina que funde as camadas da maquiagem e devolve o viço da pele.\n\nAgite e borrife a 20 cm do rosto ao finalizar a maquiagem.",
    stock: 19,
  },
];

async function upload(path, buf) {
  const { error } = await db.storage.from("products").upload(path, buf, { contentType: "image/webp", upsert: true, cacheControl: "31536000" });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
  return db.storage.from("products").getPublicUrl(path).data.publicUrl;
}

async function remove() {
  const { data: prods } = await db.from("products").select("id, slug").like("sku", "DEMO-%");
  for (const p of prods ?? []) {
    const { count } = await db.from("order_items").select("id", { count: "exact", head: true }).eq("product_id", p.id);
    if (count) await db.from("products").update({ status: "archived" }).eq("id", p.id);
    else await db.from("products").delete().eq("id", p.id);
  }
  const { data: folders } = await db.storage.from("products").list("demo", { limit: 100 });
  for (const f of folders ?? []) {
    const { data: files } = await db.storage.from("products").list(`demo/${f.name}`, { limit: 100 });
    if (files?.length) await db.storage.from("products").remove(files.map((x) => `demo/${f.name}/${x.name}`));
  }
  console.log(`Removidos ${prods?.length ?? 0} produtos demo e suas imagens.`);
}

async function seed() {
  const { data: cats } = await db.from("categories").select("id, slug");
  const catId = Object.fromEntries((cats ?? []).map((c) => [c.slug, c.id]));

  for (const p of PRODUCTS) {
    process.stdout.write(`  ${p.name} ... `);
    const firstColor = p.variants?.[0]?.[1];
    const arg = p.artArg ?? firstColor;
    const altTone = p.tone === "ink" ? "lilac" : p.tone === "lilac" ? "blush" : "lilac";
    const main = await upload(`demo/${p.slug}/1.webp`, await render(frame(ART[p.art](arg), p.tone)));
    const detail = await upload(`demo/${p.slug}/2.webp`, await render(frame(ART[p.art](arg), altTone, 1.35)));

    const row = {
      name: p.name, slug: p.slug, sku: p.sku, brand: p.brand, category_id: catId[p.cat] ?? null,
      short_description: p.short, description: p.desc, price: p.price, promo_price: p.promo,
      weight_grams: p.weight, height_cm: p.dims[0], width_cm: p.dims[1], length_cm: p.dims[2],
      status: "active", is_featured: p.featured, is_new: p.isNew, sales_count: p.sales, tags: ["demo"],
    };
    const { data: existing } = await db.from("products").select("id").eq("sku", p.sku).maybeSingle();
    let id = existing?.id;
    if (id) await db.from("products").update(row).eq("id", id);
    else id = (await db.from("products").insert(row).select("id").single()).data.id;

    await db.from("product_images").delete().eq("product_id", id);
    await db.from("product_images").insert([
      { product_id: id, url: main, storage_path: `demo/${p.slug}/1.webp`, alt: p.name, position: 0 },
      { product_id: id, url: detail, storage_path: `demo/${p.slug}/2.webp`, alt: `${p.name} — detalhe`, position: 1 },
    ]);

    if (p.variants) {
      for (const [i, [vname, hex, stock]] of p.variants.entries()) {
        const vslug = vname.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");
        const vimg = i === 0 ? main : await upload(`demo/${p.slug}/v-${vslug}.webp`, await render(frame(ART[p.art](hex), p.tone)));
        const vrow = { product_id: id, name: vname, sku: `${p.sku}-${vslug.toUpperCase()}`.slice(0, 64), color_hex: hex, image_url: vimg, position: i, is_active: true };
        const { data: ev } = await db.from("product_variants").select("id").eq("sku", vrow.sku).maybeSingle();
        const vid = ev?.id ?? (await db.from("product_variants").insert(vrow).select("id").single()).data.id;
        if (ev) await db.from("product_variants").update(vrow).eq("id", vid);
        await db.from("inventory").update({ quantity: stock }).eq("variant_id", vid);
      }
    } else {
      await db.from("inventory").update({ quantity: p.stock }).eq("product_id", id).is("variant_id", null);
    }
    console.log("ok");
  }
}

if (process.argv.includes("--remove")) await remove();
else {
  console.log("Criando catálogo de demonstração:");
  await seed();
  console.log("Pronto. Para remover depois: node scripts/demo-products.mjs --remove");
}
