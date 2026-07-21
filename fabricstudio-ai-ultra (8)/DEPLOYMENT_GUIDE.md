# 🚀 Complete Deployment Guide for Your Catalog Studio

Congratulations on getting your domain! Now that you have your own domain, follow this step-by-step guide to download, configure, and deploy your full-stack React + Express application.

---

## Step 1: Downloading & Initial Setup

When you download this code (via "Export to ZIP" or "Export to GitHub" in the AI Studio settings), you will need to prepare it for local development and eventual deployment.

1. **Extract/Clone the code** to your local machine.
2. **Install Node.js**: Ensure you have Node.js installed (version 18 or 20+ recommended).
3. **Install Dependencies**: Open your terminal in the project folder and run:
   ```bash
   npm install
   ```

---

## Step 2: What to Change in the Code

When moving from the AI Studio sandbox to your own hosting, you need to configure your environment variables securely.

1. **Create an Environment File**: 
   Rename the `.env.example` file to `.env` (or create a new file named `.env`).

2. **Fill in your API Keys**:
   Inside `.env`, you must provide real values for all your secrets. The system will no longer inject them automatically like it did in AI Studio:
   ```env
   # Your AI Generation Key
   GEMINI_API_KEY="your_actual_gemini_api_key_here"

   # IMPORTANT: Update this to your NEW domain!
   APP_URL="https://www.yournewdomain.com"
   
   # Payment Gateway (Razorpay)
   RAZORPAY_KEY_ID="your_razorpay_key_id"
   RAZORPAY_KEY_SECRET="your_razorpay_key_secret"

   # Cloudinary (Image Storage)
   CLOUDINARY_CLOUD_NAME="your_cloud_name"
   CLOUDINARY_API_KEY="your_cloudinary_api_key"
   CLOUDINARY_API_SECRET="your_cloudinary_api_secret"
   ```

3. **Check `server.ts` (Optional)**: 
   If your frontend and backend will be hosted together on the same server, you don't need to change anything. However, if you plan to separate them, you'll need to configure `cors` in `server.ts` to explicitly allow your new domain.

---

## Step 3: Test Locally

Before pushing to production, verify it works on your machine.

1. Start the development server:
   ```bash
   npm run dev
   ```
2. Open `http://localhost:3000` in your browser.
3. Test a complete flow (uploading an image, generating a pose, and making a test payment).

---

## Step 4: Deployment Strategy

Because this application uses a custom backend (`server.ts`) to hide your API keys (Gemini, Razorpay) from the browser, you **cannot** use static hosts like GitHub Pages or Netlify's free static tier. You need a platform that supports Node.js servers.

We highly recommend **Render**, **Railway**, or **Google Cloud Run**. 

### Option A: Deploying to Render.com (Recommended for Beginners)
1. Push your code to a GitHub repository.
2. Go to [Render.com](https://render.com) and create an account.
3. Click **New +** and select **Web Service**.
4. Connect your GitHub account and select your repository.
5. Configuration:
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start`
6. **Environment Variables**: Scroll down and add all the variables from your `.env` file (GEMINI_API_KEY, APP_URL, RAZORPAY keys, CLOUDINARY keys) into Render's UI.
7. Click **Create Web Service**. 

### Option B: Deploying to Railway.app
1. Create an account at [Railway.app](https://railway.app).
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Once imported, click on your service, go to the **Variables** tab, and paste all your `.env` variables.
4. Railway will automatically detect Node.js and build it. Go to the **Settings** tab to generate a public URL.

---

## Step 5: Connect Your Custom Domain

Once your app is successfully deployed and running on the provider's default URL (e.g., `your-app.onrender.com`):

1. Go to your hosting provider's **Settings** (Render/Railway).
2. Look for the **Custom Domains** section.
3. Add your new domain (e.g., `www.yourdomain.com`).
4. The provider will give you a **DNS record** (usually a `CNAME` or `A` record).
5. Go to your Domain Registrar (where you bought the domain, like GoDaddy, Namecheap, or Cloudflare).
6. Open your **DNS Settings** and add the record provided by your host:
   - **Type**: `CNAME`
   - **Name**: `www` (or `@` for the root)
   - **Value**: `your-app.onrender.com`
7. Save the DNS settings. It may take anywhere from 15 minutes to 24 hours for the domain to propagate globally.

## Step 6: Final Verification
1. Open `https://www.yourdomain.com` in your browser.
2. Double-check that your payment webhooks (if using Razorpay dashboard) are updated to point to `https://www.yourdomain.com/api/payment-webhook` instead of localhost or the AI Studio URL.
3. Update `APP_URL` in your hosting provider's environment variables to your custom domain!
