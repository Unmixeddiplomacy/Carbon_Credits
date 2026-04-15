const Card = ({ className = "", children }) => {
  return (
    <div className={`rounded-2xl border border-neutral-200 bg-white px-6 py-8 shadow-sm sm:px-8 ${className}`}>
      {children}
    </div>
  );
};

export default Card;
