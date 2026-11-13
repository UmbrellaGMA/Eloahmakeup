/** Ícones de redes sociais (traço simples, sem marcas registradas coloridas). */
export function InstagramIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.4" cy="6.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function FacebookIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <path d="M14.5 8H17V4.5h-2.5A3.5 3.5 0 0 0 11 8v2.5H8.5V14H11v6.5h3.5V14H17l.5-3.5h-3V8.6c0-.35.25-.6.5-.6Z" strokeLinejoin="round" />
    </svg>
  );
}

export function TikTokIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <path d="M14 3.5v11.3a3.7 3.7 0 1 1-3.2-3.67M14 3.5c.4 2.6 2.2 4.4 5 4.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <path d="M4 20l1.2-3.9A8.2 8.2 0 1 1 8 19l-4 1Z" strokeLinejoin="round" />
      <path d="M9.2 8.6c.2-.5.5-.5.8-.5h.5c.2 0 .4 0 .5.4l.7 1.6c.1.2 0 .4-.1.6l-.5.6c-.1.1-.2.3 0 .5.3.5.8 1.1 1.3 1.5.5.4 1 .7 1.4.9.2.1.4 0 .5-.1l.6-.7c.2-.2.3-.2.6-.1l1.5.7c.3.1.3.3.3.5 0 .5-.2 1.1-.6 1.4-.5.4-1.2.6-2 .4-1-.2-2.3-.8-3.5-1.9-1.2-1.1-2-2.4-2.3-3.4-.2-.8 0-1.4.3-1.9Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PixIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={className} aria-hidden>
      <path d="M12 2.8 21.2 12 12 21.2 2.8 12 12 2.8Z" strokeLinejoin="round" />
      <path d="M7.5 9.2 10.3 12l-2.8 2.8M16.5 9.2 13.7 12l2.8 2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
