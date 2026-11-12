import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function SearchVisibility() {
  const { pathname } = useLocation();
  useEffect(() => {
    let tag = document.querySelector('meta[name="robots"]');
    if (!tag) {
      tag = document.createElement('meta');
      tag.name = 'robots';
      document.head.appendChild(tag);
    }
    tag.content = ['/', '/terms', '/terms/'].includes(pathname) ? 'index, follow' : 'noindex, nofollow, nosnippet';
  }, [pathname]);
  return null;
}
