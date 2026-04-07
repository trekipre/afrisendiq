type ShimmerMetricCardProps = {
  label: string;
  detail?: string;
};

export function ShimmerMetricCard({ label, detail }: ShimmerMetricCardProps) {
  return (
    <div className="rounded-2xl bg-black/20 p-4">
      <div className="text-xs uppercase tracking-[0.18em] text-emerald-200/70">{label}</div>
      <div className="mt-3 animate-pulse">
        <div className="h-6 w-32 rounded-full bg-white/12" />
        <div className="mt-3 h-3 w-44 rounded-full bg-white/8" />
      </div>
      {detail ? <p className="mt-3 text-sm text-emerald-50/62">{detail}</p> : null}
    </div>
  );
}