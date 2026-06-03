import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, getSessionUserByToken } from "@/lib/auth-sql";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (token) {
    const session = await getSessionUserByToken(token);
    if (session) {
      redirect("/");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-slate-200 bg-slate-950 p-8 text-white shadow-2xl shadow-slate-900/20">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-orange-300">
            NovaApp
          </p>
          <h1 className="mt-6 max-w-xl text-4xl font-semibold tracking-tight">
            Acceso seguro a producción, bodega y administración.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
            Ingresa con tu usuario y contraseña para abrir el panel de
            operación.
          </p>
        </div>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
            Inicio de sesión
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Bienvenido
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Usa tu usuario de la tabla <span className="font-medium">Usuarios</span>.
          </p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
