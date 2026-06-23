# Vercel Deployment Guide for Denac Accounts

## Prerequisites Checklist

- [ ] GitHub account (you have: ariaann007)
- [ ] Vercel account (or create one)
- [ ] Turso account (for database)

---

## Step 1: Set Up Turso Database

### 1.1 Create Turso Account
1. Go to https://turso.tech
2. Sign up with your email
3. Click "Create a new database"

### 1.2 Get Your Connection String
1. Create a new database (name it "denac-accounts")
2. Copy the connection string - it will look like:
   ```
   libsql://your-db-xxxxx.turso.io?authToken=eyJ...
   ```
3. Save this somewhere safe - you'll need it for Vercel

### 1.3 Create Initial Data (Optional)
Run in your terminal to seed test data:
```bash
npx prisma db push
npm run seed  # if you have a seed script
```

---

## Step 2: Deploy to Vercel

### 2.1 Connect GitHub to Vercel
1. Go to https://vercel.com
2. Log in or create account (use ann@denizns.co.uk)
3. Click "Add New..." → "Project"
4. Click "Import Git Repository"
5. Search for "Denac" or enter: `https://github.com/ariaann007/Denac`
6. Click "Import"

### 2.2 Configure Build Settings
- **Project Name**: denac (or denac-accounts)
- **Framework**: Next.js (should be detected automatically)
- **Root Directory**: denac-app (select this)
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

### 2.3 Add Environment Variables

Click "Environment Variables" and add:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | Your Turso connection string from Step 1.2 |

Example:
```
libsql://your-db-xxxxx.turso.io?authToken=eyJ0eXAiOiJKV1QiLCJhbGc...
```

### 2.4 Deploy
1. Click "Deploy"
2. Wait for build to complete (usually 2-3 minutes)
3. Once complete, you'll get a URL like: `https://denac.vercel.app`

---

## Step 3: Post-Deployment Setup

### 3.1 Run Database Migrations
After successful deployment, run in your terminal:
```bash
TURSO_CONNECTION_URL="your_turso_url" npx prisma db push
```

Or via Vercel CLI:
```bash
vercel env pull
npx prisma db push
```

### 3.2 Test the App
1. Go to your Vercel deployment URL
2. Try navigating between pages:
   - Dashboard ✓
   - Journal ✓
   - Ledger ✓
   - Trial Balance ✓
   - Chart of Accounts ✓

---

## Troubleshooting

### Build fails with "Database error"
- Make sure `DATABASE_URL` is set in Vercel Environment Variables
- Verify the Turso connection string is correct

### Pages show "Loading..." forever
- Check browser console for errors (F12)
- Verify API endpoints are working: `/api/accounts`, `/api/journals`

### Database is empty after deployment
- Run Prisma migrations: `npx prisma db push`
- Or click "Load Defaults" on Chart of Accounts page

---

## Your Deployment Info

- **GitHub Repo**: https://github.com/ariaann007/Denac
- **Vercel Account Email**: ann@denizns.co.uk
- **App Directory**: denac-app/
- **Database Type**: Turso (SQLite edge)

---

## Quick Commands Reference

```bash
# Test locally
npm run dev

# Build for production
npm run build

# Push code to GitHub
git add .
git commit -m "Deploy to Vercel"
git push origin main

# Connect Vercel CLI (run once)
vercel login

# Deploy to Vercel
vercel deploy --prod

# Pull Vercel env vars locally
vercel env pull
```
