"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Check, CreditCard, Lock, Pencil } from "lucide-react";
import { useStore } from "@/components/providers/StoreProvider";
import { ShippingOptionsList, useShippingQuote } from "@/components/store/ShippingCalculator";
import { ProductImage } from "@/components/store/ProductImage";
import { Button } from "@/components/ui/Button";
import { PixIcon } from "@/components/ui/SocialIcons";
import { CouponBox } from "../carrinho/CartPageClient";
import { BR_STATES, formatCep, formatCpf, formatPhone, formatPrice, installmentInfo, isValidCpf, onlyDigits } from "@/lib/format";
import type { Address, Profile, ShippingOption } from "@/lib/types";

type Step = 1 | 2 | 3 | 4 | 5 | 6;
const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Identificação" },
  { n: 2, label: "Dados pessoais" },
  { n: 3, label: "Endereço" },
  { n: 4, label: "Frete" },
  { n: 5, label: "Pagamento" },
  { n: 6, label: "Revisão" },
];

interface AddressForm {
  recipient_name: string;
  postal_code: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
}

const emptyAddress: AddressForm = { recipient_name: "", postal_code: "", street: "", number: "", complement: "", district: "", city: "", state: "" };

function StepCard({
  step,
  current,
  title,
  summary,
  onEdit,
  children,
}: {
  step: Step;
  current: Step;
  title: string;
  summary?: ReactNode;
  onEdit?: () => void;
  children: ReactNode;
}) {
  const done = current > step;
  const active = current === step;
  return (
    <section className={`rounded-[var(--radius-card)] border bg-white transition ${active ? "border-lilac-300 shadow-soft" : "border-line"}`}>
      <header className="flex items-center justify-between gap-4 px-5 py-4 sm:px-7">
        <div className="flex items-center gap-3">
          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${done ? "bg-lilac-600 text-white" : active ? "bg-ink text-white" : "bg-cream text-ink-muted"}`}>
            {done ? <Check className="h-4 w-4" /> : step}
          </span>
          <h2 className={`text-[15px] font-semibold ${!active && !done ? "text-ink-muted" : ""}`}>{title}</h2>
        </div>
        {done && onEdit && (
          <button onClick={onEdit} className="flex items-center gap-1.5 text-xs font-semibold text-lilac-700 hover:underline">
            <Pencil className="h-3.5 w-3.5" /> Alterar
          </button>
        )}
      </header>
      {done && summary && <div className="px-5 pb-5 text-sm text-ink-muted sm:px-7 sm:pl-[4.25rem]">{summary}</div>}
      {active && <div className="animate-fade-in border-t border-line px-5 py-6 sm:px-7">{children}</div>}
    </section>
  );
}

export function CheckoutClient({
  email,
  profile,
  addresses,
  maxInstallments,
  paymentsEnabled,
  shippingEnabled,
}: {
  email: string;
  profile: Profile | null;
  addresses: Address[];
  maxInstallments: number;
  paymentsEnabled: boolean;
  shippingEnabled: boolean;
}) {
  const router = useRouter();
  const { cart, cartLoading, refreshCart, installments } = useStore();
  const [step, setStep] = useState<Step>(2);
  const [error, setError] = useState<string | null>(null);

  // Dados pessoais
  const [name, setName] = useState(profile?.full_name ?? "");
  const [cpf, setCpf] = useState(profile?.cpf ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");

  // Endereço
  const [addressId, setAddressId] = useState<string | "new">(addresses[0]?.id ?? "new");
  const [addr, setAddr] = useState<AddressForm>({ ...emptyAddress, recipient_name: profile?.full_name ?? "" });
  const [saveAddress, setSaveAddress] = useState(true);
  const [cepLoading, setCepLoading] = useState(false);

  // Frete / pagamento
  const { quote, data: quoteData, loading: quoting, error: quoteError } = useShippingQuote();
  const [shipping, setShipping] = useState<ShippingOption | null>(null);
  const [method, setMethod] = useState<"pix" | "credit_card">("pix");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);

  const selectedAddress: AddressForm = useMemo(() => {
    if (addressId === "new") return addr;
    const a = addresses.find((x) => x.id === addressId)!;
    return { ...a, complement: a.complement ?? "" };
  }, [addressId, addr, addresses]);

  const shippingPrice = shipping ? shipping.price : 0;
  const total = Math.max(0, (cart?.total_before_shipping ?? 0) + shippingPrice);
  const inst = installmentInfo(total, Math.min(maxInstallments, installments.max), installments.min);

  // Ao mudar o carrinho/cupom, a cotação precisa ser refeita (frete grátis pode mudar)
  const cartSignature = `${cart?.count}-${cart?.total_before_shipping}`;
  const [lastSignature, setLastSignature] = useState(cartSignature);
  if (cartSignature !== lastSignature) {
    setLastSignature(cartSignature);
    if (step > 4) setStep(4);
    setShipping(null);
  }

  const lookupCep = async (raw: string) => {
    const cep = onlyDigits(raw);
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const j = await r.json();
      if (!j.erro) {
        setAddr((a) => ({ ...a, street: j.logradouro || a.street, district: j.bairro || a.district, city: j.localidade || a.city, state: j.uf || a.state }));
      }
    } catch {
      /* preenchimento manual */
    } finally {
      setCepLoading(false);
    }
  };

  const validPersonal = name.trim().split(/\s+/).length >= 2 && isValidCpf(cpf) && onlyDigits(phone).length >= 10;
  const validAddress =
    selectedAddress.recipient_name.trim().length >= 3 &&
    onlyDigits(selectedAddress.postal_code).length === 8 &&
    selectedAddress.street.trim().length >= 2 &&
    selectedAddress.number.trim().length >= 1 &&
    selectedAddress.district.trim().length >= 2 &&
    selectedAddress.city.trim().length >= 2 &&
    /^[A-Z]{2}$/.test(selectedAddress.state);

  const placeOrder = async () => {
    if (!shipping) return;
    setPlacing(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name, cpf, phone },
          address: { ...selectedAddress, postal_code: onlyDigits(selectedAddress.postal_code), phone },
          shipping_service_id: shipping.service_id,
          payment_method: method,
          notes: notes || null,
          save_address: addressId === "new" && saveAddress,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Não foi possível finalizar o pedido.");
      await refreshCart();
      router.push(`/checkout/pedido/${j.order_id}?metodo=${method}`);
    } catch (e) {
      setError((e as Error).message);
      setPlacing(false);
      if (/frete|modalidade/i.test((e as Error).message)) {
        setShipping(null);
        setStep(4);
      }
    }
  };

  if (cartLoading) {
    return <div className="skeleton mt-8 h-96" />;
  }
  if (!cart?.items.length) {
    return (
      <div className="mt-8 rounded-[var(--radius-card)] bg-white p-12 text-center">
        <p className="heading-display text-2xl">Seu carrinho está vazio</p>
        <Link href="/produtos" className="mt-4 inline-block text-sm font-semibold text-lilac-700 underline">
          Ver produtos
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]">
      <div className="space-y-4">
        {(!paymentsEnabled || !shippingEnabled) && (
          <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>
              {!paymentsEnabled && "Os pagamentos online estão sendo configurados. "}
              {!shippingEnabled && "O cálculo de frete está sendo configurado. "}
              Em breve você poderá concluir sua compra por aqui.
            </p>
          </div>
        )}

        {/* Barra de progresso */}
        <ol className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {STEPS.map((s) => (
            <li key={s.n} className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${step === s.n ? "bg-ink text-white" : step > s.n ? "bg-lilac-100 text-lilac-800" : "bg-white text-ink-muted"}`}>
              {s.n}. {s.label}
            </li>
          ))}
          <li className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">7. Confirmação</li>
        </ol>

        <StepCard step={1} current={step} title="Identificação" summary={<>Comprando como <strong className="text-ink">{email}</strong></>}>
          <></>
        </StepCard>

        <StepCard
          step={2}
          current={step}
          title="Dados pessoais"
          onEdit={() => setStep(2)}
          summary={<>{name} · CPF {formatCpf(cpf)} · {formatPhone(phone)}</>}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="c-name">Nome completo</label>
              <input id="c-name" className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </div>
            <div>
              <label className="label" htmlFor="c-cpf">CPF</label>
              <input id="c-cpf" className="field" value={formatCpf(cpf)} onChange={(e) => setCpf(onlyDigits(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" />
              {cpf.length === 11 && !isValidCpf(cpf) && <p className="mt-1 text-xs text-danger">CPF inválido</p>}
            </div>
            <div>
              <label className="label" htmlFor="c-phone">Celular</label>
              <input id="c-phone" className="field" value={formatPhone(phone)} onChange={(e) => setPhone(onlyDigits(e.target.value))} inputMode="tel" autoComplete="tel" placeholder="(00) 00000-0000" />
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-muted">O CPF é exigido para emissão da etiqueta de envio e para pagamentos via Pix.</p>
          <Button className="mt-6" disabled={!validPersonal} onClick={() => setStep(3)}>
            Continuar
          </Button>
        </StepCard>

        <StepCard
          step={3}
          current={step}
          title="Endereço de entrega"
          onEdit={() => setStep(3)}
          summary={
            <>
              {selectedAddress.street}, {selectedAddress.number}
              {selectedAddress.complement ? ` - ${selectedAddress.complement}` : ""} · {selectedAddress.district} · {selectedAddress.city}/{selectedAddress.state} · CEP {formatCep(selectedAddress.postal_code)}
            </>
          }
        >
          {addresses.length > 0 && (
            <div className="mb-5 space-y-2">
              {addresses.map((a) => (
                <label key={a.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 text-sm ${addressId === a.id ? "border-lilac-500 bg-lilac-50" : "border-line"}`}>
                  <input type="radio" name="addr" checked={addressId === a.id} onChange={() => { setAddressId(a.id); setShipping(null); }} className="mt-1 accent-lilac-600" />
                  <span>
                    <strong>{a.label || a.recipient_name}</strong>
                    <span className="block text-ink-muted">
                      {a.street}, {a.number}
                      {a.complement ? ` - ${a.complement}` : ""} · {a.district} · {a.city}/{a.state} · {formatCep(a.postal_code)}
                    </span>
                  </span>
                </label>
              ))}
              <label className={`flex cursor-pointer gap-3 rounded-xl border p-4 text-sm ${addressId === "new" ? "border-lilac-500 bg-lilac-50" : "border-line"}`}>
                <input type="radio" name="addr" checked={addressId === "new"} onChange={() => { setAddressId("new"); setShipping(null); }} className="accent-lilac-600" />
                <strong>Entregar em outro endereço</strong>
              </label>
            </div>
          )}

          {addressId === "new" && (
            <div className="grid gap-4 sm:grid-cols-6">
              <div className="sm:col-span-6">
                <label className="label" htmlFor="a-name">Destinatário</label>
                <input id="a-name" className="field" value={addr.recipient_name} onChange={(e) => setAddr({ ...addr, recipient_name: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="a-cep">CEP {cepLoading && <span className="normal-case text-lilac-600">buscando...</span>}</label>
                <input
                  id="a-cep"
                  className="field"
                  value={formatCep(addr.postal_code)}
                  onChange={(e) => {
                    const v = onlyDigits(e.target.value).slice(0, 8);
                    setAddr({ ...addr, postal_code: v });
                    setShipping(null);
                    if (v.length === 8) void lookupCep(v);
                  }}
                  inputMode="numeric"
                  autoComplete="postal-code"
                  placeholder="00000-000"
                />
              </div>
              <div className="sm:col-span-4">
                <label className="label" htmlFor="a-street">Endereço</label>
                <input id="a-street" className="field" value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} autoComplete="address-line1" />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="a-number">Número</label>
                <input id="a-number" className="field" value={addr.number} onChange={(e) => setAddr({ ...addr, number: e.target.value })} />
              </div>
              <div className="sm:col-span-4">
                <label className="label" htmlFor="a-comp">Complemento</label>
                <input id="a-comp" className="field" value={addr.complement} onChange={(e) => setAddr({ ...addr, complement: e.target.value })} placeholder="Apto, bloco..." />
              </div>
              <div className="sm:col-span-3">
                <label className="label" htmlFor="a-district">Bairro</label>
                <input id="a-district" className="field" value={addr.district} onChange={(e) => setAddr({ ...addr, district: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="a-city">Cidade</label>
                <input id="a-city" className="field" value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} />
              </div>
              <div className="sm:col-span-1">
                <label className="label" htmlFor="a-state">UF</label>
                <select id="a-state" className="field" value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })}>
                  <option value="">--</option>
                  {BR_STATES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-6">
                <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="accent-lilac-600" /> Salvar este endereço na minha conta
              </label>
            </div>
          )}
          <Button
            className="mt-6"
            disabled={!validAddress}
            onClick={() => {
              setShipping(null);
              void quote({ postal_code: selectedAddress.postal_code });
              setStep(4);
            }}
          >
            Continuar
          </Button>
        </StepCard>

        <StepCard
          step={4}
          current={step}
          title="Frete"
          onEdit={() => setStep(4)}
          summary={shipping && <>{shipping.name} ({shipping.carrier}) · até {shipping.delivery_days} dias úteis · {shipping.price === 0 ? "Grátis" : formatPrice(shipping.price)}</>}
        >
          {quoting && <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-14" />)}</div>}
          {quoteError && (
            <div className="rounded-xl bg-red-50 p-4 text-sm text-danger">
              {quoteError}
              <button className="ml-2 font-semibold underline" onClick={() => quote({ postal_code: selectedAddress.postal_code })}>
                Tentar novamente
              </button>
            </div>
          )}
          {!quoting && quoteData && <ShippingOptionsList options={quoteData.options} selected={shipping?.service_id} onSelect={(o) => setShipping(o)} />}
          <Button className="mt-6" disabled={!shipping} onClick={() => setStep(5)}>
            Continuar
          </Button>
        </StepCard>

        <StepCard
          step={5}
          current={step}
          title="Pagamento"
          onEdit={() => setStep(5)}
          summary={method === "pix" ? "Pix" : `Cartão de crédito (até ${inst.count}x)`}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { id: "pix" as const, title: "Pix", text: "Aprovação imediata. QR Code gerado após confirmar.", Icon: PixIcon },
              { id: "credit_card" as const, title: "Cartão de crédito", text: `Em até ${inst.count}x de ${formatPrice(inst.value)}`, Icon: CreditCard },
            ].map(({ id, title, text, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMethod(id)}
                className={`flex gap-3 rounded-2xl border p-5 text-left transition ${method === id ? "border-lilac-500 bg-lilac-50 ring-2 ring-lilac-100" : "border-line hover:border-lilac-300"}`}
              >
                <Icon className="h-6 w-6 shrink-0 text-lilac-700" />
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="mt-0.5 block text-xs text-ink-muted">{text}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-ink-muted">
            <Lock className="h-3.5 w-3.5" /> Pagamento processado com segurança pelo Mercado Pago. Não armazenamos dados do seu cartão.
          </p>
          <Button className="mt-6" onClick={() => setStep(6)}>
            Revisar pedido
          </Button>
        </StepCard>

        <StepCard step={6} current={step} title="Revisão">
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="rounded-xl bg-cream p-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Cliente</dt>
              <dd className="mt-1">{name}<br />{email}<br />CPF {formatCpf(cpf)} · {formatPhone(phone)}</dd>
            </div>
            <div className="rounded-xl bg-cream p-4">
              <dt className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Entrega</dt>
              <dd className="mt-1">
                {selectedAddress.recipient_name}
                <br />
                {selectedAddress.street}, {selectedAddress.number} {selectedAddress.complement}
                <br />
                {selectedAddress.district} · {selectedAddress.city}/{selectedAddress.state} · {formatCep(selectedAddress.postal_code)}
                <br />
                {shipping?.name} · até {shipping?.delivery_days} dias úteis
              </dd>
            </div>
          </dl>
          <div className="mt-4">
            <label className="label" htmlFor="notes">Observações (opcional)</label>
            <textarea id="notes" className="field min-h-20" maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">{error}</p>}
          <Button size="lg" className="mt-6 w-full sm:w-auto" loading={placing} disabled={!paymentsEnabled || !shipping || cart.has_issues} onClick={placeOrder}>
            <Lock className="h-4 w-4" /> Confirmar pedido e ir para o pagamento
          </Button>
          <p className="mt-3 text-xs text-ink-muted">Ao confirmar, os preços, o estoque e o frete são validados novamente.</p>
        </StepCard>
      </div>

      {/* Resumo */}
      <aside className="h-fit rounded-[var(--radius-card)] border border-line bg-white p-6 lg:sticky lg:top-36">
        <h2 className="heading-display text-2xl">Resumo do pedido</h2>
        <ul className="mt-5 max-h-72 space-y-4 overflow-y-auto pr-1">
          {cart.items.map((i) => (
            <li key={i.id} className="flex gap-3">
              <div className="relative aspect-[4/5] w-14 shrink-0 overflow-hidden rounded-lg bg-cream">
                <ProductImage src={i.image} alt={i.name} sizes="56px" />
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-ink px-1 text-[10px] font-bold text-white">{i.quantity}</span>
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="line-clamp-2 leading-snug">{i.name}</p>
                {i.variant_name && <p className="text-xs text-ink-muted">{i.variant_name}</p>}
                {i.issue && <p className="text-xs font-semibold text-danger">{i.issue}</p>}
              </div>
              <span className="text-sm font-medium">{formatPrice(i.line_total)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 border-t border-line pt-5">
          <CouponBox />
          {cart.coupon_error && <p className="mt-2 text-xs text-danger">{cart.coupon_error}</p>}
        </div>
        <dl className="mt-5 space-y-2.5 text-sm">
          <div className="flex justify-between"><dt className="text-ink-muted">Subtotal</dt><dd>{formatPrice(cart.subtotal)}</dd></div>
          {cart.discount > 0 && <div className="flex justify-between text-success"><dt>Desconto ({cart.coupon?.code})</dt><dd>-{formatPrice(cart.discount)}</dd></div>}
          <div className="flex justify-between"><dt className="text-ink-muted">Frete</dt><dd>{shipping ? (shipping.price === 0 ? "Grátis" : formatPrice(shipping.price)) : "—"}</dd></div>
          <div className="flex justify-between border-t border-line pt-3 text-base font-bold"><dt>Total</dt><dd>{formatPrice(total)}</dd></div>
          {method === "credit_card" && inst.count > 1 && <p className="text-right text-xs text-ink-muted">ou {inst.count}x de {formatPrice(inst.value)}</p>}
        </dl>
      </aside>
    </div>
  );
}
