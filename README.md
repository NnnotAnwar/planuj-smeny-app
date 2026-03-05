# Planuj Směny App

A modern, cross-platform shift management application built for employees and managers. This app provides real-time updates on active shifts, colleague presence, and location-based check-ins.

> **⚠️ Project Status: Under Active Development**  
> This application is currently in its prototype/beta phase. Features and UI are subject to frequent updates.  
> *Last updated: March 5, 2026*

## 🚀 Key Features

- **Real-time Sync**: Instant updates when colleagues start or end their shifts via Supabase Realtime.
- **Cross-Platform**: Works as a high-performance web app and as native Android/iOS applications (via Capacitor).
- **Dark Mode Support**: Seamlessly switch between Light, Dark, and System themes with native Status Bar integration.
- **Mobile-First Design**: Full-screen animated menus, glassmorphism UI, and horizontal location selection grid.
- **Haptic Feedback**: Tactile vibrations on native devices for important actions like starting or ending a shift.
- **Location Management**: Search and filter through 20+ workplace locations with ease.

## 🛠 Tech Stack

- **Frontend**: React 19 (TypeScript), Vite
- **Styling**: Tailwind CSS v4 (Glassmorphism, Background Gradients)
- **Animations**: Framer Motion
- **Backend/Database**: Supabase (PostgreSQL, Realtime, Auth)
- **Native Wrapper**: Capacitor (Android & iOS)

## 📱 Mobile Native Integration

The app is wrapped using **Capacitor**, providing:
- Full-screen display with Safe Area support.
- Native Status Bar theme synchronization.
- Haptic feedback (Impact Heavy) on interaction.
- App lifecycle listeners to prevent data duplication on resume.

## 📦 Getting Started

### Development
1. Clone the repository.
2. Install dependencies: `yarn install`.
3. Start the dev server: `yarn dev`.

### Build for Native
1. Build the web project: `yarn build`.
2. Sync with native platforms: `npx cap sync`.
3. Open in IDE:
   - Android: `npx cap open android`
   - iOS: `npx cap open ios`

---
*Created by Anuar Kairulla*
