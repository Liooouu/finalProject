import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import { getUserFromToken } from '../../utils/auth';
import { recordPortalVisit } from '../../utils/portalHistory';
export default function PortalNavigationTracker() {
  const location = useLocation(), action = useNavigationType();
  useEffect(() => {
    try { recordPortalVisit(window.sessionStorage, location, getUserFromToken(), window.history.state?.idx, action); }
    catch { /* Back still has a safe dashboard fallback. */ }
  }, [location, action]);
  return null;
}
