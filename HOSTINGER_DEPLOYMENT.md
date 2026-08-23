# Hostinger hPanel Deployment Guide

Complete step-by-step guide to deploy the video upload platform on Hostinger.

## Prerequisites

✅ Domain registered and pointing to Hostinger  
✅ hPanel access  
✅ MySQL database available  
✅ GitHub account with code pushed

## Step 1: Set Up MySQL Database

### 1.1 Create Database in hPanel

1. Log in to **Hostinger hPanel**
2. Go to **Databases → MySQL Databases**
3. Click **Create New Database**
4. Fill in:
   - **Database Name:** `video_platform_db`
   - **Username:** Create new (e.g., `videouser`)
   - **Password:** Strong password (save this!)
   - **Collation:** `utf8mb4_unicode_ci`
5. Click **Create**

### 1.2 Import Database Schema

1. Go to **Databases → MySQL Databases**
2. Click **Manage** on your newly created database
3. This opens **phpMyAdmin**
4. In phpMyAdmin:
   - Select your database from the left sidebar
   - Click **Import** tab
   - Upload the file: `config/db-schema.sql`
   - Click **Import**

✅ Your database is now set up with all tables!

## Step 2: Set Up Node.js Application

### 2.1 Create Node.js App in hPanel

1. Go to **Node.js Applications**
2. Click **Create Node.js Application**
3. Fill in the following:

   | Field | Value |
   |-------|-------|
   | **Application Name** | `video-upload-platform` |
   | **Node Version** | `18.x` or `20.x` (latest available) |
   | **Application root** | `/video-upload-platform` (or your preferred folder) |
   | **Startup file** | `server.js` |
   | **Port** | `3000` (or auto-assigned) |

4. Click **Create**

### 2.2 Note Your Application URL

After creation, hPanel will show:
- **Application URL:** Something like `https://yourdomain.com:3000`
- **Assigned Port:** Note this (usually 3000)

Save this information!

## Step 3: Deploy Code via Git

### 3.1 Connect GitHub Repository

1. Go to **Advanced → Git**
2. Click **Create New Repository**
3. Fill in:

   | Field | Value |
   |-------|-------|
   | **Repository URL** | `https://github.com/backpackboyys/backpackboyys-video.git` |
   | **Deployment folder** | `/video-upload-platform` (same as app root) |
   | **Branch** | `main` |

4. Click **Create**

✅ Hostinger will pull your code from GitHub

### 3.2 Update Code (After Each Change)

Every time you push changes to GitHub:

1. Go back to **Advanced → Git**
2. Find your repository
3. Click **Pull** button
4. Hostinger will pull the latest code

## Step 4: Configure Environment Variables

### 4.1 Create .env File via File Manager

1. Go to **File Manager**
2. Navigate to `/video-upload-platform` folder
3. Click **Create New File**
4. Name it `.env`
5. Edit it with the following content:

```env
DB_HOST=localhost
DB_USER=videouser
DB_PASSWORD=your_database_password_here
DB_NAME=video_platform_db
DB_PORT=3306

PORT=3000
NODE_ENV=production

JWT_SECRET=your_super_secret_jwt_key_change_this_to_something_random_like_abc123xyz

STRIPE_PUBLIC_KEY=pk_test_your_key_here
STRIPE_SECRET_KEY=sk_test_your_key_here

MAX_FILE_SIZE=5000000000
UPLOAD_DIR=uploads/videos

FRONTEND_URL=https://yourdomain.com
```

⚠️ **IMPORTANT:** Replace these values:
- `your_database_password_here` → Your MySQL password
- `your_super_secret_jwt_key_...` → Generate a random string (at least 32 characters)
- `yourdomain.com` → Your actual domain

## Step 5: Install Dependencies

### 5.1 Install via Terminal (If available)

1. In **File Manager**, navigate to `/video-upload-platform`
2. Click the **Terminal** icon (if available)
3. Run:
   ```bash
   npm install
   npm run build
   ```

### 5.2 Alternative: Pre-upload node_modules

If terminal isn't available:

1. On your local machine, in project root:
   ```bash
   npm install
   ```
2. Use FTP/SFTP to upload the `node_modules/` folder to `/video-upload-platform`

## Step 6: Start the Application

### 6.1 Start Node.js App

1. Go back to **Node.js Applications**
2. Find your application: `video-upload-platform`
3. Click the **Start** button (toggle)
4. Wait 10-15 seconds for startup

✅ Your app is now running!

### 6.2 Verify It's Running

1. Open your browser
2. Go to: `https://yourdomain.com:3000/api/health`
3. You should see: `{"status":"Server running"}`

🎉 Backend is live!

## Step 7: Create Frontend (React)

### 7.1 Initialize React in `/client` Folder

1. In **File Manager**, inside `/video-upload-platform` folder
2. Create a new folder named `client`
3. In your local machine terminal:
   ```bash
   cd video-upload-platform/client
   npx create-react-app .
   npm install axios react-router-dom
   ```
4. Upload the `client` folder to Hostinger via FTP/SFTP

### 7.2 Build React for Production

In your local terminal:
```bash
cd client
npm run build
```

This creates a `build/` folder with optimized static files.

### 7.3 Configure Express to Serve React

The `server.js` file already includes this code:
```javascript
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build/index.html'));
  });
}
```

✅ React will be automatically served on your main domain!

## Step 8: Create Uploads Folder

### 8.1 Create Uploads Directory

1. In **File Manager**, navigate to `/video-upload-platform`
2. Create folder: `uploads`
3. Inside `uploads`, create: `videos`

```
/video-upload-platform
├── uploads/
│   └── videos/   ← Videos stored here
├── client/
├── config/
├── routes/
└── server.js
```

### 8.2 Set Permissions

1. Right-click `uploads` folder → **Properties**
2. Set permissions to `755` (read/write/execute)

## Step 9: Test Your Application

### 9.1 Test Backend API

1. Open browser: `https://yourdomain.com:3000/api/health`
2. Should return: `{"status":"Server running"}`

### 9.2 Test Register Endpoint

```bash
curl -X POST https://yourdomain.com:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 9.3 Test Frontend

1. Open: `https://yourdomain.com`
2. You should see React app loading

## Step 10: Set Up SSL (HTTPS)

Hostinger usually provides free SSL via:

1. Go to **Domains**
2. Find your domain
3. Check if **SSL Certificate** is installed
4. If not, click **Install SSL**

✅ SSL should be installed automatically (Let's Encrypt)

## Troubleshooting

### Application not starting?

1. Check **Node.js Applications** → View logs
2. Verify `.env` file has correct database credentials
3. Ensure database was imported correctly in phpMyAdmin
4. Try **Stop** then **Start** the application

### Can't connect to database?

1. Go to **Databases → MySQL Databases**
2. Verify username and password in `.env` match
3. In phpMyAdmin, check if database and tables exist
4. Check database user has proper permissions

### Uploads folder giving permission error?

1. In **File Manager**, right-click `uploads` → **Properties**
2. Set to `755` permissions
3. Try uploading again

### Git pull not working?

1. Ensure repository URL is correct (starts with `https://`)
2. Verify repository is public or use a personal access token
3. Check branch name is correct (usually `main`)

## Monitoring & Updates

### Check Application Status

**Node.js Applications** section shows:
- Running/Stopped status
- CPU/Memory usage
- Last restart time

### Update Code

Every time you make changes:
1. Push to GitHub: `git push origin main`
2. In hPanel **Advanced → Git**, click **Pull**
3. Node.js app auto-restarts with new code

### View Logs

1. **Node.js Applications** → Your app → **View Logs**
2. Useful for debugging errors

## Next Steps

1. ✅ Build React frontend components
2. ✅ Integrate Stripe for payments
3. ✅ Add age verification service (Yoti, Veratad)
4. ✅ Set up video transcoding (FFmpeg)
5. ✅ Create admin dashboard for moderation
6. ✅ Add email notifications

## Support

For Hostinger-specific issues:
- Contact **Hostinger Support** via hPanel
- Check Hostinger Knowledge Base

For application issues:
- Check application logs in hPanel
- Review this guide
- Create GitHub issue

---

**🎉 Your video upload platform is now live on Hostinger!**
