/**
 * Application Entry Point
 * Sets up React Router with the main app and admin routes
 * All routes default to home page if not matched
 */

// import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import App from './App.tsx';
import { StrictMode } from 'react';
// import AdminPage from './routes/AdminPage.tsx';
// Render the application with Router and Strict Mode for development checks
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
