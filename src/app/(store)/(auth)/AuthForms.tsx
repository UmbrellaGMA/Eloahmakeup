"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatPhone } from "@/lib/format";
import { requestPasswordReset, signIn, signUp, updatePassword, type AuthState } from "./actions";

function Alert({ state }: { state: AuthState }) {
  if (!state?.error && !state?.success) return null;
  return (
    <p role="status" className={`rounded-xl px-4 py-3 text-sm ${state.error ? "bg-red-50 text-danger" : "bg-emerald-50 text-success"}`}>
      {state.error ?? state.success}
    </p>
  );
}

function PasswordInput({ name, autoComplete, label = "Senha" }: { name: string; autoComplete: string; label?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={name}>{label}</label>
      <div className="relative">
        <input id={name} name={name} type={show ? "text" : "password"} required autoComplete={autoComplete} className="field pr-12" />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-muted" aria-label={show ? "Ocultar senha" : "Mostrar senha"}>
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function LoginForm({ next, linkError }: { next: string; linkError?: boolean }) {
  const [state, action, pending] = useActionState(signIn, linkError ? { error: "Link inválido ou expirado. Tente novamente." } : undefined);
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <Alert state={state} />
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="field" />
      </div>
      <PasswordInput name="password" autoComplete="current-password" />
      <div className="text-right">
        <Link href="/recuperar-senha" className="text-sm font-medium text-lilac-700 hover:underline">Esqueci minha senha</Link>
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>Entrar</Button>
      <p className="text-center text-sm text-ink-muted">
        Ainda não tem conta?{" "}
        <Link href={`/cadastro?next=${encodeURIComponent(next)}`} className="font-semibold text-ink hover:text-lilac-700">Criar conta</Link>
      </p>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUp, undefined);
  const [phone, setPhone] = useState("");
  if (state?.success) return <Alert state={state} />;
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <Alert state={state} />
      <div>
        <label className="label" htmlFor="full_name">Nome completo</label>
        <input id="full_name" name="full_name" required autoComplete="name" className="field" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Celular</label>
          <input id="phone" name="phone" value={formatPhone(phone)} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" className="field" placeholder="(00) 00000-0000" />
        </div>
      </div>
      <PasswordInput name="password" autoComplete="new-password" />
      <p className="-mt-3 text-xs text-ink-muted">Mínimo de 8 caracteres, com letras e números.</p>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="terms" required className="mt-0.5 h-4 w-4 accent-lilac-600" />
        <span>Li e aceito os <Link href="/institucional/termos-de-uso" className="underline">termos de uso</Link> e a <Link href="/institucional/politica-de-privacidade" className="underline">política de privacidade</Link>.</span>
      </label>
      <label className="flex items-start gap-3 text-sm text-ink-muted">
        <input type="checkbox" name="accepts_marketing" className="mt-0.5 h-4 w-4 accent-lilac-600" />
        Quero receber novidades e ofertas por e-mail.
      </label>
      <Button type="submit" size="lg" className="w-full" loading={pending}>Criar minha conta</Button>
      <p className="text-center text-sm text-ink-muted">
        Já tem conta? <Link href={`/entrar?next=${encodeURIComponent(next)}`} className="font-semibold text-ink hover:text-lilac-700">Entrar</Link>
      </p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  return (
    <form action={action} className="space-y-5">
      <Alert state={state} />
      <div>
        <label className="label" htmlFor="email">E-mail cadastrado</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="field" />
      </div>
      <Button type="submit" size="lg" className="w-full" loading={pending}>Enviar link de recuperação</Button>
      <p className="text-center text-sm"><Link href="/entrar" className="font-semibold hover:text-lilac-700">Voltar para o login</Link></p>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="space-y-5">
      <Alert state={state} />
      <PasswordInput name="password" autoComplete="new-password" label="Nova senha" />
      <PasswordInput name="confirm" autoComplete="new-password" label="Confirme a nova senha" />
      <Button type="submit" size="lg" className="w-full" loading={pending}>Salvar nova senha</Button>
    </form>
  );
}
