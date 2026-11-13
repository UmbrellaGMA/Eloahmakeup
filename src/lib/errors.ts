/** Erro de domínio com mensagem segura para exibir ao usuário. */
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "APP_ERROR",
  ) {
    super(message);
  }
}

/**
 * Converte exceções do Postgres levantadas pelas funções do banco
 * (formato "CODIGO: mensagem") em mensagens amigáveis.
 */
export function fromDbError(error: { message?: string; code?: string } | null | undefined, fallback = "Não foi possível concluir a operação.") {
  const msg = error?.message ?? "";
  const match = msg.match(/^([A-Z_]+):\s*([\s\S]+)$/);
  if (match) return new AppError(match[2].trim(), 409, match[1]);
  if (error?.code === "42501") return new AppError("Operação não permitida.", 403, "FORBIDDEN");
  if (error?.code === "23505") return new AppError("Registro duplicado.", 409, "DUPLICATE");
  return new AppError(fallback, 500, "INTERNAL");
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.status });
  }
  console.error("[api] erro inesperado", error);
  return Response.json({ error: "Erro interno. Tente novamente em instantes.", code: "INTERNAL" }, { status: 500 });
}
