/** Remonté à chaque changement de page, contrairement à layout.tsx : c'est ce qui rejoue l'entrée. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
