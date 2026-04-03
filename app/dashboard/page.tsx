import { createClient } from '@/lib/supabase-server'

const metrics = [
  { val: '24', label: 'Active projects', delta: '+3 this week', accent: true },
  { val: '112', label: 'Published', delta: '+8 this month', accent: false },
  { val: '7', label: 'In review', delta: '2 pending', accent: false },
  { val: '5', label: 'Active members', delta: 'Full team', accent: false },
]

const recentProjects = [
  { type: 'PDF', name: 'Institutional report Q2 2025', team: 'Marketing', status: 'Published', statusStyle: 'text-green-700 bg-green-50 border-green-200' },
  { type: 'PPT', name: 'Investor presentation', team: 'Ana Lima', status: 'In progress', statusStyle: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  { type: 'LOGO', name: 'Rebranding — logo variations', team: 'Logo Studio', status: 'In review', statusStyle: 'text-red-700 bg-red-50 border-red-200' },
  { type: 'IMG', name: 'Visual campaign — product launch', team: 'Carlos Reis', status: 'In progress', statusStyle: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
]

const typeStyles: Record<string, string> = {
  PDF: 'text-orange-700 bg-orange-50 border-orange-200',
  PPT: 'text-green-700 bg-green-50 border-green-200',
  IMG: 'text-blue-700 bg-blue-50 border-blue-200',
  LOGO: 'text-yellow-700 bg-yellow-50 border-yellow-200',
}

const workspaces = [
  { key: 'T', label: 'Team area', desc: 'Shared projects, reviews, collaboration', count: '3 active', accent: true, href: '/dashboard/team' },
  { key: 'P', label: 'Publication', desc: 'Approved content visible to everyone', count: '12 items', accent: false, href: '/dashboard/publication' },
  { key: 'M', label: 'My workspace', desc: 'Personal drafts and private projects', count: '5 drafts', accent: false, href: '/dashboard/workspace' },
]

const quickCreate = [
  { label: 'New PDF', href: '/dashboard/pdf', accent: false },
  { label: 'New PPT', href: '/dashboard/presentations', accent: false },
  { label: 'New image', href: '/dashboard/images', accent: false },
  { label: 'Logo studio', href: '/dashboard/logo-studio', accent: true },
]

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const firstName = user?.email?.split('@')[0] ?? 'there'

  return (
    <div className="flex flex-col flex-1">
      {/* Topbar */}
      <div className="bg-white border-b border-gray-200 flex items-center justify-between px-7 py-4">
        <div>
          <div className="text-xs text-gray-400 tracking-widest uppercase">AU Studio</div>
          <div className="font-bebas text-2xl text-aurum-black tracking-wide">Dashboard</div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Hello, {firstName}</span>
          <a href="/dashboard/pdf" className="btn-outline text-xs">+ New project</a>
        </div>
      </div>

      <div className="p-7 flex-1">
        {/* Metrics */}
        <div className="grid grid-cols-4 gap-3 mb-7">
          {metrics.map(m => (
            <div key={m.label} className={`bg-white border border-gray-200 p-4 border-t-2 ${m.accent ? 'border-t-aurum-yellow' : 'border-t-aurum-black'}`}>
              <div className="font-bebas text-3xl text-aurum-black leading-none">{m.val}</div>
              <div className="text-xs text-gray-400 tracking-wider uppercase mt-1">{m.label}</div>
              <div className="text-xs text-green-600 mt-2">{m.delta}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-5">
          {/* Left col */}
          <div className="col-span-2 flex flex-col gap-5">
            {/* Workspaces */}
            <div>
              <div className="section-label">Workspaces</div>
              <div className="flex flex-col gap-2">
                {workspaces.map(w => (
                  <a key={w.label} href={w.href}
                    className={`bg-white border border-gray-200 p-4 flex items-center gap-4 hover:border-aurum-black transition-colors
                      ${w.accent ? 'border-l-4 border-l-aurum-yellow' : ''}`}>
                    <div className={`w-9 h-9 flex items-center justify-center flex-shrink-0 font-bebas text-sm tracking-wide
                      ${w.accent ? 'bg-aurum-yellow text-aurum-black' : 'bg-aurum-black text-white'}`}>
                      {w.key}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-aurum-black">{w.label}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{w.desc}</div>
                    </div>
                    <div className="text-xs text-aurum-yellow font-medium">{w.count}</div>
                  </a>
                ))}
              </div>
            </div>

            {/* Recent projects */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="section-label mb-0">Recent projects</div>
                <span className="text-xs text-aurum-yellow font-medium cursor-pointer">View all</span>
              </div>
              <div className="flex flex-col gap-2">
                {recentProjects.map(p => (
                  <div key={p.name} className="bg-white border border-gray-200 px-4 py-3 flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-1 border tracking-wide flex-shrink-0 ${typeStyles[p.type]}`}>
                      {p.type}
                    </span>
                    <span className="flex-1 text-sm text-aurum-black">{p.name}</span>
                    <span className="text-xs text-gray-400">{p.team}</span>
                    <span className={`text-xs px-2 py-1 border flex-shrink-0 ${p.statusStyle}`}>
                      {p.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right col */}
          <div className="flex flex-col gap-5">
            {/* AU insights */}
            <div className="bg-white border border-gray-200 p-4">
              <div className="section-label">AU Insights</div>
              <div className="flex flex-col divide-y divide-gray-100">
                {[
                  { title: 'Investor deck', text: 'Add data visuals to slides 4 and 7 for stronger impact.' },
                  { title: 'Logo review', text: '2 variations ready. Color contrast passes WCAG AA.' },
                  { title: 'Q2 report', text: 'Published and accessed 34 times this week.' },
                ].map(item => (
                  <div key={item.title} className="py-2.5 flex gap-2.5 items-start">
                    <div className="w-1.5 h-1.5 rounded-full bg-aurum-yellow flex-shrink-0 mt-1.5" />
                    <div className="text-xs text-gray-500 leading-relaxed">
                      <span className="font-medium text-aurum-black">{item.title}</span> — {item.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick create */}
            <div className="bg-white border border-gray-200 p-4">
              <div className="section-label">Quick create</div>
              <div className="grid grid-cols-2 gap-2">
                {quickCreate.map(q => (
                  <a key={q.label} href={q.href}
                    className={`border p-3 text-xs font-medium text-center cursor-pointer transition-all
                      ${q.accent
                        ? 'border-aurum-yellow bg-yellow-50 text-yellow-800 hover:bg-aurum-yellow hover:text-aurum-black'
                        : 'border-gray-200 text-gray-500 hover:border-aurum-black hover:text-aurum-black'
                      }`}>
                    {q.label}
                  </a>
                ))}
              </div>
            </div>

            {/* Color identifier */}
            <div className="bg-white border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="section-label mb-0">Brand colors</div>
                <span className="text-xs bg-aurum-yellow text-aurum-black px-2 py-0.5 font-medium">Use anywhere</span>
              </div>
              {[
                { name: 'AU Yellow', hex: '#F5C842', bg: '#F5C842', text: '#0A0A0A' },
                { name: 'Studio Black', hex: '#0A0A0A', bg: '#0A0A0A', text: '#F5C842' },
                { name: 'Pure White', hex: '#FFFFFF', bg: '#FFFFFF', text: '#0A0A0A', border: true },
                { name: 'Surface', hex: '#F7F7F5', bg: '#F7F7F5', text: '#0A0A0A', border: true },
              ].map(c => (
                <div key={c.name} className="flex items-center gap-3 mb-2">
                  <div className={`w-8 h-8 flex-shrink-0 ${c.border ? 'border border-gray-200' : ''}`}
                    style={{ background: c.bg }} />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-aurum-black">{c.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{c.hex}</div>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(c.hex)}
                    className="text-xs text-aurum-yellow font-medium hover:underline"
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
