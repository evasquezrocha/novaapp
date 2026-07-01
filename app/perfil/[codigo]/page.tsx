import { promises as fs } from "node:fs";
import path from "node:path";
import { notFound } from "next/navigation";
import { getPerfilTpPublicRowByCodigo } from "@/lib/perfiles-tp-sql";

export const dynamic = "force-dynamic";

type VCardData = {
  displayName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  url: string | null;
  raw: string | null;
};

function safeText(value: string | null | undefined) {
  return value?.trim() || null;
}

function normalizePhone(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  const digits = trimmed.replace(/[^\d+]/g, "");
  return digits || trimmed;
}

function buildWhatsAppLink(phone: string | null) {
  if (!phone) {
    return null;
  }

  const digits = phone.replace(/[^\d]/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function normalizeWebsite(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function parseVCard(content: string): VCardData {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const unfold: string[] = [];

  for (const line of lines) {
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (unfold.length > 0) {
        unfold[unfold.length - 1] += line.slice(1);
      }
      continue;
    }

    unfold.push(line);
  }

  const getValue = (prefix: string) => {
    const line = unfold.find((entry) => entry.toUpperCase().startsWith(prefix));
    if (!line) {
      return null;
    }

    return line.slice(line.indexOf(":") + 1).replace(/\\n/g, "\n").trim() || null;
  };

  const displayName = getValue("FN") ?? getValue("N");
  const email = getValue("EMAIL");
  const phone = getValue("TEL");
  const url = getValue("URL");
  const adr = unfold.find((entry) => entry.toUpperCase().startsWith("ADR"));
  const address = adr
    ? adr
        .slice(adr.indexOf(":") + 1)
        .split(";")
        .map((part) => part.replace(/\\n/g, " ").trim())
        .filter(Boolean)
        .join(", ") || null
    : null;

  return {
    displayName,
    email,
    phone,
    address,
    url,
    raw: content,
  };
}

async function readVCardFromContacto(contacto: string | null) {
  if (!contacto) {
    return null;
  }

  if (contacto.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), "public", contacto.replace(/^\//, ""));
    const content = await fs.readFile(filePath, "utf8");
    return parseVCard(content);
  }

  if (contacto.includes("BEGIN:VCARD")) {
    return parseVCard(contacto);
  }

  return null;
}

function IconWhatsApp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-5 w-5">
      <path
        d="M20.5 11.9c0 4.7-3.8 8.5-8.5 8.5-1.5 0-3-.4-4.3-1.1L3.5 21l1.7-4.1A8.4 8.4 0 0 1 3.5 12c0-4.7 3.8-8.5 8.5-8.5s8.5 3.8 8.5 8.4Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 8.8c.2-.4.4-.4.6-.4h.6c.2 0 .4 0 .5.3l.7 1.7c.1.2.1.4 0 .6l-.4.6c-.1.2-.1.4 0 .6.2.4 1 1.5 2.1 2.1.2.1.4.1.6 0l.7-.4c.2-.1.4-.1.6 0l1.7.7c.2.1.3.3.3.5v.6c0 .2 0 .4-.4.6-.3.3-.8.5-1.3.5-2.3 0-6.1-3.8-6.1-6.1 0-.5.2-1 .5-1.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconPhone() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-5 w-5">
      <path
        d="M7.5 4.5h2l1.4 4.1-1.7 1.7c.9 1.9 2.4 3.4 4.3 4.3l1.7-1.7 4.1 1.4v2c0 1-0.8 1.8-1.8 1.8C10.8 18.1 5.9 13.2 5.9 7c0-1 .8-2.5 1.6-2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-5 w-5">
      <path
        d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconMap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-5 w-5">
      <path
        d="M12 21s6-4.5 6-10a6 6 0 1 0-12 0c0 5.5 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M12 13.5A2.5 2.5 0 1 0 12 8.5a2.5 2.5 0 0 0 0 5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-5 w-5">
      <path
        d="M4.5 6.5h15A1.5 1.5 0 0 1 21 8v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16V8A1.5 1.5 0 0 1 4.5 6.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="m4.5 8.5 7.5 5 7.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="h-4 w-4">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ActionButton({
  href,
  icon,
  children,
  external = false,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:-translate-y-0.5 hover:border-[#ff9200]/40 hover:shadow-md"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#fff3e0] text-[#b45309]">
        {icon}
      </span>
      <span className="flex-1 text-left text-sm font-semibold text-slate-900">{children}</span>
      <span className="text-slate-400">
        <ChevronRightIcon />
      </span>
    </a>
  );
}

export default async function PerfilCodigoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const perfil = await getPerfilTpPublicRowByCodigo(codigo);

  if (!perfil) {
    notFound();
  }

  const contacto = perfil.Contacto ?? "";
  const isVCard = contacto.includes("BEGIN:VCARD") || contacto.endsWith(".vcf");
  const vCardData = await readVCardFromContacto(isVCard ? contacto : null);

  const displayName = safeText(vCardData?.displayName) ?? safeText(perfil.Nombre) ?? perfil.Empresa;
  const phone = safeText(perfil.Telefono) ?? safeText(vCardData?.phone);
  const whatsapp = safeText(perfil.WhatsApp) ?? phone;
  const website = normalizeWebsite(safeText(perfil.Web) ?? safeText(vCardData?.url));
  const email = safeText(vCardData?.email);
  const address = safeText(vCardData?.address);
  const mapUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;
  const whatsappLink = buildWhatsAppLink(whatsapp ?? null);
  const telLink = phone ? `tel:${normalizePhone(phone)}` : null;
  const mailLink = email ? `mailto:${encodeURIComponent(email)}` : null;
  const vCardHref = isVCard
    ? contacto.startsWith("/uploads/")
      ? contacto
      : `data:text/vcard;charset=utf-8,${encodeURIComponent(contacto)}`
    : null;
  const logoSrc = perfil.Logo?.startsWith("/uploads/") ? perfil.Logo : perfil.Logo || null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#fff7ed_0%,_#fffaf2_35%,_#f8fafc_100%)] px-4 py-6 sm:px-6 sm:py-10">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[520px] items-center justify-center">
        <div className="w-full rounded-[2rem] border border-white/70 bg-white/90 p-4 shadow-[0_30px_90px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-5">
          <div className="overflow-hidden rounded-[1.65rem] bg-gradient-to-b from-white to-[#fffaf4]">
            <div className="px-5 pb-5 pt-6 sm:px-6 sm:pt-7">
              <div className="flex justify-center">
                <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm sm:h-40 sm:w-40">
                  {logoSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoSrc} alt={perfil.Empresa} className="h-full w-full object-contain p-2" />
                  ) : (
                    <div className="px-3 text-center text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">
                      {perfil.Empresa.slice(0, 2)}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 text-center">
                <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                  {displayName}
                </h1>
                <p className="mt-2 text-sm text-slate-600">{perfil.Empresa}</p>
              </div>

              <div className="mt-5">
                {vCardHref ? (
                  <a
                    href={vCardHref}
                    download={contacto.startsWith("/uploads/") ? undefined : `${perfil.Empresa}.vcf`}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-[#ff9200] px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(255,146,0,0.28)] transition hover:bg-[#f28a00]"
                  >
                    Guardar contacto
                  </a>
                ) : null}
              </div>

              <div className="mt-5 space-y-3">
                {whatsappLink ? (
                  <ActionButton href={whatsappLink} icon={<IconWhatsApp />} external>
                    Enviar WhatsApp
                  </ActionButton>
                ) : null}

                {telLink ? (
                  <ActionButton href={telLink} icon={<IconPhone />}>
                    Llamar por teléfono
                  </ActionButton>
                ) : null}

                {website ? (
                  <ActionButton href={website} icon={<IconGlobe />} external>
                    Abrir sitio web
                  </ActionButton>
                ) : null}

                {mapUrl ? (
                  <ActionButton href={mapUrl} icon={<IconMap />} external>
                    Abrir dirección en mapa
                  </ActionButton>
                ) : null}

                {mailLink ? (
                  <ActionButton href={mailLink} icon={<IconMail />}>
                    Enviar correo
                  </ActionButton>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
