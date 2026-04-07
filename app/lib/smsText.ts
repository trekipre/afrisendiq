const ASCII_REPLACEMENTS: Array<[RegExp, string]> = [
  [/œ/g, "oe"],
  [/Œ/g, "OE"],
  [/æ/g, "ae"],
  [/Æ/g, "AE"],
  [/’|‘|`/g, "'"],
  [/“|”/g, '"'],
  [/–|—/g, "-"],
  [/\u00A0|\u202F/g, " "],
]

export function toAsciiSmsText(value: string) {
  let normalized = value

  for (const [pattern, replacement] of ASCII_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement)
  }

  return normalized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x00-\x7F]/g, "")
}