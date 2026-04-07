import { resolveLocalizedText, type LocalizedText } from "@/app/components/CoteDIvoireLocale"

type CoteDIvoireSectionHeadingProps = {
  eyebrow?: LocalizedText
  title: LocalizedText
  description?: LocalizedText
  locale: "fr" | "en"
  align?: "left" | "center"
}

export function CoteDIvoireSectionHeading({
  eyebrow,
  title,
  description,
  locale,
  align = "left"
}: CoteDIvoireSectionHeadingProps) {
  const alignmentClass = align === "center" ? "text-center items-center" : "text-left items-start"

  return (
    <div className={`flex flex-col gap-3 ${alignmentClass}`}>
      {eyebrow ? (
        <div className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-200/84 backdrop-blur">
          {resolveLocalizedText(eyebrow, locale)}
        </div>
      ) : null}
      <div>
        <h2 className="text-2xl font-semibold leading-tight text-white md:text-3xl">
          {resolveLocalizedText(title, locale)}
        </h2>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-7 text-emerald-50/74">
            {resolveLocalizedText(description, locale)}
          </p>
        ) : null}
      </div>
    </div>
  )
}