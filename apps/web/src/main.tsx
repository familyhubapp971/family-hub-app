import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary, initSentry } from './sentry';
import './index.css';

initSentry();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('missing #root element');

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary fallback={<p>Something went wrong. Refresh to try again.</p>}>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
