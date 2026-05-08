import type { Metadata } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'

import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-cormorant',
  display: 'swap',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-dm-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Total Bali — Reservations CRM',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${cormorant.variable}`}>
      <body style={{ fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
