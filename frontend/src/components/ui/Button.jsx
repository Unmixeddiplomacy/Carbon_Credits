const variants = {
  primary:
    "inline-flex items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm transition hover:bg-emerald-600",
  outline:
    "inline-flex items-center justify-center rounded-full border border-neutral-300 text-neutral-800 transition hover:border-neutral-900",
  neutral:
    "inline-flex items-center justify-center rounded-full bg-neutral-100 text-neutral-800 transition hover:bg-neutral-200",
};

const sizes = {
  sm: "px-4 py-2 text-xs",
  md: "px-5 py-2.5 text-sm",
};

const Button = ({ variant = "primary", size = "md", className = "", children, ...props }) => {
  return (
    <button {...props} className={`${variants[variant]} ${sizes[size]} ${className}`}>
      {children}
    </button>
  );
};

export default Button;
