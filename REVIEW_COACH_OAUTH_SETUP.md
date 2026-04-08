# Google Business Profile OAuth Setup

To make the "Sign in with Google" button work in Review Coach, you need to set up Google OAuth credentials.

## Steps:

### 1. Create a Google Cloud Project
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create a new project (or use existing)
- Enable the "My Business API" and "My Business Business Information API"

### 2. Create OAuth 2.0 Credentials
- Go to **Credentials** in the left menu
- Click **Create Credentials** → **OAuth Client ID**
- Choose **Web application**
- Add authorized redirect URIs:
  - `http://localhost:3000/api/auth/google/callback` (for local development)
  - `https://yourdomain.com/api/auth/google/callback` (for production)
- Copy the **Client ID** and **Client Secret**

### 3. Add to `.env.local`
```
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

### 4. Test It Out
1. Start your dev server: `npm run dev`
2. Create an audit report
3. Click **Reviews** button in the report header
4. Click **Sign in with Google**
5. A popup will open asking you to authenticate
6. After auth, your locations should load automatically

## What Permissions Are Requested?

The app requests the `business.manage` scope which gives access to:
- Your Google Business Profile accounts
- Your business locations
- Your reviews (read-only)

The app **never** posts replies or modifies anything — it only reads your reviews for analysis.

## Troubleshooting

**"Fetch failed" after signing in**
- Check that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set correctly
- Verify the redirect URI matches exactly what you configured in Google Cloud Console

**Locations not loading**
- The GBP account must have at least one location
- The OAuth token may have expired — disconnect and reconnect

**Sign in popup blocked**
- Some browsers block popups by default
- Add an exception for your local dev environment or your production domain

