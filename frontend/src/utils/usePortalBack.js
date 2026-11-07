import { useLocation, useNavigate } from 'react-router-dom';
import { getUserFromToken } from './auth';
import { portalBackTarget } from './portalHistory';
export function usePortalBack(fallback) {
  const location = useLocation(), navigate = useNavigate();
  const user = getUserFromToken();
  const resolve = () => {
    try { return portalBackTarget(window.sessionStorage, location, user, window.history.state?.idx, fallback); }
    catch { return portalBackTarget({ getItem: () => null }, location, user, null, fallback); }
  };
  const target = resolve();
  return { home: target.home, canGoBack: !target.disabled, back: () => {
    const next = resolve();
    if (next.disabled) return;
    if (next.delta) navigate(next.delta);
    else navigate(next.path, { replace: true });
  } };
}
