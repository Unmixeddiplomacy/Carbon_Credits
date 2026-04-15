const Input = ({ id, label, type = "text", className = "", ...props }) => {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-neutral-700">
          {label}
        </label>
      )}
      <input
        id={id}
        type={type}
        className={`block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none ring-0 transition focus:border-neutral-900 ${className}`}
        {...props}
      />
    </div>
  );
};

export default Input;
