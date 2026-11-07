import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-[1000] border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden className="text-xl">🍱</span>
          <span>Leftovers</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link href="/about" className="rounded-md px-3 py-2 text-muted hover:text-fg">
            How it works
          </Link>
          <Link
            href="/post"
            className="rounded-full bg-brand px-4 py-2 font-medium text-brand-fg shadow-sm hover:opacity-90"
          >
            + Post food
          </Link>
        </nav>
      </div>
    </header>
  );
}
