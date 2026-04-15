const Footer = () => {
  return (
    <footer className="border-t border-neutral-200 bg-white/80">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-4 text-xs text-neutral-500 sm:flex-row sm:px-6">
        <p>
          © {new Date().getFullYear()} Carbon Market. All rights reserved.
        </p>
        <p className="flex gap-3">
          <span>Secure carbon credit ownership</span>
          <span className="hidden sm:inline">•</span>
          <span>Transparent tree-backed assets</span>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
