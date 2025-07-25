# Deployment Guide

This guide will help you deploy the frontend on Vercel and the backend on Render.

## 🚀 Frontend Deployment (Vercel)

### Method 1: Using Vercel CLI

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy to Vercel**:
   ```bash
   cd webrtc-client
   vercel --prod
   ```

### Method 2: Using Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `webrtc-client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

### Environment Variables for Vercel

Set these in your Vercel project settings:

```env
VITE_API_URL=https://your-backend-app.onrender.com
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_TURN_SERVER_URL=turn:54.210.247.10:3478
VITE_TURN_USERNAME=webrtc
VITE_TURN_PASSWORD=webrtc
VITE_ENABLE_RECORDING=true
VITE_ENABLE_BOT_FEATURES=true
```

## 🔧 Backend Deployment (Render)

### Step 1: Prepare Backend for Render

1. **Navigate to backend directory**:
   ```bash
   cd ../webrtc-signaling-server
   ```

2. **Ensure package.json has proper scripts**:
   ```json
   {
     "scripts": {
       "start": "node server.js",
       "dev": "nodemon server.js"
     }
   }
   ```

### Step 2: Deploy on Render

1. Go to [render.com](https://render.com) and sign in
2. Click "New +" and select "Web Service"
3. Connect your GitHub repository
4. Configure the service:

   **Basic Settings:**
   - **Name**: `360-backend` (or your preferred name)
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: `webrtc-signaling-server`

   **Build & Deploy:**
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### Step 3: Environment Variables for Render

Set these in your Render service environment variables:

```env
# Database
MONGODB_URI=your_mongodb_atlas_connection_string

# JWT
JWT_SECRET=your_jwt_secret_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# CORS
CORS_ORIGIN=https://your-frontend-app.vercel.app

# TURN Server
TURN_USER=webrtc
TURN_PASS=webrtc

# Xirsys (Optional - for ICE servers)
XIRSYS_ENDPOINT=your_xirsys_endpoint
XIRSYS_IDENT=your_xirsys_ident
XIRSYS_SECRET=your_xirsys_secret
```

### Step 4: Update Frontend with Backend URL

Once your backend is deployed, update your frontend's environment variables with the new backend URL:

```env
VITE_API_URL=https://your-backend-app.onrender.com
```

## 🔄 Continuous Deployment

Both Vercel and Render support automatic deployments:

- **Vercel**: Automatically deploys on push to main branch
- **Render**: Automatically deploys on push to main branch

## 📋 Deployment Checklist

### Frontend (Vercel)
- [ ] Repository connected to Vercel
- [ ] Environment variables set
- [ ] Build successful
- [ ] Domain configured (optional)

### Backend (Render)
- [ ] Repository connected to Render
- [ ] Environment variables set
- [ ] Database connection working
- [ ] Service is running
- [ ] CORS configured for frontend domain

### Testing
- [ ] Frontend loads without errors
- [ ] Authentication works
- [ ] WebRTC connections establish
- [ ] Recording functionality works
- [ ] AI features work (if enabled)

## 🐛 Troubleshooting

### Common Issues

1. **Build Failures**:
   - Check build logs in Vercel/Render dashboard
   - Ensure all dependencies are in package.json
   - Verify Node.js version compatibility

2. **Environment Variables**:
   - Double-check all environment variables are set
   - Ensure no typos in variable names
   - Restart services after adding new variables

3. **CORS Errors**:
   - Verify CORS_ORIGIN in backend matches frontend URL
   - Check that frontend URL is exactly correct (including https://)

4. **Database Connection**:
   - Verify MongoDB Atlas connection string
   - Check IP whitelist in MongoDB Atlas
   - Ensure database user has proper permissions

5. **WebRTC Issues**:
   - Verify TURN server credentials
   - Check ICE server configuration
   - Ensure HTTPS is used (required for WebRTC)

### Useful Commands

```bash
# Check Vercel deployment status
vercel ls

# View Vercel logs
vercel logs

# Redeploy frontend
vercel --prod

# Check Render logs
# (Use Render dashboard)
```

## 🔗 Final URLs

After deployment, you should have:

- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://your-backend-app.onrender.com`

Update your environment variables accordingly and test all functionality! 