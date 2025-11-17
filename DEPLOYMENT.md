# Deployment Guide: CMS Database Structure

Production deployment guide for the Email CMS application.

**Table of Contents:**
- [Pre-Deployment Checklist](#pre-deployment-checklist)
- [Database Migration](#database-migration)
- [Production Configuration](#production-configuration)
- [Security Verification](#security-verification)
- [Performance Validation](#performance-validation)
- [Deployment Steps](#deployment-steps)
- [Post-Deployment Verification](#post-deployment-verification)
- [Monitoring & Maintenance](#monitoring--maintenance)
- [Rollback Procedures](#rollback-procedures)
- [Troubleshooting](#troubleshooting)

---

## Pre-Deployment Checklist

### Code Readiness

- [ ] All tests passing: `npm test -- --run`
- [ ] No linting errors: `npm run lint`
- [ ] No TypeScript errors: `npm run build`
- [ ] Coverage above 80%: `npm run coverage`
- [ ] Performance tests passing: `npm test -- tests/performance/ --run`
- [ ] Latest code committed to main branch
- [ ] Pull request reviewed and approved

### Documentation Readiness

- [ ] SETUP.md reviewed
- [ ] TESTING.md verified
- [ ] API.md complete
- [ ] README.md updated
- [ ] Changelog updated with new features
- [ ] Breaking changes documented

### Database Readiness

- [ ] Schema.sql reviewed and tested
- [ ] Triggers verified in test database
- [ ] Indexes confirmed optimized
- [ ] Constraints tested
- [ ] RLS policies finalized
- [ ] Backup strategy in place

### Team Readiness

- [ ] Stakeholders informed of deployment window
- [ ] Rollback plan reviewed with team
- [ ] On-call support assigned
- [ ] Communication channels established
- [ ] Post-deployment verification plan ready

---

## Database Migration

### 1. Production Supabase Project Setup

#### Create Production Project

1. Log in to [Supabase Dashboard](https://app.supabase.com)
2. Click **New Project**
3. Configure:
   - **Name**: `email-cms-prod`
   - **Database Password**: Generate and store securely (1Password/Vault)
   - **Region**: Production region (not test)
   - **Pricing Plan**: Pro (for production support)

#### Record Credentials

```bash
# Save to secure location (not Git!)
# Production Supabase URL
VITE_SUPABASE_URL=https://your-prod-project.supabase.co

# Production Anon Key
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# Service Role Key (admin, keep secret!)
SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

### 2. Run Database Schema

1. In **SQL Editor**, create new query
2. Copy entire contents of `specs/002-database-structure/contracts/schema.sql`
3. Paste into editor
4. Click **Run**

Expected output:
```
✓ 8 tables created
✓ 10 indexes created
✓ 3 triggers created
✓ RLS policies enabled
```

### 3. Verify Tables

In **Table Editor**, confirm all tables:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Should return:
- article_audit_log
- articles
- child_class_enrollment
- classes
- families
- family_enrollment
- newsletter_weeks
- teacher_class_assignment
- user_roles

### 4. Production Data Seeding (Optional)

If deploying with initial data:

```bash
# Set production credentials
export VITE_SUPABASE_URL=https://your-prod-project.supabase.co
export VITE_SUPABASE_ANON_KEY=eyJ...

# Run seeding (adds sample data)
npx ts-node scripts/seed-database.ts

# Verify data loaded
curl -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  "https://your-prod-project.supabase.co/rest/v1/articles?limit=1"
```

---

## Production Configuration

### 1. Environment Variables

Update production environment with:

```bash
# .env.production (never commit!)
VITE_SUPABASE_URL=https://your-prod-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Optional
VITE_API_TIMEOUT=5000
VITE_ENABLE_LOGGING=false  # Disable verbose logging in production
VITE_VERSION=1.0.0
```

### 2. Build Optimization

```bash
# Build for production
npm run build

# Verify build output
ls -lh dist/
# Should see:
# - index.html (small)
# - assets/ (optimized JS/CSS bundles)
```

### 3. Deployment Target Configuration

#### For Vercel

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "env": {
    "VITE_SUPABASE_URL": "@supabase_url",
    "VITE_SUPABASE_ANON_KEY": "@supabase_key"
  }
}
```

#### For Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy source
COPY package*.json ./
RUN npm ci --only=production

COPY . .

# Build
RUN npm run build

# Serve with simple HTTP server
EXPOSE 3000
CMD ["npx", "serve", "-s", "dist", "-p", "3000"]
```

#### For Traditional Server (nginx)

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /var/www/email-cms/dist;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location /assets {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Disable cache for index.html
    location = /index.html {
        expires 0;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
}
```

---

## Security Verification

### 1. Enable Row-Level Security (RLS)

**Critical for production!**

```sql
-- Enable RLS on all tables
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_enrollment ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_class_enrollment ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_audit_log ENABLE ROW LEVEL SECURITY;
```

### 2. Verify RLS Policies

In Supabase Dashboard → **Authentication** → **Policies**:

Expected policies:
- **articles**: Public read, authenticated write
- **families**: Parent/guardian access only
- **family_enrollment**: Parent/guardian access only
- **child_class_enrollment**: Parent/guardian + teacher access

### 3. API Key Rotation

1. Go to **Project Settings** → **API**
2. Rotate anon key:
   - Generate new key
   - Update application config
   - Wait 24 hours
   - Revoke old key

### 4. Disable Direct Database Access

Disable PostgreSQL direct access in Supabase:
- Settings → Database → Disable direct access (uncheck "Allow direct access")

### 5. Enable Logging & Monitoring

```sql
-- Enable query logging
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1 second
SELECT pg_reload_conf();

-- Check logs in Supabase Dashboard → Logs
```

---

## Performance Validation

### 1. Run Performance Tests

```bash
# Run performance suite in production-like environment
npm test -- tests/performance/ --run

# Expected results:
# SC-001: Article retrieval <500ms ✓
# SC-002: Order consistency 100% ✓
# SC-005: Class filtering <100ms ✓
# SC-006: 104+ weeks support ✓
```

### 2. Verify Indexes

```sql
-- Check index status
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Expected indexes on:
-- - articles: week_number, visibility_type, is_published
-- - classes: class_grade_year
-- - families: family_code
```

### 3. Check Slow Queries

In Supabase Dashboard → **Logs** → **Postgres Logs**:

```
-- Filter for slow queries
duration > 500
```

Expected: None or very few

### 4. Load Testing

```bash
# Simple load test (100 concurrent reads)
npm test -- -t "concurrent" --run

# For production load testing, use:
# - Apache JMeter
# - k6.io
# - Gatling
```

---

## Deployment Steps

### Step 1: Pre-Deployment Backup

```bash
# Export database backup
# In Supabase Dashboard → Backups
# Click "Request manual backup"
# Note backup timestamp for rollback reference
```

### Step 2: Database Migration

```bash
# 1. Apply schema
# (Already done in "Database Migration" section above)

# 2. Verify schema applied
npx ts-node scripts/health-check.ts

# Expected output:
# ✓ Database Connection
# ✓ Database Tables (9/9)
# ✓ Database Triggers
# Status: HEALTHY or WARNING
```

### Step 3: Test Feature Flags

If using feature flags:

```bash
# Feature flags are disabled by default
# Enable progressively:
# 1. Internal users only (beta)
# 2. 10% of users
# 3. 50% of users
# 4. 100% of users
```

### Step 4: Deploy Application

#### Option A: Vercel

```bash
# Push to main branch (triggers auto-deploy)
git checkout main
git merge develop
git push origin main

# Monitor deployment in Vercel Dashboard
# Verify environment variables set
# Check production URL works
```

#### Option B: Docker

```bash
# Build image
docker build -t email-cms:prod .

# Push to registry
docker tag email-cms:prod your-registry/email-cms:prod
docker push your-registry/email-cms:prod

# Deploy to orchestration platform
kubectl set image deployment/email-cms \
  app=your-registry/email-cms:prod --record
```

#### Option C: Traditional Server

```bash
# SSH to server
ssh deploy@your-server.com

# Pull latest code
cd /var/www/email-cms
git fetch origin main
git checkout origin/main

# Build and restart
npm ci --production
npm run build
sudo systemctl restart email-cms
```

### Step 5: Smoke Test

```bash
# Test basic functionality
curl https://yourdomain.com/api/articles?week=2025-W47

# Expected: 200 OK with article data

# Test via browser
# 1. Visit homepage
# 2. Browse articles
# 3. Check console for errors
# 4. Test article filtering
```

---

## Post-Deployment Verification

### 1. Health Check

```bash
# Run health check on production
npx ts-node scripts/health-check.ts

# Verify all systems:
# - ✓ Database connection
# - ✓ All tables present
# - ✓ RLS policies enabled
# - ✓ Query performance
```

### 2. Monitor Application

Check production monitoring:

```bash
# Error tracking (Sentry, LogRocket, etc.)
# - Check for errors
# - Review error rate
# - Monitor performance metrics

# Database monitoring (Supabase)
# - Query performance
# - Slow query log
# - Active connections
```

### 3. Verify Data Integrity

```sql
-- Check article counts
SELECT COUNT(*) FROM articles;

-- Check for orphaned records
SELECT * FROM articles
WHERE week_number NOT IN (SELECT week_number FROM newsletter_weeks);

-- Verify audit trail
SELECT COUNT(*) FROM article_audit_log;
```

### 4. Load Testing (Optional)

```bash
# Light load test to verify performance under traffic
# Using k6:
k6 run load-test.js

# Expected: <500ms response time at 100 RPS
```

---

## Monitoring & Maintenance

### 1. Continuous Monitoring

Set up alerts for:

- **Database**: Connection failures, slow queries (>1s), disk space
- **Application**: 5xx errors, high latency (>2s), memory usage
- **User**: Session timeouts, authentication failures

### 2. Regular Health Checks

```bash
# Daily health check
0 8 * * * /usr/local/bin/npx ts-node /app/scripts/health-check.ts >> /var/log/health-check.log

# Weekly backup verification
0 2 * * 0 # Check backup completed successfully
```

### 3. Log Rotation

Configure log rotation:

```bash
# /etc/logrotate.d/email-cms
/var/log/email-cms/*.log {
  daily
  rotate 7
  compress
  delaycompress
  notifempty
}
```

### 4. Database Maintenance

```sql
-- Weekly maintenance
VACUUM ANALYZE;
REINDEX INDEX CONCURRENTLY idx_articles_week;
REINDEX INDEX CONCURRENTLY idx_articles_visibility;

-- Check bloat
SELECT schemaname, tablename,
       round(100 * (CASE WHEN otta > 0 THEN sml.relpages - otta ELSE 0 END) /
             sml.relpages) AS table_waste_percent
FROM pg_class sml
JOIN pg_namespace nmsp ON nmsp.oid = sml.relnamespace
ORDER BY table_waste_percent DESC;
```

---

## Rollback Procedures

### Rollback Decision Criteria

Initiate rollback if:

- Critical bugs preventing core functionality
- Data corruption detected
- Security breach
- Performance degradation >50%
- Database integrity issues

### Full Rollback

```bash
# 1. Alert stakeholders of issue
# 2. Stop current deployment

# Option A: Revert application code
git revert <commit-hash>
npm run build
# Re-deploy previous version

# Option B: Restore from database backup
# In Supabase Dashboard → Backups
# Click restore arrow next to recent backup
# WARNING: This loses all data changes since backup!

# 3. Verify rollback successful
npx ts-node scripts/health-check.ts
curl https://yourdomain.com/api/articles?limit=1

# 4. Post-mortem analysis
# Document what went wrong
# Create incident report
# Plan preventative measures
```

### Partial Rollback (Feature Flag)

If using feature flags:

```bash
# Disable problematic feature
# In application settings:
FEATURE_FLAGS={
  "class_filtering": false,  // Disable if issues
  "article_updates": true,
  "audit_logging": true
}

# Restart application
# No database changes needed
```

### Database Rollback

```sql
-- If schema needs reverting:
-- 1. Drop problematic tables/columns
DROP TABLE IF EXISTS new_table CASCADE;

-- 2. Restore from backup
-- In Supabase: Backups → Restore

-- 3. Verify data integrity
SELECT COUNT(*) FROM articles;
SELECT COUNT(*) FROM families;
```

---

## Troubleshooting

### Deployment Issues

#### "Build failed: Module not found"

```bash
# Solution: Reinstall dependencies
npm ci
npm run build
```

#### "Environment variables not found"

```bash
# Verify environment variables set
env | grep VITE_SUPABASE

# Update in hosting platform settings
# Vercel: Settings → Environment Variables
# Heroku: Config Vars
# Docker: --env flags or .env file
```

#### "Database connection timeout"

```bash
# 1. Check Supabase project is active
# 2. Verify credentials in production config
# 3. Check firewall rules allow connections

curl -v https://your-project.supabase.co/rest/v1/
# Should return 401 with valid project
```

### Runtime Issues

#### "High database latency"

```sql
-- Check for slow queries
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 5;

-- Analyze slow query
EXPLAIN ANALYZE
SELECT * FROM articles WHERE week_number = '2025-W47';
```

#### "RLS policy blocking valid requests"

```sql
-- Verify policies
SELECT * FROM pg_policies WHERE tablename = 'articles';

-- Test policy
SET ROLE authenticated;
SELECT * FROM articles LIMIT 1;
RESET ROLE;
```

#### "Memory usage growing"

```bash
# Check for memory leaks in React
# Use Chrome DevTools → Memory
# Take heap snapshots and compare

# Or use Clinic.js
npx clinic doctor -- npm start
npx clinic flame -- autocannon http://localhost:5173
```

---

## Post-Deployment Checklist

- [ ] Health check passing
- [ ] Error rate < 0.1%
- [ ] Response time < 500ms
- [ ] Database performance normal
- [ ] All features working
- [ ] User notifications sent
- [ ] Documentation updated
- [ ] Team trained on new features
- [ ] Support team briefed
- [ ] Stakeholders notified of completion

---

## Support & Escalation

### On-Call Contact

- **Primary**: [DevOps Team]
- **Secondary**: [Engineering Manager]
- **Escalation**: [CTO]

### Incident Communication

```
#incidents Slack channel message:
[INCIDENT] Deployment completed - monitoring in progress
- Time: 2025-11-17 14:00 UTC
- Affected: article-cms.example.com
- Status: MONITORING
- Update: [frequency of updates]
```

---

**Last Updated**: 2025-11-17
**Deployment Framework**: Vercel/Docker/Traditional
**Database**: Supabase PostgreSQL
**Maintenance Window**: Sunday 2-4 AM UTC
