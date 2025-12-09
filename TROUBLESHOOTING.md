# MongoDB Connection Troubleshooting Guide

## Current Issue: 503 Service Unavailable

The server is returning a 503 error because it cannot connect to MongoDB Atlas.

## Quick Diagnosis Steps

### 1. Check Server Console Logs
Look at the terminal where you ran `npm start` in the `server` directory. You should see detailed error messages that will tell you exactly what's wrong.

### 2. Check Connection Status
Visit: `http://localhost:3000/health`

This will show you:
- Database connection status
- Number of reconnection attempts
- Current timestamp

### 3. Common Issues and Solutions

#### Issue: Authentication Failed
**Error message will say:** "authentication failed" or error code 18

**Solution:**
1. Go to MongoDB Atlas → Database Access
2. Verify the username is `sohaib` and password is `test123`
3. If password is different, update the connection string in `server/index.js`
4. Ensure the user has "Read and write to any database" permissions

#### Issue: IP Not Whitelisted (Most Common)
**Error message will say:** "SSL/TLS connection error" or "ECONNRESET"

**Solution:**
1. Go to MongoDB Atlas → Network Access
2. Click "Add IP Address"
3. For development, you can use `0.0.0.0/0` (allows all IPs - only for development!)
4. For production, add your specific IP address
5. Wait 1-2 minutes for changes to take effect
6. Restart your server

#### Issue: Cluster Not Running
**Error message will say:** "timeout" or "ETIMEDOUT"

**Solution:**
1. Go to MongoDB Atlas → Clusters
2. Check if your cluster is running (not paused)
3. If paused, click "Resume" and wait for it to start

#### Issue: Wrong Connection String
**Error message will say:** "ENOTFOUND" or "getaddrinfo"

**Solution:**
1. Go to MongoDB Atlas → Clusters
2. Click "Connect" on your cluster
3. Select "Connect your application"
4. Copy the connection string
5. Replace `<password>` with your actual password
6. Update the connection string in `server/index.js` line 23-24

### 4. Manual Reconnection
If the automatic reconnection isn't working, you can manually trigger it:

**Using curl:**
```bash
curl -X POST http://localhost:3000/reconnect
```

**Using browser:**
Visit: `http://localhost:3000/reconnect` (but this is a POST endpoint, so use a tool like Postman)

**Or simply restart the server:**
```bash
# Stop the server (Ctrl+C)
# Then start it again
npm start
```

### 5. Using Environment Variable
You can set the MongoDB connection string as an environment variable:

**Windows (PowerShell):**
```powershell
$env:MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/vehicles-db?retryWrites=true&w=majority"
npm start
```

**Windows (Command Prompt):**
```cmd
set MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/vehicles-db?retryWrites=true&w=majority
npm start
```

**Linux/Mac:**
```bash
export MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/vehicles-db?retryWrites=true&w=majority"
npm start
```

## What to Check Right Now

1. **Open MongoDB Atlas** in your browser
2. **Check Network Access:**
   - Go to Network Access
   - Is your IP address listed? (Or is 0.0.0.0/0 there?)
   - If not, add it and wait 2 minutes

3. **Check Database Access:**
   - Go to Database Access
   - Is user `sohaib` listed?
   - Does it have the correct password?

4. **Check Cluster Status:**
   - Go to Clusters
   - Is the cluster running? (Not paused)

5. **Check Server Logs:**
   - Look at the terminal where the server is running
   - What error message do you see?
   - The error message will tell you exactly what's wrong

## Still Not Working?

1. Check the server console for the exact error message
2. The error message will have a "DIAGNOSIS" section that tells you what to fix
3. Follow the specific solution for your error type

## Test Connection

Once you've fixed the issue, check:
- `http://localhost:3000/health` - Should show "connected"
- `http://localhost:3000/vehicles` - Should return vehicle data (or empty array)

