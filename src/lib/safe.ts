/**
 * Utilitários de segurança compartilhados (cliente e servidor).
 */

/**
 * Aceita somente caminhos internos para redirecionar após login/cadastro.
 * Bloqueia "//site", "/\site" (o navegador trata "\" como "/") e caracteres de controle.
 */
export function safeNextPath(value: unknown, fallback = "/conta") {
  if (typeof value !== "string" || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    // Confirma que o destino continua no próprio site
    const url = new URL(value, "https://eloahmakeup.local");
    if (url.origin !== "https://eloahmakeup.local") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

/** Serializa JSON-LD para <script> sem permitir fechar a tag ("</script>"). */
export function jsonLd(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}
