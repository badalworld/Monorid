import type {Metadata} from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Monorid | Autonomous MEXC Futures Quant System',
  description: 'Autonomous high-frequency MEXC Futures algorithmic engine. Copyright and developed by Trading Lifestyle Quant.',
  openGraph: {
    title: 'Monorid | Autonomous MEXC Futures Quant System',
    description: 'Autonomous high-frequency MEXC Futures algorithmic engine. Copyright and developed by Trading Lifestyle Quant.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Monorid | Autonomous MEXC Futures Quant System',
    description: 'Autonomous high-frequency MEXC Futures algorithmic engine. Copyright and developed by Trading Lifestyle Quant.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#050811] text-slate-100 min-h-screen antialiased selection:bg-cyan-500/30 selection:text-cyan-200" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
