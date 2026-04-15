import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const CTASection = () => {
  const { isAuthenticated } = useAuth();
  const primaryTo = isAuthenticated ? "/dashboard" : "/signup";
  const primaryLabel = isAuthenticated ? "Go to dashboard" : "Get started";
  return (
    <section className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-6 py-5 text-center sm:flex-row sm:text-left">
      <div>
        <p className="text-sm font-semibold text-neutral-900">Ready to plant and trade?</p>
        <p className="text-[11px] text-neutral-500">Create your account and start building your carbon portfolio.</p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          to={primaryTo}
          className="inline-flex items-center justify-center rounded-full bg-emerald-500 px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600"
        >
          {primaryLabel}
        </Link>
        {!isAuthenticated ? (
          <Link
            to="/login"
            className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-5 py-2 text-xs font-medium text-neutral-800 transition hover:border-neutral-900"
          >
            I already have an account
          </Link>
        ) : (
          <Link
            to="/marketplace"
            className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-5 py-2 text-xs font-medium text-neutral-800 transition hover:border-neutral-900"
          >
            Explore marketplace
          </Link>
        )}
      </div>
    </section>
  );
};

export default CTASection;
