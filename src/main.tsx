import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import App from './App.tsx';
import LoginPage from './routes/LoginPage.tsx'
import './index.css';
import { AuthProvider } from './context/AuthContext.tsx';
import { ShiftProvider } from './context/ShiftContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <ShiftProvider>
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/login" element={<LoginPage />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ShiftProvider>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode >,
);
