import React from "react";
import ReactDOM from "react-dom/client";
import PortalRouter from "./components/PortalRouter.jsx";
import App from "./App.jsx";
import "./index.css"; // Tailwind CSS
import "./styles/stone-charcoal.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <PortalRouter>
      <App />
    </PortalRouter>
  </React.StrictMode>
);
