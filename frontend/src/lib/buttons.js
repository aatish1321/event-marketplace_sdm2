// One button system for the marketing pages: two sizes, paper and dark surfaces.
const base = 'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2'

export const buttonLg = `${base} h-14 px-7 text-base`
export const buttonMd = `${base} h-11 px-5 text-sm`

export const onPaper = {
  primary: 'bg-accent text-white hover:bg-accent/90',
  secondary: 'border border-ink/20 bg-transparent text-ink hover:border-ink hover:bg-ink hover:text-white',
}
export const onDark = {
  primary: 'bg-white text-ink hover:bg-white/90',
}
