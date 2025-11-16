# Database and Deployment Setup Guide

## Overview

This document outlines the setup for deploying the email-cms newsletter viewer application with a complete backend infrastructure, including database, authentication, and hosting.

## Table of Contents

1. [Technology Stack](#technology-stack)
2. [Database Setup with Supabase](#database-setup-with-supabase)
3. [Authentication System](#authentication-system)
4. [Deployment to Zeabur](#deployment-to-zeabur)
5. [Multi-Device Support](#multi-device-support)
6. [Environment Configuration](#environment-configuration)
7. [Security Considerations](#security-considerations)

---

## Technology Stack

### Frontend
- **Framework**: React 18 + TypeScript 5
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS

### Backend & Database
- **Database**: PostgreSQL (via Supabase)
- **Backend**: Supabase (self-hosted option available)
- **Authentication**: Supabase Auth

### Hosting
- **Platform**: Zeabur
- **Region**: Choose based on target audience location

---

## Database Setup with Supabase

### Option 1: Supabase Cloud (Recommended for Getting Started)

#### Pros
- Zero infrastructure management
- Automatic backups and updates
- Built-in monitoring and analytics
- Free tier available (500MB database, 50K monthly active users)
- Easy scaling

#### Cons
- Data stored on Supabase servers
- Limited customization
- Costs scale with usage

#### Setup Steps

1. **Create Supabase Project**
   ```bash
   # Visit https://supabase.com
   # Click "New Project"
   # Choose organization and project name
   # Select region (closest to your users)
   # Generate and save database password
   ```

2. **Install Supabase Client**
   ```bash
   npm install @supabase/supabase-js
   ```

3. **Get Project Credentials**
   - Navigate to Project Settings > API
   - Copy `Project URL` and `anon public` key
   - Store in environment variables

### Option 2: Self-Hosted Supabase (For Full Control)

#### Pros
- Complete data control and privacy
- Customizable infrastructure
- No vendor lock-in
- Potentially lower costs at scale

#### Cons
- Requires infrastructure management
- Need to handle backups, updates, security patches
- More complex initial setup

#### Setup Steps

1. **Prerequisites**
   - Docker and Docker Compose installed
   - At least 2GB RAM available
   - Domain name for production deployment

2. **Clone Supabase**
   ```bash
   git clone --depth 1 https://github.com/supabase/supabase
   cd supabase/docker
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env

   # Edit .env file with your settings:
   # - POSTGRES_PASSWORD=your_secure_password
   # - JWT_SECRET=your_jwt_secret (generate with: openssl rand -base64 32)
   # - ANON_KEY=your_anon_key (generate via Supabase docs)
   # - SERVICE_ROLE_KEY=your_service_key
   # - SITE_URL=https://yourdomain.com
   ```

4. **Start Supabase Services**
   ```bash
   docker-compose up -d
   ```

5. **Access Services**
   - Studio (Dashboard): http://localhost:3000
   - API: http://localhost:8000
   - PostgreSQL: localhost:5432

### Database Schema

Create the following tables in Supabase SQL Editor:

```sql
-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'reader' CHECK (role IN ('reader', 'editor', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create newsletter_weeks table
CREATE TABLE public.newsletter_weeks (
  week_number TEXT PRIMARY KEY,  -- Format: "2025-W43"
  release_date DATE NOT NULL,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id)
);

-- Create articles table
CREATE TABLE public.articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,  -- Markdown content
  author TEXT,
  week_number TEXT REFERENCES public.newsletter_weeks(week_number) ON DELETE CASCADE,
  article_order INTEGER NOT NULL,
  public_url TEXT,
  is_published BOOLEAN DEFAULT false,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id),
  UNIQUE(week_number, article_order)
);

-- Create indexes for performance
CREATE INDEX idx_articles_week ON public.articles(week_number, article_order);
CREATE INDEX idx_articles_published ON public.articles(is_published, week_number);
CREATE INDEX idx_newsletter_published ON public.newsletter_weeks(is_published, release_date DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for newsletter_weeks
CREATE POLICY "Published newsletters are viewable by everyone"
  ON public.newsletter_weeks FOR SELECT
  USING (is_published = true OR auth.uid() IN (
    SELECT id FROM public.profiles WHERE role IN ('editor', 'admin')
  ));

CREATE POLICY "Editors can insert newsletters"
  ON public.newsletter_weeks FOR INSERT
  WITH CHECK (auth.uid() IN (
    SELECT id FROM public.profiles WHERE role IN ('editor', 'admin')
  ));

CREATE POLICY "Editors can update newsletters"
  ON public.newsletter_weeks FOR UPDATE
  USING (auth.uid() IN (
    SELECT id FROM public.profiles WHERE role IN ('editor', 'admin')
  ));

-- RLS Policies for articles
CREATE POLICY "Published articles are viewable by everyone"
  ON public.articles FOR SELECT
  USING (is_published = true OR auth.uid() IN (
    SELECT id FROM public.profiles WHERE role IN ('editor', 'admin')
  ));

CREATE POLICY "Editors can insert articles"
  ON public.articles FOR INSERT
  WITH CHECK (auth.uid() IN (
    SELECT id FROM public.profiles WHERE role IN ('editor', 'admin')
  ));

CREATE POLICY "Editors can update articles"
  ON public.articles FOR UPDATE
  USING (auth.uid() IN (
    SELECT id FROM public.profiles WHERE role IN ('editor', 'admin')
  ));

CREATE POLICY "Editors can delete articles"
  ON public.articles FOR DELETE
  USING (auth.uid() IN (
    SELECT id FROM public.profiles WHERE role IN ('editor', 'admin')
  ));

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_newsletter_weeks_updated_at
  BEFORE UPDATE ON public.newsletter_weeks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## Authentication System

### Supabase Auth Configuration

Supabase Auth provides:
- Google OAuth integration
- Email magic links (passwordless)
- JWT-based session management
- Multi-device support out of the box

### 1. Enable Authentication Providers

#### Google Sign-In Setup

1. **Create Google OAuth Credentials**
   ```
   1. Go to Google Cloud Console (console.cloud.google.com)
   2. Create new project or select existing
   3. Enable Google+ API
   4. Go to Credentials > Create Credentials > OAuth 2.0 Client ID
   5. Set application type to "Web application"
   6. Add authorized redirect URIs:
      - https://your-project.supabase.co/auth/v1/callback
      - http://localhost:5173/auth/callback (for development)
   7. Copy Client ID and Client Secret
   ```

2. **Configure in Supabase**
   ```
   Supabase Dashboard:
   1. Go to Authentication > Providers
   2. Enable Google provider
   3. Paste Client ID and Client Secret
   4. Save configuration
   ```

#### Email Magic Link Setup

1. **Configure in Supabase**
   ```
   Supabase Dashboard:
   1. Go to Authentication > Providers
   2. Enable Email provider
   3. Disable "Confirm email" if you want instant access
   4. Configure email templates (optional)
   ```

2. **Email Templates (Optional Customization)**
   ```
   Go to Authentication > Email Templates
   Customize templates for:
   - Magic Link (primary)
   - Email Change
   - Password Reset (disabled if passwordless only)
   ```

### 2. Frontend Integration

#### Install Dependencies

```bash
npm install @supabase/supabase-js
```

#### Create Supabase Client

Create `src/lib/supabase.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage, // Enables multi-device support
  },
});
```

#### Create Auth Context

Create `src/context/AuthContext.tsx`:

```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signInWithEmail = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

#### Create Login Component

Create `src/components/LoginPage.tsx`:

```typescript
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const { signInWithGoogle, signInWithEmail } = useAuth();

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithGoogle();
    } catch (error) {
      setMessage('Error signing in with Google');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await signInWithEmail(email);
      setMessage('Check your email for the magic link!');
      setEmail('');
    } catch (error) {
      setMessage('Error sending magic link');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-3xl font-bold text-center">電子報登入</h2>

        {/* Google Sign-In */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            {/* Google icon SVG path */}
          </svg>
          使用 Google 登入
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">或</span>
          </div>
        </div>

        {/* Email Magic Link */}
        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <input
            type="email"
            placeholder="輸入電子郵件"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            {loading ? '發送中...' : '發送魔法連結'}
          </button>
        </form>

        {message && (
          <p className="text-center text-sm text-gray-600">{message}</p>
        )}
      </div>
    </div>
  );
};
```

#### Update App.tsx

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './components/LoginPage';
import { WeeklyReaderPage } from './pages/WeeklyReaderPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<Navigate to="/" replace />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <WeeklyReaderPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
```

### 3. Replace Mock API with Supabase

Update `src/services/api.ts` (replace mockApi.ts):

```typescript
import { supabase } from '../lib/supabase';
import { Article, NewsletterWeek } from '../types';

export const api = {
  // Fetch all published newsletters
  async getNewsletters(): Promise<NewsletterWeek[]> {
    const { data, error } = await supabase
      .from('newsletter_weeks')
      .select('*')
      .eq('is_published', true)
      .order('release_date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Fetch specific newsletter with articles
  async getNewsletterByWeek(weekNumber: string): Promise<NewsletterWeek> {
    const { data: newsletter, error: weekError } = await supabase
      .from('newsletter_weeks')
      .select('*')
      .eq('week_number', weekNumber)
      .single();

    if (weekError) throw weekError;

    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('*')
      .eq('week_number', weekNumber)
      .eq('is_published', true)
      .order('article_order', { ascending: true });

    if (articlesError) throw articlesError;

    return {
      ...newsletter,
      articleIds: articles?.map((a) => a.id) || [],
    };
  },

  // Fetch single article
  async getArticle(articleId: string): Promise<Article> {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single();

    if (error) throw error;

    // Increment view count
    await supabase
      .from('articles')
      .update({ view_count: (data.view_count || 0) + 1 })
      .eq('id', articleId);

    return data;
  },

  // Get next article ID
  async getNextArticleId(currentArticleId: string): Promise<string | null> {
    const { data: currentArticle } = await supabase
      .from('articles')
      .select('week_number, article_order')
      .eq('id', currentArticleId)
      .single();

    if (!currentArticle) return null;

    const { data } = await supabase
      .from('articles')
      .select('id')
      .eq('week_number', currentArticle.week_number)
      .eq('is_published', true)
      .gt('article_order', currentArticle.article_order)
      .order('article_order', { ascending: true })
      .limit(1)
      .single();

    return data?.id || null;
  },

  // Get previous article ID
  async getPreviousArticleId(currentArticleId: string): Promise<string | null> {
    const { data: currentArticle } = await supabase
      .from('articles')
      .select('week_number, article_order')
      .eq('id', currentArticleId)
      .single();

    if (!currentArticle) return null;

    const { data } = await supabase
      .from('articles')
      .select('id')
      .eq('week_number', currentArticle.week_number)
      .eq('is_published', true)
      .lt('article_order', currentArticle.article_order)
      .order('article_order', { ascending: false })
      .limit(1)
      .single();

    return data?.id || null;
  },
};
```

---

## Deployment to Zeabur

### What is Zeabur?

Zeabur is a modern platform-as-a-service (PaaS) that:
- Automatically builds and deploys from Git
- Supports Node.js, React, and static sites
- Provides free tier for small projects
- Offers global CDN
- Easy environment variable management

### Prerequisites

1. GitHub repository with your code
2. Zeabur account (sign up at zeabur.com)
3. Supabase project set up

### Deployment Steps

#### 1. Prepare Your Application

**Update `vite.config.ts`** to ensure proper build configuration:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
});
```

**Create `zeabur.json`** in project root:

```json
{
  "build": {
    "type": "static",
    "outputDir": "dist"
  },
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

**Add `.zeaburignore`** (optional):

```
node_modules
.git
*.log
.env.local
coverage
```

#### 2. Deploy to Zeabur

1. **Login to Zeabur**
   ```
   Visit: https://zeabur.com
   Click: "Login with GitHub"
   Authorize Zeabur
   ```

2. **Create New Project**
   ```
   Dashboard > Create New Project
   Project Name: email-cms-newsletter
   Region: Select closest to your users (e.g., Asia Pacific)
   ```

3. **Deploy from GitHub**
   ```
   Add Service > Git Repository
   Connect GitHub account
   Select repository: email-cms
   Select branch: main (or your production branch)
   ```

4. **Configure Build Settings**
   ```
   Zeabur auto-detects Vite project
   Build command: npm run build
   Output directory: dist
   Install command: npm install
   ```

5. **Set Environment Variables**
   ```
   Go to: Service Settings > Environment Variables

   Add:
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

6. **Custom Domain (Optional)**
   ```
   Service Settings > Domains
   Add custom domain: newsletter.yourdomain.com

   Configure DNS:
   Type: CNAME
   Name: newsletter
   Value: your-app.zeabur.app
   ```

7. **Deploy**
   ```
   Click: "Deploy"
   Wait for build to complete (2-5 minutes)
   Visit your URL: https://your-app.zeabur.app
   ```

#### 3. Configure Supabase Redirects

Update Supabase Auth settings to allow your Zeabur domain:

```
Supabase Dashboard > Authentication > URL Configuration

Site URL: https://your-app.zeabur.app
Redirect URLs:
  - https://your-app.zeabur.app/auth/callback
  - http://localhost:5173/auth/callback (for development)
```

#### 4. Continuous Deployment

Zeabur automatically:
- Monitors your Git repository
- Rebuilds on every push to main branch
- Deploys new version after successful build
- Maintains zero-downtime deployments

To disable auto-deploy:
```
Service Settings > Git > Disable "Auto Deploy"
```

### Alternative: Deploy Self-Hosted Supabase to Zeabur

If using self-hosted Supabase, you can also deploy it to Zeabur:

1. **Create PostgreSQL Service**
   ```
   Project > Add Service > PostgreSQL
   Plan: Select based on needs (starts at $5/month)
   Version: 14 or 15
   ```

2. **Create Supabase Service**
   ```
   Project > Add Service > Git Repository
   Repository: Clone Supabase repo or use template
   Configure environment variables from Supabase Docker setup
   ```

3. **Link Services**
   ```
   Supabase service will auto-discover PostgreSQL
   Or manually set DATABASE_URL environment variable
   ```

---

## Multi-Device Support

### How It Works

Supabase provides multi-device support automatically through:

1. **JWT Token-Based Sessions**
   - Session stored in localStorage
   - Tokens valid across devices
   - Auto-refresh mechanism

2. **Session Persistence**
   - User signs in on Mac → session created
   - User signs in on iPhone → new session created
   - Both sessions remain active
   - Sessions sync via Supabase backend

3. **Session Management**

```typescript
// Check all active sessions (admin feature)
const { data: sessions } = await supabase.auth.admin.listUserSessions(userId);

// Revoke specific session
await supabase.auth.admin.deleteUserSession(userId, sessionId);

// Sign out from all devices
await supabase.auth.signOut({ scope: 'global' });
```

### User Experience Flow

#### First Device (Mac)
```
1. User visits app → sees login page
2. Clicks "Sign in with Google" or enters email
3. Completes authentication
4. Session stored in browser localStorage
5. Access granted
```

#### Second Device (iPhone)
```
1. User visits same app on iPhone
2. No session found → shows login page
3. Signs in with same Google account or email
4. New session created and stored
5. Access granted
6. Both sessions work independently
```

### Session Expiry and Refresh

```typescript
// Configure in src/lib/supabase.ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
    // Session expires after 1 hour by default
    // Auto-refreshes before expiry
  },
});
```

### Offline Support (Optional Enhancement)

For better multi-device experience, consider:

```typescript
// Service Worker for offline caching
// Create public/sw.js

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('newsletter-v1').then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/assets/index.js',
        '/assets/index.css',
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

---

## Environment Configuration

### Development Environment

Create `.env.local`:

```env
# Supabase Configuration
VITE_SUPABASE_URL=http://localhost:8000
VITE_SUPABASE_ANON_KEY=your_local_anon_key

# App Configuration
VITE_APP_URL=http://localhost:5173
VITE_APP_NAME=電子報 CMS
```

### Production Environment

Create `.env.production`:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_production_anon_key

# App Configuration
VITE_APP_URL=https://your-app.zeabur.app
VITE_APP_NAME=電子報 CMS
```

### Environment Variable Security

**DO NOT commit to Git:**
```gitignore
# .gitignore
.env
.env.local
.env.production
.env.*.local
```

**Store securely:**
- Development: Local `.env.local` file
- Production: Zeabur environment variables dashboard
- Team sharing: Use password manager or secret management tool

### Update TypeScript Types

Create `src/vite-env.d.ts`:

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_APP_URL: string;
  readonly VITE_APP_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

---

## Security Considerations

### 1. Authentication & Passwordless Design

**Passwordless Authentication Strategy:**
- ✅ **NO passwords stored** - eliminates password breach risks
- ✅ **Google OAuth 2.0** - primary authentication method
- ✅ **Email Magic Links** - alternative for users without Google accounts
  - **Token lifetime**: 15 minutes
  - **Token storage**: Hashed in database (NEVER plain text)
  - **Single-use enforcement**: Token marked as used after verification
  - **Token generation**: Cryptographically secure random (32+ bytes)

**JWT Token Design:**
```typescript
// Access Token (15-minute lifetime)
{
  "sub": "user-id",
  "email": "user@example.com",
  "role": "CLASS_TEACHER",
  "iat": 1700000000,
  "exp": 1700000900,
  "type": "access"
}

// Refresh Token (30-day lifetime)
{
  "sub": "user-id",
  "jti": "token-id",  // For revocation tracking
  "iat": 1700000000,
  "exp": 1702592000,
  "type": "refresh"
}
```

**Token Rotation:**
- Refresh tokens are rotated on each use
- Old refresh token invalidated immediately
- Prevents token compromise escalation
- Store refresh token ID (jti) in database for revocation

**Token Storage (Client-Side):**
```typescript
// Access Token: Store in memory (React state/context)
// ✅ Never survives page refresh (less XSS risk)
// ✅ Cleared on logout

// Refresh Token: Store in httpOnly, Secure cookie
// ✅ Cannot be accessed via JavaScript (XSS safe)
// ✅ Automatically sent with requests (CSRF protected)
// ✅ Survives page refresh (auto-refresh on load)
```

Example cookie setup:
```typescript
// Set during OAuth/magic link verification
res.cookie('refreshToken', token, {
  httpOnly: true,      // JS cannot access
  secure: true,        // HTTPS only
  sameSite: 'Strict',  // CSRF protection
  maxAge: 30 * 24 * 60 * 60 * 1000  // 30 days
});
```

### 2. Rate Limiting for Authentication Endpoints

**Authentication-Specific Rate Limits** (stricter than general API):
```
POST   /api/auth/magic-link          → 5 requests per 15 minutes (per IP/email)
POST   /api/auth/google              → 5 requests per 15 minutes (per IP)
GET    /api/auth/verify              → 10 requests per 15 minutes (per IP)
POST   /api/auth/refresh             → 20 requests per 15 minutes (per IP)
POST   /api/auth/logout              → Unlimited (safety endpoint)
```

**General API Rate Limits:**
```
GET    /api/*                        → 100 requests per minute (anonymous)
POST   /api/*                        → 50 requests per minute (authenticated)
DELETE /api/*                        → 20 requests per minute (authenticated)
```

Implement using middleware:
```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,                     // 5 attempts
  message: 'Too many auth attempts. Please try again later.',
  skip: (req) => req.user,    // Don't limit authenticated users
});

app.post('/api/auth/magic-link', authLimiter, sendMagicLinkHandler);
```

### 3. CSRF Protection

**Cross-Site Request Forgery Prevention:**
```typescript
// 1. Use httpOnly cookies + SameSite=Strict (best practice)
// Prevents automatic cookie inclusion in cross-site requests

// 2. For additional protection, implement CSRF tokens:
app.post('/api/articles', requireCSRFToken, createArticleHandler);

function requireCSRFToken(req, res, next) {
  const csrfToken = req.headers['x-csrf-token'];
  const sessionToken = req.cookies['csrf_token'];

  if (!csrfToken || csrfToken !== sessionToken) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}
```

**All state-changing operations** (POST, PUT, DELETE, PATCH) require CSRF validation.

### 4. Email Verification

**Email Verification Requirements:**
```typescript
// 1. Automatic verification on first successful login
if (!user.emailVerified) {
  await db.users.update(user.id, { emailVerified: true });
}

// 2. Required for sensitive operations
function requireEmailVerified(req, res, next) {
  if (!req.user?.emailVerified) {
    return res.status(403).json({
      error: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }
  next();
}

// Usage: restrict article creation to verified emails
app.post('/api/articles', requireAuth, requireEmailVerified, createArticleHandler);
```

### 5. Audit Logging

**Authentication Event Logging:**
Track all authentication events for security auditing and breach detection.

```sql
CREATE TABLE auth_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  email VARCHAR(255),
  event_type VARCHAR(50) NOT NULL,  -- 'login', 'logout', 'magic_link_sent', 'token_refresh', 'failed_login'
  auth_method VARCHAR(50),           -- 'google', 'magic_link'
  success BOOLEAN NOT NULL,
  error_message TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_auth_audit_log_user_id ON auth_audit_log(user_id);
CREATE INDEX idx_auth_audit_log_created_at ON auth_audit_log(created_at);
CREATE INDEX idx_auth_audit_log_event_type ON auth_audit_log(event_type);
```

**Audit Log Implementation:**
```typescript
async function logAuthEvent(event: AuthEvent) {
  await db.authAuditLog.create({
    userId: event.userId,
    email: event.email,
    eventType: event.type,      // 'login', 'logout', 'magic_link_sent'
    authMethod: event.method,   // 'google', 'magic_link'
    success: event.success,
    errorMessage: event.error,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });
}

// Usage
await logAuthEvent({
  userId: user.id,
  email: user.email,
  type: 'login',
  method: 'google',
  success: true,
});
```

**Monitoring Auth Logs:**
- Failed login attempts > 5 in 15 min → Alert admins
- Magic link used from different IP → Flag suspicious activity
- Refresh token reuse detected → Possible token theft

### 6. Temporary Article Access Tokens

**Purpose**: Allow authenticated users to share articles with non-registered recipients via email

**Design:**
- Single-use tokens
- 30-minute expiry
- Optional recipient email lockdown
- Generates temporary session for article access

```sql
CREATE TABLE article_access_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token VARCHAR(255) NOT NULL UNIQUE,  -- Hashed token
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255),        -- Optional: lock to specific email
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false,
  used_at TIMESTAMP WITH TIME ZONE,
  used_by_ip INET,
  used_by_user_agent TEXT,
  max_uses INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE temp_article_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token VARCHAR(255) NOT NULL UNIQUE,  -- Hashed session token
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Access Flow:**
```
1. User clicks temporary link in email → /a/:token
2. System validates token (not expired, not used)
3. Creates temporary session token
4. Sets temp_article_access cookie
5. Redirects to article view
6. Article page checks: authenticated user OR valid temp session
7. Shows sign-in prompt to encourage account creation
```

### 7. Row Level Security (RLS)

**Already implemented in database schema above**

- ✅ Readers can only view published content
- ✅ Editors/admins can manage all content
- ✅ Users can only update their own profiles
- ✅ Parents can only view children's class articles
- ✅ Teachers can only manage their assigned classes

### 8. API Key Security

**Supabase Anon Key**
- Safe to expose in frontend
- RLS policies protect data
- Cannot bypass security rules
- Rate-limited per IP address

**Supabase Service Role Key**
- ⚠️ **NEVER expose in frontend**
- Only use in backend/server functions
- Full database access, bypasses RLS
- Store in environment variables only

### 9. HTTPS/SSL

**Zeabur Automatically Provides:**
- ✅ Free SSL certificates (Let's Encrypt)
- ✅ HTTPS redirect
- ✅ TLS 1.2+ support
- ✅ HSTS headers (optional enhancement)

**Configuration:**
```
// Enable HSTS (HTTP Strict Transport Security)
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### 10. Content Security Policy (CSP)

Add to `index.html`:

```html
<meta
  http-equiv="Content-Security-Policy"
  content="
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    font-src 'self' data:;
    connect-src 'self' https://*.supabase.co;
  "
/>
```

### 11. XSS Protection

**Already implemented** via `rehype-sanitize` for Markdown rendering.

Ensure all user inputs are sanitized:

```typescript
import { sanitize } from 'rehype-sanitize';

// In markdown service
const sanitizedHtml = await remark()
  .use(remarkHtml)
  .use(sanitize) // Removes dangerous HTML
  .process(markdown);
```

### 12. CORS Configuration

**Supabase CORS Setup:**
Configure in Supabase Dashboard > Authentication > URL Configuration

```
Site URL: https://your-domain.com
Redirect URLs:
  - https://your-domain.com/auth/callback
  - https://your-domain.com/auth/verify
  - http://localhost:5173/auth/callback (development only)
```

Auto-validated by Supabase for:
- OAuth callbacks (Google)
- Magic link email verification
- Token refresh requests

### 13. Environment Variable Security

**Sensitive values (NEVER commit to Git):**
```env
# JWT Secrets (generate: openssl rand -base64 32)
JWT_SECRET=xxx
JWT_REFRESH_SECRET=xxx

# OAuth Credentials
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=xxx

# Supabase Keys
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx  # Backend only!

# Database
DATABASE_URL=postgresql://...

# Email Service
EMAIL_API_KEY=xxx
EMAIL_FROM=noreply@example.com
```

**Environment File Security:**
```gitignore
# .gitignore
.env
.env.local
.env.*.local
.env.production
```

**Storage Strategy:**
- Development: Local `.env.local` file (not versioned)
- Production: Zeabur environment variables dashboard
- Secrets management: Use dedicated service (e.g., AWS Secrets Manager, HashiCorp Vault)

---

## Monitoring and Maintenance

### Supabase Dashboard

Monitor:
- Database size and growth
- API usage and request counts
- Authentication metrics (signups, logins)
- Error logs

### Zeabur Dashboard

Monitor:
- Build history and status
- Deploy logs
- Traffic analytics
- Resource usage

### Backup Strategy

**Supabase Cloud:**
- Automatic daily backups (7-day retention on free tier)
- Manual backups via Dashboard > Database > Backups

**Self-Hosted:**
```bash
# Automated PostgreSQL backup
docker exec supabase-db pg_dump -U postgres > backup-$(date +%Y%m%d).sql

# Restore from backup
docker exec -i supabase-db psql -U postgres < backup-20250101.sql
```

---

## Cost Estimation

### Free Tier Setup (Small Projects)

- **Supabase Cloud (Free)**: 500MB database, 2GB bandwidth, 50K MAU
- **Zeabur (Free)**: 1 service, auto-sleep after inactivity
- **Total**: $0/month

**Limitations:**
- Database size limit
- May sleep after inactivity
- Community support only

### Production Setup (Recommended)

- **Supabase Pro**: $25/month (8GB database, 50GB bandwidth, 100K MAU)
- **Zeabur Pro**: $5-15/month (always-on, custom domain, more resources)
- **Total**: $30-40/month

**Benefits:**
- Reliable uptime
- Better performance
- Priority support
- Automatic backups

### Self-Hosted Setup

- **VPS (2GB RAM)**: $10-20/month (DigitalOcean, Linode, Hetzner)
- **Domain**: $10-15/year
- **Total**: ~$12-22/month

**Trade-offs:**
- More control
- Requires DevOps knowledge
- You manage backups/updates
- Potentially lower costs at scale

---

## Next Steps

1. **Choose Database Option**
   - Quick start: Supabase Cloud
   - Full control: Self-hosted Supabase

2. **Set Up Database**
   - Run SQL schema
   - Test with sample data
   - Configure RLS policies

3. **Implement Authentication**
   - Add Supabase client
   - Create auth context
   - Build login page
   - Set up Google OAuth

4. **Update Frontend**
   - Replace mock API
   - Add auth protection
   - Test authentication flow

5. **Deploy to Zeabur**
   - Configure environment variables
   - Deploy and test
   - Set up custom domain

6. **Test Multi-Device**
   - Sign in on multiple devices
   - Verify session persistence
   - Test magic links

7. **Monitor and Optimize**
   - Set up error tracking
   - Monitor performance
   - Gather user feedback

---

## Troubleshooting

### Common Issues

**1. "Invalid API key"**
```
Solution: Check VITE_SUPABASE_ANON_KEY in environment variables
Verify it matches Supabase Dashboard > Settings > API
```

**2. "403 Forbidden" on data fetch**
```
Solution: Check RLS policies
Verify user is authenticated
Ensure is_published = true for public content
```

**3. Magic link not received**
```
Solution: Check spam folder
Verify email template is enabled in Supabase
Check Supabase > Logs for email delivery status
```

**4. Google OAuth redirect fails**
```
Solution: Verify redirect URL in Google Console matches Supabase
Check Supabase > Authentication > URL Configuration
Ensure Site URL is set correctly
```

**5. Zeabur build fails**
```
Solution: Check build logs in Zeabur dashboard
Verify package.json scripts are correct
Ensure all environment variables are set
```

### Support Resources

- **Supabase Docs**: https://supabase.com/docs
- **Zeabur Docs**: https://zeabur.com/docs
- **Supabase Discord**: https://discord.supabase.com
- **GitHub Issues**: [Your repo]/issues

---

## Appendix

### A. Sample Data for Testing

```sql
-- Insert sample newsletter week
INSERT INTO public.newsletter_weeks (week_number, release_date, is_published, created_by)
VALUES ('2025-W01', '2025-01-06', true, auth.uid());

-- Insert sample articles
INSERT INTO public.articles (title, content, author, week_number, article_order, is_published, created_by)
VALUES
  (
    '新年快樂！2025 開始',
    '# 歡迎來到 2025 年\n\n這是我們的第一篇文章...',
    '編輯團隊',
    '2025-W01',
    1,
    true,
    auth.uid()
  ),
  (
    '技術更新：全新閱讀體驗',
    '# 技術革新\n\n我們升級了閱讀介面...',
    '技術團隊',
    '2025-W01',
    2,
    true,
    auth.uid()
  );
```

### B. Useful SQL Queries

```sql
-- Count total articles
SELECT COUNT(*) FROM public.articles;

-- Get most viewed articles
SELECT title, view_count
FROM public.articles
WHERE is_published = true
ORDER BY view_count DESC
LIMIT 10;

-- Count active users (signed up in last 30 days)
SELECT COUNT(*)
FROM public.profiles
WHERE created_at > NOW() - INTERVAL '30 days';

-- List all newsletters with article count
SELECT
  nw.week_number,
  nw.release_date,
  COUNT(a.id) as article_count
FROM public.newsletter_weeks nw
LEFT JOIN public.articles a ON a.week_number = nw.week_number
GROUP BY nw.week_number, nw.release_date
ORDER BY nw.release_date DESC;
```

### C. Migration Checklist

- [ ] Supabase project created
- [ ] Database schema applied
- [ ] Google OAuth configured
- [ ] Email provider configured
- [ ] Supabase client installed
- [ ] Auth context implemented
- [ ] Login page created
- [ ] Mock API replaced with Supabase
- [ ] Environment variables configured
- [ ] Build tested locally
- [ ] Deployed to Zeabur
- [ ] Custom domain configured (optional)
- [ ] Multi-device login tested
- [ ] RLS policies verified
- [ ] Monitoring set up

---

**Document Version**: 1.0
**Last Updated**: 2025-01-16
**Maintainer**: Development Team
