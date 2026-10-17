export function IntegrationNotice({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="mt-7 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <p className="text-xs font-medium uppercase tracking-wider text-[#d5ad63]">Account integration pending</p>
      <h2 className="mt-3 text-lg font-medium">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">{description}</p>
    </section>
  );
}
