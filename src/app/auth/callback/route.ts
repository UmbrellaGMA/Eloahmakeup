import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { mergeGuestCart } from "@/lib/cart";
import { safeNextPath } from "@/lib/safe";

export const dynamic = "force-dynamic";

function safeNext(next: string | null) {
  return safeNextPath(next);
}

/**
 * Callback do Supabase Auth: confirmação de e-mail, recuperação de senha
 * (PKCE "code" ou "token_hash"). Une o carrinho de visitante à conta.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const supabase = await createClient();

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  }

  if (!ok) {
    return NextResponse.redirect(new URL("/entrar?erro=link", url.origin));
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) await mergeGuestCart(user.id).catch(() => undefined);
  const dest = type === "recovery" ? "/redefinir-senha" : next;
  return NextResponse.redirect(new URL(dest, url.origin));
}
