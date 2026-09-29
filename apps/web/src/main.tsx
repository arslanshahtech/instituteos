import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/providers.js';
import { createAppRouter } from './app/router.js';
import './styles.css';

const router = createAppRouter();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders router={router} />
  </React.StrictMode>,
);
