/** A My Account card (design: 20px-radius surface, title + one-line intro, then its content). */
export function AccountCard({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-cc-xl border border-cc-line bg-cc-surface p-5">
      <div>
        <h2 className="m-0 text-[18px] font-extrabold tracking-[-0.3px]">{title}</h2>
        {intro ? <p className="m-0 mt-1 text-[13px] leading-[1.5] text-cc-lavender">{intro}</p> : null}
      </div>
      {children}
    </section>
  );
}
