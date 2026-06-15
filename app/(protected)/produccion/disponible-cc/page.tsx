import { DisponibleCcClient } from "./disponible-cc-client";

export default function DisponibleCcPage() {
  return (
    <section className="grid gap-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mt-8">
          <DisponibleCcClient />
        </div>
      </div>
    </section>
  );
}
