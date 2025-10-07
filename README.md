# FineEarn - AI Training Platform

A comprehensive platform for earning money by training AI models through simple tasks.

---

## Project info

**URL**: https://lovable.dev/projects/58f14c52-1807-4325-92b0-0e5655c0bd8e

---

## 🌟 Features

### Core Features
- **Task Management**: Complete AI training tasks and earn money
- **Multi-Tier Membership**: Free, Personal, Business, and Group plans
- **Referral System**: Earn commissions from referrals' tasks and deposits
- **Dual Wallet System**: Separate deposit and earnings wallets
- **Secure Transactions**: Complete transaction history and management
- **Admin Dashboard**: Comprehensive admin panel for platform management

### Earning Opportunities
- Complete daily AI training tasks
- Earn from referral commissions
- Upgrade plans for higher earnings
- Multiple withdrawal methods

### Security
- Row-Level Security (RLS) policies on all tables
- Secure authentication with Supabase
- Server-side validation for all operations
- Protected admin routes

---

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Edge Functions)
- **UI Components**: Shadcn/ui
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod validation
- **State Management**: React Query

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ or Bun
- Supabase project (automatically configured via Lovable Cloud)

### Installation

```bash
# Step 1: Clone the repository
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory
cd <YOUR_PROJECT_NAME>

# Step 3: Install dependencies
npm install
# or
bun install

# Step 4: Start development server
npm run dev
# or
bun dev
```

### Environment Variables

The following environment variables are automatically configured via Lovable Cloud:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase anon key
- `VITE_SUPABASE_PROJECT_ID`: Your Supabase project ID

---

## 📁 Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── layout/      # Layout components (Sidebar)
│   ├── shared/      # Shared components (LoadingSpinner, ErrorBoundary)
│   ├── tasks/       # Task-related components
│   ├── wallet/      # Wallet components
│   ├── referrals/   # Referral components
│   └── ui/          # Shadcn UI components
├── hooks/           # Custom React hooks
├── lib/             # Utility functions and helpers
├── pages/           # Application pages/routes
└── integrations/    # Third-party integrations (Supabase)

supabase/
├── functions/       # Edge Functions
│   ├── complete-task/
│   ├── deposit/
│   ├── withdraw/
│   ├── upgrade-plan/
│   └── reset-daily-counters/
└── config.toml     # Supabase configuration
```

---

## 🎯 Key Features

### Membership Plans
- **Free**: Basic access with limited daily tasks
- **Personal**: Increased limits and referral commissions
- **Business**: Higher earnings and more daily tasks
- **Group**: Maximum limits with enterprise features

### Task System
- Daily task assignments based on membership plan
- Time-limited tasks with expiration
- Earnings credited immediately upon completion
- Task skip allowance (varies by plan)

### Referral System
- Unique referral code for each user
- Commission on referrals' completed tasks
- Commission on referrals' deposits
- Maximum active referrals limit (varies by plan)

### Wallet System
- **Deposit Wallet**: For plan upgrades and deposits
- **Earnings Wallet**: For task earnings and withdrawals
- Separate transaction tracking for each wallet
- Multiple withdrawal methods supported

---

## 🗄️ Database Schema

### Key Tables
- `profiles`: User profiles and wallet balances
- `membership_plans`: Available membership tiers
- `tasks`: Available AI training tasks
- `user_tasks`: User-specific task assignments
- `transactions`: All financial transactions
- `referral_earnings`: Referral commission tracking
- `user_roles`: Role-based access control

All tables have Row-Level Security (RLS) policies enabled.

---

## ⚡ Edge Functions

- **complete-task**: Handles task completion and earnings
- **deposit**: Processes deposits with referral tracking
- **withdraw**: Handles withdrawal requests
- **upgrade-plan**: Manages plan upgrades
- **reset-daily-counters**: Daily cron job for counter resets

---


## 🚀 Deployment

### Deploy with Lovable

Simply open [Lovable](https://lovable.dev/projects/58f14c52-1807-4325-92b0-0e5655c0bd8e) and click on Share -> Publish.

### Custom Domain

To connect a custom domain:
1. Navigate to Project > Settings > Domains
2. Click Connect Domain
3. Follow the DNS configuration instructions

Read more: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)

---

## 👨‍💼 Admin Access

The first user to sign up automatically receives admin privileges. Admin features include:
- User management and statistics
- Task creation and management
- Transaction oversight and approval
- Membership plan configuration
- Platform analytics

Access the admin panel at `/admin` after logging in with an admin account.

---

## 🔒 Security

- All tables protected with Row-Level Security (RLS)
- Server-side validation for critical operations
- Secure authentication via Supabase
- Input sanitization and validation
- Protected admin routes
- Secure edge functions with JWT verification

---

## 📝 Development Guidelines

### Code Style
- Use TypeScript for type safety
- Follow React best practices
- Use functional components with hooks
- Implement proper error handling
- Add loading states for async operations

### Testing
- Test all user flows thoroughly
- Verify RLS policies are working
- Test edge functions independently
- Check responsive design on all devices

---

## 📚 Additional Resources

- [Lovable Documentation](https://docs.lovable.dev/)
- [Supabase Documentation](https://supabase.com/docs)
- [React Documentation](https://react.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

---

Built with ❤️ using Lovable and Supabase
