"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

export function Newsletter() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [msg, setMsg] = useState("");

  return (
    <section className="relative overflow-hidden bg-ink">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-lilac-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-lilac-400/20 blur-3xl" />
      <div className="container-page relative grid items-center gap-8 py-16 md:grid-cols-2 md:py-20">
        <div>
          <p className="eyebrow !text-lilac-300">Clube Eloah</p>
          <h2 className="heading-display mt-3 text-3xl !text-white sm:text-[2.6rem]">
            Novidades e ofertas <em className="text-lilac-300">antes de todo mundo</em>
          </h2>
          <p className="mt-3 max-w-md text-sm text-white/65">Receba lançamentos, cupons exclusivos e dicas de maquiagem no seu e-mail.</p>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setState("loading");
            const res = await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
            const j = await res.json().catch(() => ({}));
            if (res.ok) {
              setState("ok");
              setMsg("Pronto! Você está no Clube Eloah ✦");
              setEmail("");
            } else {
              setState("error");
              setMsg(j.error ?? "Não foi possível cadastrar agora.");
            }
          }}
          className="w-full"
        >
          <div className="flex rounded-full bg-white/10 p-1.5 ring-1 ring-white/15 focus-within:ring-lilac-300">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Seu melhor e-mail"
              aria-label="E-mail"
              className="min-w-0 flex-1 bg-transparent px-5 text-sm text-white outline-none placeholder:text-white/50"
            />
            <button disabled={state === "loading"} className="flex h-12 items-center gap-2 rounded-full bg-lilac-400 px-6 text-sm font-semibold text-ink transition hover:bg-lilac-300 disabled:opacity-60">
              Quero participar <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {msg && <p className={`mt-3 text-sm ${state === "ok" ? "text-lilac-200" : "text-red-300"}`}>{msg}</p>}
        </form>
      </div>
    </section>
  );
}
