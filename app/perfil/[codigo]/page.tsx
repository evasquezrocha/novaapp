import Link from "next/link";
import { notFound } from "next/navigation";
import { getPerfilTpRowByCodigo } from "@/lib/perfiles-tp-sql";

export const dynamic = "force-dynamic";

export default async function PerfilCodigoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const perfil = await getPerfilTpRowByCodigo(codigo);

  if (!perfil) {
    notFound();
  }

  const contacto = perfil.Contacto ?? "";
  const isVCard = contacto.includes("BEGIN:VCARD") || contacto.endsWith(".vcf");
  const contactoHref = isVCard
    ? contacto.startsWith("/uploads/")
      ? contacto
      : `data:text/vcard;charset=utf-8,${encodeURIComponent(contacto)}`
    : null;

  return (
    <main className="min-h-screen bg-gradient-to-br from-white via-[#fff7ed] to-[#fef3c7] px-6 py-10">
      <section className="mx-auto grid min-h-[80vh] max-w-5xl items-center">
        <div className="overflow-hidden rounded-[2rem] border border-[#fed7aa] bg-white shadow-[0_30px_80px_rgba(180,83,9,0.12)]">
          <div className="grid gap-8 p-8 lg:grid-cols-[240px_1fr] lg:p-10">
            <div className="flex items-start justify-center">
              <div className="flex h-48 w-48 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                {perfil.Logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={perfil.Logo}
                    alt={perfil.Empresa}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="px-4 text-center text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                    Sin logo
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.34em] text-[#b45309]">
                Vista publica
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
                {perfil.Empresa}
              </h1>
              <p className="mt-2 text-lg text-slate-600">{perfil.Nombre}</p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {perfil.Contacto ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Contacto
                    </p>
                    {isVCard ? (
                      <>
                        <p className="mt-2 text-sm font-medium text-slate-900">vCard disponible</p>
                        {contactoHref ? (
                          <a
                            href={contactoHref}
                            download={contacto.startsWith("/uploads/") ? undefined : `${perfil.Empresa}.vcf`}
                            className="mt-3 inline-flex rounded-full border border-[#b45309] px-3 py-2 text-sm font-semibold text-[#b45309] transition hover:bg-[#fff7ed]"
                          >
                            Descargar vCard
                          </a>
                        ) : null}
                      </>
                    ) : (
                      <p className="mt-2 text-sm font-medium text-slate-900">{perfil.Contacto}</p>
                    )}
                  </div>
                ) : null}

                {perfil.WhatsApp ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      WhatsApp
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{perfil.WhatsApp}</p>
                  </div>
                ) : null}

                {perfil.Telefono ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Telefono
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{perfil.Telefono}</p>
                  </div>
                ) : null}

                {perfil.Web ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Web
                    </p>
                    <a
                      href={perfil.Web}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 block text-sm font-medium text-[#b45309] underline-offset-4 hover:underline"
                    >
                      {perfil.Web}
                    </a>
                  </div>
                ) : null}

                {perfil.Instagram ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Instagram
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{perfil.Instagram}</p>
                  </div>
                ) : null}

                {perfil.LinkedIn ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      LinkedIn
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{perfil.LinkedIn}</p>
                  </div>
                ) : null}

                {perfil.Transferencia ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Transferencia
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-900">{perfil.Transferencia}</p>
                  </div>
                ) : null}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
                  Codigo: {perfil.CodigoAleatorio}
                </span>
                <Link
                  href="/perfil"
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Volver a Perfil
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
