const SectionHeader = ({ eyebrow, title, description, className = "" }) => {
  return (
    <header className={`space-y-2 ${className}`}>
      {eyebrow && (
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-600">{eyebrow}</p>
      )}
      {title && (
        <h2 className="text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">{title}</h2>
      )}
      {description && (
        <p className="max-w-xl text-xs text-neutral-500 sm:text-sm">{description}</p>
      )}
    </header>
  );
};

export default SectionHeader;
