import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import './App.css';

/**
 * --- ENTRY POINT (main.tsx) ---
 * This file is the absolute starting point of the application.
 * It mounts the React app into the HTML 'root' element.
 */

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* 
      BrowserRouter: Handles URL management (navigation).
      App: Our main component defined in App.tsx.
    */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
