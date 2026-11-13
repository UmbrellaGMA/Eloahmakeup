import Image from "next/image";
import { LogoSymbol } from "@/components/brand/Logo";

/** Imagem de produto com placeholder da marca quando ainda não há foto. */
export function ProductImage({
  src,
  alt,
  sizes = "(max-width: 768px) 50vw, 25vw",
  priority,
  className = "object-cover",
}: {
  src: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  if (!src) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[radial-gradient(120%_90%_at_30%_10%,#f0e9fb_0%,#f8f5fd_45%,#fbfaf8_100%)]">
        <LogoSymbol className="h-12 w-12 opacity-40" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-lilac-700/60">Foto em breve</span>
      </div>
    );
  }
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={className} />;
}
