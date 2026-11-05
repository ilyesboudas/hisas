import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
// Service Worker registration and lifecycle are centrally handled via useAppUpdate hook in UpdateNotificationBanner

createRoot(document.getElementById('root')!).render(<App />);
