import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/quicksand/600.css';
import '@fontsource/quicksand/700.css';
import './styles/app.css';
import { App } from './App';
import { StoreProvider } from './state/store';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);
