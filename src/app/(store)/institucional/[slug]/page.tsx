import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStoreSettings } from "@/lib/catalog";
import type { StoreSettings } from "@/lib/types";

export const revalidate = 3600;

type Page = { title: string; description: string; body: (s: StoreSettings) => string[] };

/**
 * Textos institucionais-base. Revise com a assessoria jurídica/contábil da
 * loja antes da publicação definitiva (CDC, LGPD, Decreto 7.962/2013).
 */
const PAGES: Record<string, Page> = {
  sobre: {
    title: "Sobre a Eloah Make Up",
    description: "Conheça a Eloah Make Up.",
    body: (s) => [
      `A ${s.store_name} nasceu da paixão por maquiagem e pelo poder que ela tem de revelar a melhor versão de cada mulher.`,
      "Selecionamos maquiagens e acessórios com atenção à qualidade, ao acabamento e à experiência de uso — para que a sua rotina de beleza seja prática, segura e cheia de personalidade.",
      "Atendemos todo o Brasil, com pagamento seguro pelo Mercado Pago e envios rastreáveis.",
    ],
  },
  "trocas-e-devolucoes": {
    title: "Trocas e devoluções",
    description: "Política de trocas e devoluções.",
    body: (s) => [
      "## Direito de arrependimento",
      "Compras feitas pela internet podem ser canceladas em até 7 (sete) dias corridos a partir do recebimento, conforme o art. 49 do Código de Defesa do Consumidor. O produto deve ser devolvido sem uso e na embalagem original, com lacre intacto.",
      "## Produtos com defeito",
      "Se o produto apresentar defeito, entre em contato em até 30 dias após o recebimento. Faremos a análise e, constatado o defeito, realizaremos a troca ou o reembolso.",
      "## Como solicitar",
      `Fale com a nossa equipe ${s.email ? `pelo e-mail ${s.email}` : ""}${s.whatsapp ? ` ou pelo WhatsApp ${s.whatsapp}` : ""}, informando o número do pedido.`,
      "## Reembolso",
      "O reembolso é feito pelo mesmo meio de pagamento utilizado na compra, por meio do Mercado Pago, após o recebimento e a conferência do produto devolvido.",
      "Por questões de higiene, produtos de uso pessoal abertos ou utilizados não podem ser trocados, exceto em caso de defeito.",
    ],
  },
  "politica-de-privacidade": {
    title: "Política de privacidade",
    description: "Como tratamos seus dados pessoais.",
    body: (s) => [
      `Esta política descreve como a ${s.company_name || s.store_name} trata os dados pessoais de clientes, em conformidade com a Lei Geral de Proteção de Dados (Lei 13.709/2018).`,
      "## Dados coletados",
      "Nome, e-mail, telefone, CPF e endereço de entrega, fornecidos por você no cadastro e no checkout, além de dados de navegação essenciais ao funcionamento da loja.",
      "## Finalidade",
      "Processar pedidos e pagamentos, emitir etiquetas de envio, prestar atendimento, cumprir obrigações legais e — somente com seu consentimento — enviar comunicações de marketing.",
      "## Compartilhamento",
      "Compartilhamos apenas o necessário com: Mercado Pago (processamento de pagamentos), SuperFrete/transportadoras (entrega) e Supabase (infraestrutura de banco de dados). Não armazenamos dados de cartão de crédito.",
      "## Seus direitos",
      `Você pode solicitar acesso, correção ou exclusão dos seus dados${s.email ? ` pelo e-mail ${s.email}` : ""}.`,
    ],
  },
  "termos-de-uso": {
    title: "Termos de uso",
    description: "Condições de uso da loja.",
    body: (s) => [
      `Ao utilizar a loja ${s.store_name}, você concorda com estes termos.`,
      "## Pedidos e preços",
      "Os preços e a disponibilidade são confirmados no momento da finalização da compra. O pedido é confirmado somente após a aprovação do pagamento pelo Mercado Pago.",
      "## Pagamento",
      "Aceitamos Pix e cartão de crédito, processados pelo Mercado Pago. Pedidos com Pix não pago no prazo são cancelados automaticamente.",
      "## Entrega",
      "Os prazos de entrega são informados pela transportadora no momento da cotação e começam a contar após a postagem.",
      "## Contato",
      `${s.company_name || s.store_name}${s.cnpj ? ` — CNPJ ${s.cnpj}` : ""}${s.email ? ` — ${s.email}` : ""}.`,
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(PAGES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/institucional/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = PAGES[slug];
  return p ? { title: p.title, description: p.description, alternates: { canonical: `/institucional/${slug}` } } : {};
}

export default async function InstitutionalPage({ params }: PageProps<"/institucional/[slug]">) {
  const { slug } = await params;
  const page = PAGES[slug];
  if (!page) notFound();
  const settings = await getStoreSettings();
  return (
    <article className="container-page max-w-3xl pb-24 pt-12">
      <p className="eyebrow">Institucional</p>
      <h1 className="heading-display mt-3 text-4xl sm:text-5xl">{page.title}</h1>
      <div className="prose-eloah mt-8 text-[15px] text-ink-muted">
        {page.body(settings).map((para, i) =>
          para.startsWith("## ") ? <h2 key={i} className="!text-ink">{para.slice(3)}</h2> : <p key={i}>{para}</p>,
        )}
      </div>
    </article>
  );
}
