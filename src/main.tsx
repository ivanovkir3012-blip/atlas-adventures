import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: 'none',
    }).then(registration => {
      // Check for a fresh worker on every app launch instead of relying only
      // on the browser's periodic service-worker update interval.
      void registration.update().catch(error => {
        console.warn('Не удалось проверить обновление приложения:', error);
      });

      // A newly activated worker takes control immediately. Reload once so
      // the open tab uses the new app shell and hashed assets.
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        const userIsEditing = document.querySelector(
          'input:focus, textarea:focus, select:focus, [contenteditable="true"]:focus',
        );
        if (!userIsEditing) window.location.reload();
      }, { once: true });
    }).catch(error => {
      console.warn('Не удалось зарегистрировать офлайн-режим:', error);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
