# HIFIX Backend - Cloud Deployment Guide

## Deployed Backend URL
Once deployed, your backend will be at: `https://your-app-name.onrender.com`

## Database Options

### Option 1: Free MySQL Database (Recommended)
1. **Railway** - https://railway.app
   - Free tier: 500 hours/month
   - Easy MySQL setup
   - Get connection string

2. **PlanetScale** - https://planetscale.com
   - Free tier: 5GB storage
   - MySQL-compatible
   - Get connection string

### Option 2: Keep Local MySQL & Use ngrok (Temporary)
```bash
ngrok tcp 3306
```
Then use the ngrok URL as DB_HOST

## Deployment Steps

### 1. Push to GitHub
```bash
cd C:/Users/LENOVO/Desktop/pro/hifix-new/backend
git init
git add .
git commit -m "Initial backend deployment"
git branch -M main
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 2. Deploy on Render
1. Go to https://render.com (free account)
2. Click "New +" → "Web Service"
3. Connect your GitHub repo
4. Configure:
   - **Name**: hifix-backend
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### 3. Set Environment Variables in Render Dashboard
Add these in the "Environment" tab:
```
DB_HOST=your-database-host
DB_USER=your-database-user
DB_PASSWORD=your-database-password
DB_NAME=hifix_db
JWT_SECRET=generate-a-random-string
JWT_EXPIRE=30d
EMAIL_USER=your-email
EMAIL_PASSWORD=your-email-app-password
PORT=5000
HOST=0.0.0.0
NODE_ENV=production
```

### 4. Deploy
- Click "Create Web Service"
- Wait 5-10 minutes for deployment
- Get your URL: `https://hifix-backend-xxxx.onrender.com`

### 5. Update Frontend
Change API_BASE_URL in:
- `hifix-new/config/api.js`
- `frontend/config/api.js`

From: `http://192.168.138.251:5000/api`
To: `https://hifix-backend-xxxx.onrender.com/api`

## Quick Database Setup (Railway)

1. Go to https://railway.app
2. "New Project" → "Provision MySQL"
3. Click MySQL → "Connect" → Copy connection string
4. Parse connection string:
   - Host: `xxxx.railway.app`
   - User: from connection string
   - Password: from connection string
   - Database: `railway`
   - Port: 3306

5. Add to Render environment variables

## Test Your Deployed Backend
```bash
curl https://your-backend-url.onrender.com/api/health
```

Should return: `{"success":true,"message":"HIFIX API is running"}`
