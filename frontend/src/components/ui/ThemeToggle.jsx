import React from "react";
import { FaMoon, FaSun } from "react-icons/fa";
import { useTheme } from "../../context/ThemeContext";
import "../../styles/theme-toggle.css";

export default function ThemeToggle({ className = "" }) {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`}
      data-theme={isDark ? "dark" : "light"}
      onClick={toggleTheme}
      aria-label={label}
      title={label}
    >
      <span className="theme-toggle-icon theme-toggle-sun" aria-hidden="true">
        <FaSun />
      </span>
      <span className="theme-toggle-icon theme-toggle-moon" aria-hidden="true">
        <FaMoon />
      </span>
    </button>
  );
}
