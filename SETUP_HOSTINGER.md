# Quick Hostinger Setup

## The Problem
The `client` folder exists in GitHub but wasn't deployed to Hostinger because Git only pulls what's tracked.

## The Fix - Do This Now!

### Step 1: Create Client Folder on Hostinger
1. **File Manager** → Navigate to your deployment folder
2. **Create New Folder**: `client`
3. Inside `client`, create another folder: `build`

### Step 2: Copy React Files from GitHub
1. Go to: https://github.com/backpackboyys/backpackboyys-video
2. Open the `client` folder
3. Download these files/folders to your computer:
   - `package.json`
   - `public/` folder
   - `src/` folder
   - `.gitignore`

4. **Upload to Hostinger:**
   - File Manager → `client` folder
   - Upload the files/folders you just downloaded

### Step 3: Install & Build
1. **Terminal** (in your deployment folder):
   ```bash
   cd client
   npm install
   npm run build
   cd ..
   ```

2. This creates the `client/build` folder with optimized React app

### Step 4: Restart & Test
1. **Web Apps** → Stop app
2. Wait 10 seconds
3. **Start** app
4. Visit: `https://api.backpackboyys.com`
5. You should see the login page! ✅

---

## Alternative: Simpler Fix

If you don't want to deal with React right now:

1. **Stop your app** in Web Apps
2. **Edit `.env`** and change:
   ```
   npm run build
   ```
   to just:
   ```
   npm install
   ```
   (Remove the build step from package.json)

3. **Restart** the app
4. Test API: `https://api.backpackboyys.com/api/health`

You'll have the backend API running, just without the React frontend UI.

---

## Next: Build React Locally (Recommended)

If uploading files is tedious, do this on your computer:

```bash
# Clone repo
git clone https://github.com/backpackboyys/backpackboyys-video.git
cd backpackboyys-video

# Build React
cd client
npm install
npm run build
cd ..

# Push back to GitHub
git add .
git commit -m "Build React frontend"
git push origin main

# Pull on Hostinger
# In Web Apps → Git → Pull
```

---

**Which option works best for you?**

1. Upload React files manually (5 minutes)
2. Build locally → Push to GitHub (10 minutes)
3. Skip React for now, just run backend API
