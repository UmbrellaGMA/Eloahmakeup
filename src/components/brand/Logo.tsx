import Image from "next/image";

/**
 * Logotipo oficial Eloah Make Up (arquivos em /public/brand).
 * - logo-lilas: versão principal, fundos claros
 * - logo-preta: alternativa monocromática para fundos claros
 * - logo-branca: fundos escuros
 * - simbolo-*: o "E" com o traço, para ícones e espaços reduzidos
 */
const LOGO = { dark: "/brand/logo-lilas.svg", black: "/brand/logo-preta.svg", light: "/brand/logo-branca.svg" } as const;
const SYMBOL = { dark: "/brand/simbolo-lilas.svg", black: "/brand/simbolo-preto.svg", light: "/brand/simbolo-branco.svg" } as const;

type Tone = keyof typeof LOGO;

export function LogoSymbol({ className = "h-10 w-10", tone = "dark" }: { className?: string; tone?: Tone }) {
  return (
    <Image
      src={SYMBOL[tone]}
      alt="Eloah Make Up"
      width={951}
      height={764}
      unoptimized
      className={`object-contain ${className}`}
    />
  );
}

export function Logo({
  className = "",
  tone = "dark",
  size = "md",
  priority,
}: {
  className?: string;
  tone?: Tone;
  /** mantido por compatibilidade; o logotipo já inclui o símbolo */
  showSymbol?: boolean;
  size?: "sm" | "md" | "lg";
  priority?: boolean;
}) {
  const h = { sm: "h-9", md: "h-11", lg: "h-16" }[size];
  return (
    <Image
      src={LOGO[tone]}
      alt="Eloah Make Up"
      width={1263}
      height={422}
      unoptimized
      priority={priority}
      className={`w-auto ${h} ${className}`}
    />
  );
}
