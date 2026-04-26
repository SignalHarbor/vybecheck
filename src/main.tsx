import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './frontend/App';
import './frontend/index.css';
import { initAnalytics } from './frontend/utils/analytics';

initAnalytics();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
