# AU Studio — Internal Creative Hub

## Stack
- **Frontend**: Next.js 14 (App Router) + TypeScript + Tailwind CSS
- **Auth + DB + Storage**: Supabase
- **AI Analysis**: Anthropic Claude
- **Image Generation**: Replicate (Flux)
- **Background Removal**: Remove.bg
- **Deploy**: Netlify

---

## Setup Instructions

### 1. Clone the repo
```bash
git clone https://github.com/lucaott-jpg/au-studio.git
cd au-studio
npm install
```

### 2. Set up Supabase
1. Go to your Supabase project dashboard
2. Open the **SQL Editor**
3. Paste the entire contents of `supabase-schema.sql` and run it
4. This creates all tables, RLS policies, and storage buckets

### 3. Environment variables
Copy `.env.example` to `.env.local` and fill in your keys:
```bash
cp .env.example .env.local
```

Then edit `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://wqkatdcaqygnmnbealqg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
ANTHROPIC_API_KEY=your_anthropic_key
REPLICATE_API_TOKEN=your_replicate_token
REMOVEBG_API_KEY=your_removebg_key
```

### 4. Run locally
```bash
npm run dev
```
Open http://localhost:3000

### 5. Deploy to Netlify
1. Push to GitHub
2. Go to app.netlify.com → New site → Import from GitHub
3. Select your repo
4. Build settings are auto-detected from `netlify.toml`
5. Go to **Site settings → Environment variables** and add all 5 keys
6. Deploy!

---

## Create your first user
Since there's no public signup, create users directly in Supabase:
1. Go to **Supabase dashboard → Authentication → Users**
2. Click **Add user**
3. Enter email + password
4. That user can now log in at your Netlify URL

---

## Project structure
```
au-studio/
├── app/
│   ├── login/               # Login page
│   ├── dashboard/           # Protected dashboard
│   │   ├── page.tsx         # Main dashboard
│   │   ├── logo-studio/     # Logo + background removal
│   │   ├── presentations/   # PPT creation + Claude
│   │   └── images/          # Image generation (Replicate)
│   └── api/
│       ├── remove-bg/       # Remove.bg API route
│       ├── analyze-brief/   # Claude API route
│       └── generate-image/  # Replicate API route
├── components/
│   └── layout/Sidebar.tsx
├── lib/
│   ├── supabase-browser.ts
│   └── supabase-server.ts
├── types/index.ts
├── supabase-schema.sql      # Run this in Supabase SQL editor
└── netlify.toml
```
