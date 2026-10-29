/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useRef } from "react";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  const transitionTimer = useRef(null);
  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem("theme");
      return saved ? saved === "dark" : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  useEffect(() => () => {
    clearTimeout(transitionTimer.current);
    document.documentElement.classList.remove("theme-changing");
  }, []);

  const toggleTheme = () => {
    clearTimeout(transitionTimer.current);
    document.documentElement.classList.add("theme-changing");
    setIsDark((prev) => !prev);
    transitionTimer.current = setTimeout(() => document.documentElement.classList.remove("theme-changing"), 260);
  };

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
