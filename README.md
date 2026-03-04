# Planuj Směny App — Employee Portal 🚀

A modern web application for managing employee work shifts. It allows tracking shift starts and ends, monitoring colleagues currently on duty, and switching between locations in real-time.

## 🌟 Key Features

- **Authentication**: Sign in using either Email or Username (integrated with Supabase Auth).
- **Shift Management**: Quick start and end shift actions with a single button.
- **Real-time Monitoring**: Instant updates of colleagues currently on shift without page reloads.
- **Multi-location Support**: Support for multiple venues (halls/restaurants) within a single organization.
- **Role-based Styling**: Visual differentiation of employees by roles (Manager, Supervisor, Waiter, etc.).
- **Responsive Design**: Full support for mobile, tablet, and desktop devices with optimized controls (Sticky buttons).

## 🛠 Tech Stack

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 7](https://vitejs.dev/)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) (using the new Oxide engine)
- **Backend**: [Supabase](https://supabase.com/) (PostgreSQL, Realtime, Auth, RLS)
- **Routing**: [React Router 7](https://reactrouter.com/)

## 📂 Project Structure

```text
src/
├── components/       # UI components (ActiveShift, Dashboard, Clock, etc.)
├── context/          # Global state (AuthContext, ShiftContext)
├── hooks/            # Custom hooks (useAuth, useShifts, useRealtime)
├── services/         # API interaction layer with Supabase
├── routes/           # Application pages (LoginPage, AdminPage)
├── types/            # TypeScript definitions
└── supabaseClient.ts # Supabase client initialization
```

## ⚙️ Backend Setup (Supabase)

The project utilizes the following tables in the `public` schema:
- `organizations`: Companies and their settings.
- `profiles`: Employee data (names, roles, organization links).
- `locations`: Work points within an organization.
- `shifts`: History and current state of shifts.

**Security (RLS)**: Data access is strictly isolated — employees can only see colleagues and locations belonging to their own organization.

## 🚦 Getting Started

### 1. Clone and Install Dependencies
```bash
yarn
```

### 2. Environment Configuration
Create a `.env.local` file in the root directory and add your Supabase project keys:
```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
```

### 3. Run in Development Mode
```bash
yarn dev
```

### 4. Build for Production
```bash
yarn build
```

## 🏗 Application Architecture

The application is built on the principle of **separation of concerns**:
1. **Services**: Encapsulate direct database queries.
2. **Hooks**: Handle business logic and manage local state.
3. **Context**: Provides authentication and shift data to the entire component tree.
4. **Realtime**: Leverages Supabase Channels for instant state synchronization across multiple user devices.

---
Developed with a focus on performance and user experience.
