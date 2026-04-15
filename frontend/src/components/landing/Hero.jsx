import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const Hero = () => {
  const { isAuthenticated } = useAuth();
  const primaryTo = isAuthenticated ? "/dashboard" : "/signup";
  const primaryLabel = isAuthenticated ? "Go to dashboard" : "Get started";
  return (
    <section className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-white">
      <div className="absolute -top-28 -left-28 h-64 w-64 rounded-full bg-emerald-500/10 blur-2xl" />
      <div className="absolute -bottom-28 -right-20 h-72 w-72 rounded-full bg-neutral-900/5 blur-2xl" />

      <div className="relative z-10 flex flex-col gap-6 px-6 py-10 sm:px-10 sm:py-14 lg:py-16">
        <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[11px] font-medium text-emerald-700">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Tree‑backed carbon credits • Transparent ownership
        </div>

        <h1 className="text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl lg:text-5xl">
          Build your carbon portfolio with real trees.
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-neutral-600 sm:text-base">
          Tokenize trees you plant, trade ownership with confidence, and
          retire credits against emissions — all in one clean, professional
          marketplace.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={primaryTo}
            className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
          >
            {primaryLabel}
          </Link>
          <Link
            to="/marketplace"
            className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-5 py-2.5 text-sm font-medium text-neutral-800 transition hover:border-neutral-900"
          >
            Explore marketplace
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Hero;
