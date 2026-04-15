export default function PageContainer({ children, className = "" }) {
  return (
    <div className={"mx-auto w-full max-w-6xl " + className}>{children}</div>
  );
}
