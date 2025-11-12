export function Underlined({ children }: { children: React.ReactNode }) {
  return (
    <span className="underline decoration-dashed underline-offset-2 outline-none">
      {children}
    </span>
  );
}
