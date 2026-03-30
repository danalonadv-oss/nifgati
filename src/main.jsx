import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Privacy from "./Privacy.jsx";
import Accessibility from "./Accessibility.jsx";

function Router() {
  const path = window.location.pathname;
  if (path === "/privacy")       return <Privacy />;
  if (path === "/accessibility") return <Accessibility />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><Router /></React.StrictMode>
);
