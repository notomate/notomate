// JSON-valued node attribute that survives HTML copy/paste as a data-* attribute.
export const jsonAttribute = (name: string, fallback: unknown) => ({
  default: fallback,
  parseHTML: (el: HTMLElement) => {
    try { return JSON.parse(el.getAttribute(`data-${name}`) ?? 'null') ?? fallback } catch { return fallback }
  },
  renderHTML: (attrs: Record<string, unknown>) => ({ [`data-${name}`]: JSON.stringify(attrs[name] ?? fallback) }),
})
