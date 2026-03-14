import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Book a Call | Schedule Your Consultation',
  description:
    'Book a call with us to discuss your project. Choose from 15-minute intro calls, 30-minute consultations, or 60-minute strategy sessions.',
  keywords: ['book a call', 'consultation', 'schedule meeting', 'strategy session'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
