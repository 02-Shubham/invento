# INVO - Inventory & Invoice Management System

A modern, multi-tenant SaaS platform for inventory and invoice management built with Next.js, Firebase, and TypeScript.

## Features

- 🔐 **Multi-User Authentication** - Secure sign up/login with Firebase Auth
- 📦 **Inventory Management** - Track products, stock levels, and costs
- 📄 **Invoice Creation** - Create professional invoices with automatic stock deduction
- 💳 **Payment Tracking** - Record payments and track outstanding balances
- 🛒 **Purchase Orders** - Manage vendor orders and incoming shipments
- 👥 **Customer Management** - Track customers and their purchase history
- 🤖 **AI API Key Management** - Add your own API keys for future AI features
- 🎨 **Modern UI** - Beautiful, responsive interface built with Tailwind CSS and shadcn/ui

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Backend**: Firebase (Firestore, Authentication)
- **State Management**: Zustand
- **UI Components**: Radix UI, shadcn/ui, Tailwind CSS
- **Forms**: React Hook Form + Zod
- **Charts**: Recharts
- **Tables**: TanStack Table

## Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Firebase account
- Firebase project with Firestore and Authentication enabled

## Setup Instructions

### 1. Firebase Console Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Enable **Firestore Database**:
   - Go to Firestore Database
   - Click "Create database"
   - Start in **production mode** (we'll add security rules)
   - Choose a location close to your users

4. Enable **Authentication**:
   - Go to Authentication
   - Click "Get started"
   - Enable **Email/Password** sign-in method
   - (Optional) Enable **Google** sign-in method

5. Get your Firebase config:
   - Go to Project Settings (gear icon)
   - Scroll down to "Your apps"
   - Click the web icon (`</>`) to add a web app
   - Copy the Firebase configuration object

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

Replace the values with your Firebase configuration from step 1.

### 4. Firestore Security Rules

Copy the security rules from `firestore.rules` and paste them into Firebase Console:

1. Go to Firestore Database → Rules
2. Replace the default rules with the contents of `firestore.rules`
3. Click "Publish"

**Important**: These rules enforce data isolation - each user can only access their own data.

### 5. Install Missing Dependencies

If you encounter errors about missing UI components, install:

```bash
npm install @radix-ui/react-tabs
```

### 6. Run the Development Server

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## First-Time Setup

1. **Create an Account**:
   - Go to `/signup`
   - Enter your email and password
   - Or sign up with Google

2. **Complete Onboarding**:
   - Fill in your business information
   - Select your currency and industry
   - You can skip and complete later in Settings

3. **Add Sample Data** (Optional):
   - Add products in Inventory
   - Add customers
   - Create invoices
   - Record payments

4. **Configure AI API Keys** (Optional):
   - Go to Settings → API Keys
   - Add your Anthropic, OpenAI, or Google API key
   - These will be used for future AI features

## Project Structure

```
├── app/                    # Next.js App Router pages
│   ├── (dashboard)/        # Protected dashboard routes
│   ├── login/              # Authentication pages
│   ├── signup/
│   └── onboarding/
├── components/             # React components
│   ├── auth/               # Authentication components
│   ├── inventory/          # Inventory-related components
│   ├── invoices/           # Invoice components
│   ├── layout/             # Layout components
│   └── ui/                 # shadcn/ui components
├── lib/                    # Utilities and services
│   ├── auth-context.tsx    # Authentication context
│   ├── firebase.ts         # Firebase initialization
│   ├── firestore-service.ts # Firestore operations
│   └── firestore-helpers.ts # Multi-tenancy helpers
├── types/                  # TypeScript type definitions
└── firestore.rules        # Firestore security rules
```

## Multi-Tenancy

This app implements complete data isolation:

- Every document (products, customers, invoices, etc.) includes a `userId` field
- All Firestore queries filter by the current user's ID
- Firestore security rules enforce data isolation at the database level
- Users can only see and modify their own data

## Security Notes

1. **API Keys**: Currently stored as-is in Firestore. For production, implement encryption or use a key management service.

2. **Firestore Rules**: Always test your security rules in the Firebase Console Rules Playground before deploying.

3. **Authentication**: Firebase Auth handles session persistence automatically. Users stay logged in across browser sessions.

## Data Migration

If you have existing data without `userId` fields:

1. **Option 1**: Start fresh (recommended for development)
   - Create a new test account
   - Add sample data as that user
   - Previous data will not be accessible

2. **Option 2**: Run a migration script
   - Manually add `userId` to all existing documents
   - Assign all documents to a specific user
   - Note: This requires careful scripting and testing

## Development

### Common Commands

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

### Testing Multi-Tenancy

1. Create two test accounts (different emails)
2. Log in as User A and create products/customers/invoices
3. Log out and log in as User B
4. Verify User B cannot see User A's data
5. Create data as User B
6. Verify User A cannot see User B's data

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy

### Environment Variables for Production

Make sure to add all Firebase environment variables in your deployment platform's settings.

## Troubleshooting

### "User must be authenticated" errors

- Ensure Firebase Authentication is enabled
- Check that Email/Password sign-in method is enabled
- Verify your Firebase config in `.env.local`

### "Unauthorized" errors when accessing data

- Check Firestore security rules are published
- Verify the document has a `userId` field matching your auth UID
- Check browser console for specific error messages

### Missing UI components

- Install missing Radix UI packages: `npm install @radix-ui/react-tabs`
- Check that all shadcn/ui components are properly installed

## License

Private - All rights reserved

## Support

For issues or questions, please contact the development team.

## AI Function Calling

The AI assistant can now execute real business operations:

### Available Tools (Phase AI-3)
- **search_products**: Search inventory by name or SKU

### How It Works
1. User asks about products
2. AI recognizes need for product search
3. AI calls search_products tool
4. System executes search against your database
5. AI receives results and responds conversationally

### Example
User: "Find leather bags"
→ AI searches products
→ Shows: "I found 2 leather bags: Leather Bag (₹800, 50 in stock)..."

### Privacy & Security
- Tools only access YOUR data (isolated by user ID)
- All actions are logged for audit
- Tools cannot modify data yet (read-only in Phase 3)
