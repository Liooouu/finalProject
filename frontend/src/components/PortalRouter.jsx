import { useState } from 'react';
import { unstable_HistoryRouter as HistoryRouter } from 'react-router-dom';
import { createPortalHistory } from '../utils/portalRouterHistory';
import { getLastActiveRole, getUserRole } from '../utils/auth';

export default function PortalRouter({ children }) {
  const [history] = useState(() => createPortalHistory(window, () => {
    const role = getLastActiveRole() || getUserRole();
    return role ? `/${role}/dashboard` : '/auth';
  }));
  return <HistoryRouter history={history}>{children}</HistoryRouter>;
}
