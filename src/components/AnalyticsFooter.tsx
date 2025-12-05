import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * AnalyticsFooter component.
 * Renders a hidden or visible footer that injects external tracking scripts
 * (e.g., Hotjar, Google Analytics) if enabled.
 * 
 * Ideally placed in App.tsx or a global layout.
 */
export function AnalyticsFooter() {
  const location = useLocation();

  useEffect(() => {
    // Example: Hotjar injection (placeholder)
    // In a real app, you would check env vars and inject script tags here or via a library.
    // if (import.meta.env.VITE_HOTJAR_ID) { ... }
    
    // For now, this is a placeholder for where that logic goes.
  }, [location]);

  if (!import.meta.env.DEV) return null; // Invisible in production usually

  return (
    <div className="hidden">
      {/* Analytics Scripts Container */}
    </div>
  );
}
