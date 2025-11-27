# ⚡ Quick Reference Card

Save this page and reference it whenever you need quick answers.

---

## 🎯 I Need To...

### Run Magic Links Locally
```bash
supabase start
npm run dev
# Test at http://localhost:5173/login
# View emails at http://localhost:54324
```

### Deploy to Production
```bash
# 1. Get Mailgun: https://www.mailgun.com
# 2. Update supabase/config.toml with SMTP settings
# 3. Set Zeabur env vars
# 4. git push zeabur main
```

### Check Email Was Sent
```
Local: http://localhost:54324 (Inbucket)
Production: Check Mailgun dashboard
```

### Fix Magic Link Not Working
1. Check Inbucket/Mailgun for email
2. Verify token hasn't expired (1 hour default)
3. Check browser console for errors
4. See EMAIL_SETUP_GUIDE.md#troubleshooting

### Configure Custom Email Template
```bash
# 1. Create: supabase/templates/magic-link.html
# 2. Edit: supabase/config.toml
# 3. Add: [auth.email.template.recovery]
```

### Change Magic Link Expiry Time
```toml
# supabase/config.toml
[auth.email]
otp_expiry = 7200  # 2 hours (default: 3600 = 1 hour)
```

### Test with Different Email Providers
```typescript
// Works with any email format:
await sendLink('test@example.com')
await sendLink('user+tag@gmail.com')
await sendLink('john.doe@company.co.uk')
```

---

## 📊 Configuration Cheat Sheet

### Mailgun SMTP
```toml
[auth.email.smtp]
enabled = true
host = "smtp.mailgun.org"
port = 587
user = "postmaster@your-domain.mailgun.org"
pass = "your-mailgun-api-key"
```

### SendGrid SMTP
```toml
[auth.email.smtp]
enabled = true
host = "smtp.sendgrid.net"
port = 587
user = "apikey"
pass = "SG.your-sendgrid-api-key"
```

### Environment Variables
```bash
# Local (.env.local)
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=eyJ...

# Production (.env.production)
VITE_SUPABASE_URL=https://your-zeabur-url.com
VITE_SUPABASE_ANON_KEY=your-anon-key
MAILGUN_API_KEY=key-xxx
MAILGUN_DOMAIN=mg.your-domain.mailgun.org
```

---

## 🔧 Commands Reference

```bash
# Supabase
supabase start              # Start local Supabase
supabase stop              # Stop Supabase
supabase logs              # View logs
supabase status            # Check status

# App
npm run dev               # Development server
npm run build             # Production build
npm test                  # Run tests

# Git/Deployment
git push zeabur main      # Deploy to Zeabur
git status                # Check changes
git log --oneline         # View commits
```

---

## ✅ Verification Checklist

### Local Dev
- [ ] `supabase start` runs without errors
- [ ] `npm run dev` starts server
- [ ] Can access http://localhost:5173/login
- [ ] Can send magic link
- [ ] Email appears in http://localhost:54324
- [ ] Can click link and get logged in

### Production
- [ ] Mailgun account created & domain verified
- [ ] Supabase SMTP settings configured
- [ ] Environment variables set in Zeabur
- [ ] App deployed successfully
- [ ] Magic link sent to real email
- [ ] Can receive and click email link
- [ ] User created in auth dashboard
- [ ] No errors in Zeabur logs

---

## 🚨 Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| Inbucket shows 404 | Not running | `supabase start` |
| Emails not sending | SMTP not configured | Update config.toml |
| Token expired | Waited >1 hour | Send new magic link |
| Rate limit error | Sent too many | Wait 1 hour or increase limit |
| User not created | Email format error | Use valid email |
| CSRF error | Wrong redirect URL | Check site_url in config |

---

## 📂 Key Files

```
Implementation:
├── src/components/MagicLinkForm.tsx     # Email input UI
├── src/services/authService.ts          # Send/verify logic
├── src/hooks/useMagicLink.ts            # State management
└── src/context/AuthContext.tsx          # Auth provider

Configuration:
├── supabase/config.toml                 # Supabase settings
├── .env.local                           # Local env vars
└── .env.production                      # Production env vars

Documentation:
├── docs/README.md                       # Navigation guide
└── docs/EMAIL_SETUP_GUIDE.md            # Full guide
```

---

## 🔐 Security Reminders

- ❌ Never commit `.env.production`
- ❌ Never log API keys or tokens
- ✅ Use HTTPS in production (Zeabur provides free SSL)
- ✅ Store secrets in Zeabur environment
- ✅ Tokens expire after 1 hour
- ✅ Passwords never stored

---

## 💰 Cost Estimate

| Provider | Free Tier | Cost |
|----------|-----------|------|
| **Mailgun** | 300/day (9k/month) | Free, then $20/mo |
| **SendGrid** | 100/day (3k/month) | Free, then $20/mo |
| **Local Dev** | Unlimited | Free |

**Recommendation:** Start with free tier (Mailgun), upgrade when needed.

---

## 📞 Where to Find Info

| Question | Location |
|----------|----------|
| How does it work? | docs/EMAIL_SETUP_GUIDE.md#architecture-overview |
| How do I set up locally? | docs/EMAIL_SETUP_GUIDE.md#local-development-setup |
| How do I deploy? | docs/EMAIL_SETUP_GUIDE.md#zeabur-deployment |
| Why isn't it working? | docs/EMAIL_SETUP_GUIDE.md#troubleshooting |
| What's my configuration? | docs/EMAIL_SETUP_GUIDE.md#configuration-reference |
| What commands do I need? | This card (#commands-reference) |

---

## 🚀 Next Step

1. Choose your path:
   - **Local?** Run `supabase start` and `npm run dev`
   - **Production?** Get Mailgun and follow deployment guide

2. Read appropriate section in:
   - docs/README.md (quick navigation)
   - docs/EMAIL_SETUP_GUIDE.md (detailed guide)

3. Use checklists to verify setup

---

## Status: ✅ Ready to Use

Your magic link authentication is complete and production-ready.
No code changes needed. Just configure email and deploy.

**Last Updated:** November 27, 2025
