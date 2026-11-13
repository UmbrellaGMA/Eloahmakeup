"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { BR_STATES, formatCep, formatCpf, formatPhone, onlyDigits } from "@/lib/format";
import type { Address, Profile } from "@/lib/types";
import { deleteAddress, saveAddress, setDefaultAddress, updateProfile, type FormState } from "./actions";

function Msg({ state }: { state: FormState }) {
  if (!state?.error && !state?.success) return null;
  return <p className={`rounded-xl px-4 py-3 text-sm ${state.error ? "bg-red-50 text-danger" : "bg-emerald-50 text-success"}`}>{state.error ?? state.success}</p>;
}

export function ProfileForm({ profile, email }: { profile: Profile | null; email: string }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  const [cpf, setCpf] = useState(profile?.cpf ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  return (
    <form action={action} className="max-w-xl space-y-5">
      <Msg state={state} />
      <div>
        <label className="label">E-mail</label>
        <input className="field" value={email} disabled />
      </div>
      <div>
        <label className="label" htmlFor="full_name">Nome completo</label>
        <input id="full_name" name="full_name" className="field" defaultValue={profile?.full_name ?? ""} required />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="cpf">CPF</label>
          <input id="cpf" name="cpf" className="field" value={formatCpf(cpf)} onChange={(e) => setCpf(onlyDigits(e.target.value))} inputMode="numeric" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Celular</label>
          <input id="phone" name="phone" className="field" value={formatPhone(phone)} onChange={(e) => setPhone(onlyDigits(e.target.value))} inputMode="tel" />
        </div>
        <div>
          <label className="label" htmlFor="birth_date">Data de nascimento</label>
          <input id="birth_date" name="birth_date" type="date" className="field" defaultValue={profile?.birth_date ?? ""} />
        </div>
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" name="accepts_marketing" defaultChecked={profile?.accepts_marketing} className="h-4 w-4 accent-lilac-600" />
        Quero receber novidades e ofertas por e-mail
      </label>
      <Button type="submit" loading={pending}>Salvar alterações</Button>
    </form>
  );
}

export function AddressForm({ address, onDone }: { address?: Address; onDone?: () => void }) {
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await saveAddress(prev, fd);
    if (r?.success) onDone?.();
    return r;
  }, undefined);
  const [cep, setCep] = useState(address?.postal_code ?? "");
  const [fields, setFields] = useState({
    street: address?.street ?? "",
    district: address?.district ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
  });

  const lookup = async (v: string) => {
    if (v.length !== 8) return;
    try {
      const j = await (await fetch(`https://viacep.com.br/ws/${v}/json/`)).json();
      if (!j.erro) setFields((f) => ({ street: j.logradouro || f.street, district: j.bairro || f.district, city: j.localidade || f.city, state: j.uf || f.state }));
    } catch {
      /* manual */
    }
  };

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-6">
      {address && <input type="hidden" name="id" value={address.id} />}
      <div className="sm:col-span-6"><Msg state={state} /></div>
      <div className="sm:col-span-2">
        <label className="label">Identificação</label>
        <input name="label" className="field" placeholder="Casa, trabalho..." defaultValue={address?.label ?? ""} />
      </div>
      <div className="sm:col-span-4">
        <label className="label">Destinatário</label>
        <input name="recipient_name" className="field" required defaultValue={address?.recipient_name ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">CEP</label>
        <input
          name="postal_code"
          className="field"
          required
          inputMode="numeric"
          value={formatCep(cep)}
          onChange={(e) => {
            const v = onlyDigits(e.target.value).slice(0, 8);
            setCep(v);
            void lookup(v);
          }}
        />
      </div>
      <div className="sm:col-span-4">
        <label className="label">Endereço</label>
        <input name="street" className="field" required value={fields.street} onChange={(e) => setFields({ ...fields, street: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Número</label>
        <input name="number" className="field" required defaultValue={address?.number ?? ""} />
      </div>
      <div className="sm:col-span-4">
        <label className="label">Complemento</label>
        <input name="complement" className="field" defaultValue={address?.complement ?? ""} />
      </div>
      <div className="sm:col-span-3">
        <label className="label">Bairro</label>
        <input name="district" className="field" required value={fields.district} onChange={(e) => setFields({ ...fields, district: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Cidade</label>
        <input name="city" className="field" required value={fields.city} onChange={(e) => setFields({ ...fields, city: e.target.value })} />
      </div>
      <div className="sm:col-span-1">
        <label className="label">UF</label>
        <select name="state" className="field" required value={fields.state} onChange={(e) => setFields({ ...fields, state: e.target.value })}>
          <option value="">--</option>
          {BR_STATES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-6">
        <input type="checkbox" name="is_default" defaultChecked={address?.is_default} className="accent-lilac-600" /> Usar como endereço padrão
      </label>
      <div className="sm:col-span-6">
        <Button type="submit" loading={pending}>Salvar endereço</Button>
      </div>
    </form>
  );
}

export function AddressManager({ addresses }: { addresses: Address[] }) {
  const [editing, setEditing] = useState<string | "new" | null>(addresses.length ? null : "new");
  return (
    <div className="space-y-4">
      {addresses.map((a) =>
        editing === a.id ? (
          <div key={a.id} className="card p-6">
            <AddressForm address={a} onDone={() => setEditing(null)} />
          </div>
        ) : (
          <div key={a.id} className="card flex flex-wrap items-start justify-between gap-4 p-5">
            <div className="text-sm">
              <p className="font-semibold">
                {a.label || a.recipient_name} {a.is_default && <span className="ml-2 rounded-full bg-lilac-100 px-2 py-0.5 text-[10px] font-bold uppercase text-lilac-800">Padrão</span>}
              </p>
              <p className="mt-1 text-ink-muted">
                {a.recipient_name} · {a.street}, {a.number}{a.complement ? ` - ${a.complement}` : ""} · {a.district} · {a.city}/{a.state} · {formatCep(a.postal_code)}
              </p>
            </div>
            <div className="flex gap-3 text-xs font-semibold">
              <button onClick={() => setEditing(a.id)} className="text-lilac-700 hover:underline">Editar</button>
              {!a.is_default && (
                <form action={setDefaultAddress}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="text-ink-muted hover:underline">Tornar padrão</button>
                </form>
              )}
              <form action={deleteAddress}>
                <input type="hidden" name="id" value={a.id} />
                <button className="text-danger hover:underline">Excluir</button>
              </form>
            </div>
          </div>
        ),
      )}
      {editing === "new" ? (
        <div className="card p-6">
          <AddressForm onDone={() => setEditing(null)} />
        </div>
      ) : (
        <Button variant="outline" onClick={() => setEditing("new")}>+ Adicionar endereço</Button>
      )}
    </div>
  );
}
