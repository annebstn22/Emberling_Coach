# Minimalist Writing Assistant

A dual-tool writing ecosystem featuring Pre-Writing Ideation (inspired by Oblique Strategies) and a structured Writing Coach with AI-powered task breakdown and personalized coaching.

## Features

### Pre-Writing Ideation Tool
- Creative strategy cards for brainstorming
- Timer-based ideation sessions
- File upload support for reference materials
- Comparative judgment system for ranking ideas
- Island of Misfit Ideas collection

### Writing Coach Tool
- AI-powered task generation from project descriptions
- Personalized coaching personalities (Normal, Baymax, Edna)
- Stage-based quality expectations (Outline, First Draft, Revisions)
- Task breakdown and duration customization
- Progress tracking with word count and time metrics
- 5-minute micro-tasks for quick writing sessions

## Tech Stack

- **Framework**: Next.js 14.2.35
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **File Storage**: Vercel Blob
- **AI**: Vercel AI SDK with OpenAI GPT-4o-mini
- **Authentication**: Supabase Auth

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js 18.x or higher
- npm or yarn package manager
- Git

## Local Setup Instructions

### 1. Clone the Repository

\`\`\`bash
git clone <your-repo-url>
cd <your-project-directory>
\`\`\`

### 2. Install Dependencies

\`\`\`bash
npm install
# or
yarn install
\`\`\`

### 3. Set Up Environment Variables

Create a `.env.local` file in the root directory with the following variables:

\`\`\`bash
# Supabase Database Configuration
POSTGRES_URL="your-postgres-url"
POSTGRES_PRISMA_URL="your-postgres-prisma-url"
POSTGRES_URL_NON_POOLING="your-postgres-url-non-pooling"
POSTGRES_USER="your-postgres-user"
POSTGRES_PASSWORD="your-postgres-password"
POSTGRES_DATABASE="your-postgres-database"
POSTGRES_HOST="your-postgres-host"

# Supabase Configuration
SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
SUPABASE_ANON_KEY="your-supabase-anon-key"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-supabase-service-role-key"
SUPABASE_JWT_SECRET="your-supabase-jwt-secret"

# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN="your-blob-read-write-token"

# AI Configuration (Optional - uses Vercel AI Gateway by default)
GOOGLE_GENERATIVE_AI_API_KEY="your-google-ai-key"
\`\`\`

### 4. Obtain Integration Credentials

#### Supabase Setup

1. **Create a Supabase Project**:
   - Go to [https://supabase.com](https://supabase.com)
   - Click "New Project"
   - Fill in your project details

2. **Get Your Credentials**:
   - Navigate to Project Settings > API
   - Copy the following:
     - `Project URL` → `SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_URL`
     - `anon/public key` → `SUPABASE_ANON_KEY` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`
   
   - Navigate to Project Settings > Database
   - Copy the connection string → `POSTGRES_URL`
   - Modify for other variants:
     - Add `?pgbouncer=true` for `POSTGRES_PRISMA_URL`
     - Add `?pgbouncer=true&connection_limit=1` for pooling connections

3. **Enable Authentication**:
   - Go to Authentication > Providers
   - Enable "Email" provider
   - Configure email templates if desired

4. **Set Up Database Tables** (Optional):
   - The app will work with Supabase Auth out of the box
   - For Pre-Writing Ideation features, you may need to create custom tables
   - Use the Supabase SQL Editor to run migrations if needed

#### Vercel Blob Setup

1. **Create a Vercel Project** (if not already done):
   - Go to [https://vercel.com](https://vercel.com)
   - Import your repository or create a new project

2. **Enable Blob Storage**:
   - Navigate to your project on Vercel
   - Go to Storage > Create Database
   - Select "Blob" storage
   - Click "Create"

3. **Get Your Token**:
   - After creation, copy the `BLOB_READ_WRITE_TOKEN`
   - Add it to your `.env.local` file

#### AI SDK Configuration

The app uses Vercel AI Gateway by default, which doesn't require additional API keys. If you want to use Google Gemini directly:

1. Go to [https://makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Add it as `GOOGLE_GENERATIVE_AI_API_KEY` in your `.env.local`

### 5. Run the Development Server

\`\`\`bash
npm run dev
# or
yarn dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser to see the app.

### 6. Build for Production

\`\`\`bash
npm run build
npm start
# or
yarn build
yarn start
\`\`\`

## Project Structure

\`\`\`
├── app/
│   ├── api/              # API routes for AI endpoints
│   ├── layout.tsx        # Root layout with font configuration
│   ├── page.tsx          # Main application (tool routing)
│   └── globals.css       # Global styles and design tokens
├── components/
│   ├── ui/               # shadcn/ui components
│   ├── pre-writing-ideation.tsx    # Pre-Writing tool
│   ├── file-upload.tsx             # File upload component
│   ├── comparative-judgment.tsx    # Ranking system
│   └── island-of-misfits.tsx       # Misfit ideas collection
├── lib/
│   └── utils.ts          # Utility functions
└── public/               # Static assets
\`\`\`

## Key Features & Usage

### Writing Coach

1. **Create a Project**: Enter a project name and description
2. **AI Task Generation**: Tasks are automatically generated based on your description
3. **Choose Duration**: Use the slider to set your writing session (5-60 minutes)
4. **Break Down Tasks**: Click "Break into Smaller Chunks" to divide complex tasks
5. **Select Coach Personality**: Choose Normal, Baymax, or Edna for different coaching styles
6. **Write**: Complete tasks with real-time word count and progress tracking
7. **Get Feedback**: Receive AI-powered feedback tailored to your writing stage

### Pre-Writing Ideation

1. **Start Session**: Click "Pre-Writing Ideation" from tool selection
2. **Draw Cards**: Get random creative strategy prompts
3. **Capture Ideas**: Add ideas with notes and file attachments
4. **Rank Ideas**: Use comparative judgment to identify strongest concepts
5. **Manage Misfits**: Save discarded ideas to the Island of Misfits for future inspiration

## Deployment

### Deploy to Vercel

The easiest way to deploy is using Vercel:

1. Push your code to GitHub
2. Import your repository on [Vercel](https://vercel.com)
3. Vercel will auto-detect Next.js
4. Add all environment variables in Project Settings > Environment Variables
5. Deploy

### Environment Variables on Vercel

Make sure to add all the environment variables from your `.env.local` file to your Vercel project settings. You can do this via:

- Vercel Dashboard > Project > Settings > Environment Variables
- Or use the Vercel CLI: `vercel env add`

## Troubleshooting

### Supabase Connection Issues

- Verify all Supabase environment variables are correct
- Check that your database is active in the Supabase dashboard
- Ensure Row Level Security (RLS) policies are properly configured

### Blob Storage Issues

- Confirm `BLOB_READ_WRITE_TOKEN` is set correctly
- Check file size limits (default: 10MB)
- Verify Vercel Blob storage is enabled for your project

### AI API Rate Limits

- If using Google Gemini, check your API quota
- The app defaults to Vercel AI Gateway (OpenAI) which has higher limits
- Consider upgrading your AI provider plan if needed

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add some feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

## License

This project is private and proprietary.

## Support

For issues or questions:
- Check existing documentation
- Review troubleshooting section
- Open an issue in the repository
