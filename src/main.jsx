import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import Privacy from "./Privacy.jsx";
import Accessibility from "./Accessibility.jsx";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ fontFamily:"'Heebo',sans-serif",direction:"rtl",background:"#080d18",color:"#e8edf2",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",padding:24 }}>
          <div>
            <div style={{ fontSize:48,marginBottom:16 }}>⚠️</div>
            <h1 style={{ fontSize:24,fontWeight:700,marginBottom:12 }}>שגיאה זמנית</h1>
            <p style={{ color:"#7a8fa5",fontSize:15,marginBottom:24 }}>משהו השתבש. נסה לרענן את הדף.</p>
            <button onClick={()=>window.location.reload()} style={{ background:"#c9a84c",color:"#060a12",border:"none",borderRadius:12,fontFamily:"inherit",fontWeight:700,fontSize:15,padding:"12px 28px",cursor:"pointer" }}>רענן דף</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router() {
  const path = window.location.pathname;
  if (path === "/privacy")       return <Privacy />;
  if (path === "/accessibility") return <Accessibility />;
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode><ErrorBoundary><Router /></ErrorBoundary></React.StrictMode>
);
