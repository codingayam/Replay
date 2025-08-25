# Vercel Dashboard Settings Fix

## Problem
The build command in your Vercel dashboard is causing deployment failures. The current command `cd client && npm ci && npm run build` is failing.

## Required Dashboard Changes

### 1. Framework Preset
- **Set to**: Other (not Vite or React)

### 2. Build Command
- **Change from**: `cd client && npm ci && npm run build`
- **Change to**: `cd client && npm install && npm run build`
- **Or even better**: Leave empty and let Vercel auto-detect

### 3. Output Directory
- **Set to**: `client/dist`

### 4. Install Command
- **Set to**: `npm install && cd client && npm install`
- **Or**: Leave empty for auto-detection

### 5. Root Directory
- **Set to**: `/` (project root)

## Alternative Simple Approach

The safest approach is to:
1. Set Framework Preset to "Other"
2. Leave Build Command empty
3. Leave Install Command empty
4. Set Output Directory to `client/dist`
5. Set Root Directory to `/`

Then add this to your repository root package.json:

```json
{
  "scripts": {
    "build": "cd client && npm install && npm run build",
    "start": "vercel dev"
  }
}
```

This way Vercel will automatically run `npm run build` from the root, which will handle the client build correctly.

## Why This Fixes the Issue

1. **Dependency Installation**: Using `npm install` instead of `npm ci` is more forgiving in build environments
2. **Auto-detection**: Letting Vercel auto-detect reduces configuration conflicts
3. **Simplified Path**: Using root-level build script removes directory navigation issues
4. **Package-lock.json**: Our .vercelignore fix ensures package-lock.json is available for proper dependency resolution

## Test After Changes

After making these dashboard changes, trigger a new deployment by:
1. Making a small commit (e.g., add a comment to any file)
2. Pushing to main branch
3. Or manually trigger redeploy from Vercel dashboard

The build should now succeed with these settings.