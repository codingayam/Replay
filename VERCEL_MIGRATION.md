# Complete Vercel Migration Guide

## 🚀 Deploy Everything on Vercel

Your app can run 100% on Vercel using serverless functions instead of Railway.

### Current Status
- ✅ Frontend already on Vercel
- ✅ API functions foundation created
- ✅ Configuration updated
- 🔄 Need to convert remaining Express routes

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Set Environment Variables in Vercel Dashboard
Go to Vercel Dashboard → Project → Settings → Environment Variables:

**Production Variables:**
- `VITE_SUPABASE_URL` = `https://nuezhhuuwhqrapwznymn.supabase.co`
- `VITE_SUPABASE_ANON_KEY` = `your_anon_key`
- `VITE_API_URL` = `https://replay.agrix.ai`
- `SUPABASE_URL` = `https://nuezhhuuwhqrapwznymn.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = `your_service_role_key`
- `GEMINI_API_KEY` = `your_gemini_key`
- `REPLICATE_API_TOKEN` = `your_replicate_token`

### Step 3: Test Locally
```bash
npm run dev
```

### Step 4: Deploy
```bash
npm run deploy
```

### Step 5: Convert Remaining Routes
The following Express routes need conversion to `/api` functions:
- [ ] POST /api/notes (audio upload)
- [ ] POST /api/notes/photo 
- [ ] DELETE /api/notes/:id
- [ ] GET/POST /api/profile
- [ ] POST /api/reflect/suggest
- [ ] POST /api/reflect/summary
- [ ] POST /api/meditate
- [ ] GET/DELETE /api/meditations

### Benefits of Full Vercel Migration:
✅ No more Railway deployment issues
✅ Everything in one platform
✅ Auto-scaling serverless functions
✅ Global CDN performance
✅ Simpler deployment process
✅ Better reliability

### Limitations to Consider:
⚠️ 10-second function timeout
⚠️ 50MB deployment size limit
⚠️ Cold start delays (first request)

### Migration Strategy:
1. **Phase 1**: Test health and notes endpoints ✅
2. **Phase 2**: Convert remaining API routes
3. **Phase 3**: Full deployment switch
4. **Phase 4**: Remove Railway dependency