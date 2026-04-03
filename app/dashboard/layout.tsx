import Sidebar from '@/components/layout/Sidebar'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen bg-aurum-surface">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>
    </div>
  )
}
```

Actually that's the same file — the issue is in the **Sidebar** component. Open this file:
```
C:\Users\luca2\OneDrive\Documents\GitHub\AU-Studio\components\layout\Sidebar.tsx