import React, { createContext, useCallback, useContext, useState } from "react";

/**
 * PageMeta — lets a page push its title/subtitle into the shared top bar.
 * Each page calls usePageMeta({ title, subtitle }) so the shell owns the
 * page heading instead of every view rendering its own <h1>.
 */
const PageMetaContext = createContext({ meta: {}, setPageMeta: () => {} });

export const PageMetaProvider = ({ children }) => {
  const [meta, setMeta] = useState({});
  const setPageMeta = useCallback((m) => setMeta(m), []);

  return (
    <PageMetaContext.Provider value={{ meta, setPageMeta }}>
      {children}
    </PageMetaContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const usePageMeta = () => useContext(PageMetaContext);