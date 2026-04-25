interface Crumb {
  label: string;
  href?: string;
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-[11px] mb-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span style={{ color: 'var(--text-muted)' }}>/</span>}
          {item.href ? (
            <a href={item.href} className="hover:text-heading transition-colors" style={{ color: 'var(--text-muted)' }}>{item.label}</a>
          ) : (
            <span className="text-heading font-medium">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
