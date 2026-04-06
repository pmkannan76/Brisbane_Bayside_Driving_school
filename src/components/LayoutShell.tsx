'use client'

import { usePathname } from 'next/navigation'
import { Navbar } from './Navbar'
import { Footer } from './Footer'

export function LayoutShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const isAdmin = pathname?.startsWith('/admin')

    return (
        <>
            {!isAdmin && <Navbar />}
            <main className={`flex-grow ${!isAdmin ? 'pt-20' : ''}`}>
                {children}
            </main>
            {!isAdmin && <Footer />}
        </>
    )
}
