import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'CIVITAS | Smart Traffic 3D',
  description: 'Simulateur interactif de carrefour intelligent avec détection, traversées piétonnes et véhicules prioritaires.'
};
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) {
  return <html lang="fr"><body cz-shortcut-listen="true">{children}</body></html>;
}
