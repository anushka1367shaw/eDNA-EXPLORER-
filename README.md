# eDNA Explorer

**Tagline:** Discover • Identify • Conserve

Full-stack scientific bioinformatics platform for environmental DNA (eDNA) dataset validation, taxonomic identification, ecological biodiversity indexing, AI-assisted scientific interpretation, and PDF/CSV reporting.

## Architecture Overview

- **Frontend:** React, TypeScript, Tailwind CSS v4, Lucide Icons, Recharts, jsPDF.
- **User Identity & Application Database:** Firebase Authentication (Email/Password + Google Sign-In + Email Verification), Cloud Firestore (`users`, `projects`, `notifications`, `userPreferences`, `adminAuditLogs`, `admins`, `announcements`), Firebase Storage (`storage.rules`).
- **Scientific Datasets & Analysis Storage:** Supabase PostgreSQL (`supabase/schema.sql`, `supabase/rls_policies.sql`), Supabase Storage (`edna-datasets`), and Supabase Edge Function (`supabase/edge-functions/process-edna/index.ts`), with a built-in Local Research Sandbox when Supabase credentials are not yet configured.
- **AI Scientific Assistant:** Server-side Google Gemini API (`@google/genai`, `gemini-4-hydrogen`) grounded strictly in actual dataset metrics and taxonomic findings.

## Setup Instructions

### 1. Environment Variables
Configure secrets in your hosting environment / AI Studio **Settings > Secrets**:
- `GEMINI_API_KEY`: Server-side Google Gemini API key.
- `SUPABASE_URL`: Your Supabase project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: Server-side Supabase service role key (never expose to browser).
- `ADMIN_EMAIL`: Optional administrator email override.

### 2. Firebase Configuration
- Ensure **Google** and **Email/Password** providers are enabled in **Firebase Console > Authentication > Sign-in method**.
- Deploy `firestore.rules` and `storage.rules` to your Firebase project.
- To grant administrator privileges manually, add the user's UID document under `/admins/{uid}` in Firestore or assign Firebase custom claim `admin: true` using a trusted backend script.

### 3. Supabase PostgreSQL & Edge Function Setup
1. Open your Supabase SQL Editor and run `supabase/schema.sql`.
2. Apply Row Level Security policies by running `supabase/rls_policies.sql`.
3. Optionally deploy the server-side biodiversity Edge Function:
   ```bash
   supabase functions deploy process-edna
   ```

### 4. Local Development & Production Build
```bash
npm install
npm run dev       # Starts Express + Vite on port 3000
npm run build     # Builds production frontend bundle
npm start         # Runs production Express server on port 3000
```
