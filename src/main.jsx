import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
const Privacy = lazy(() => import("./Privacy.jsx"));
const Accessibility = lazy(() => import("./Accessibility.jsx"));
const TaonatDrakhim = lazy(() => import("./pages/TaonatDrakhim.jsx"));
const Ofanoa = lazy(() => import("./pages/Ofanoa.jsx"));
const Avoda = lazy(() => import("./pages/Avoda.jsx"));
const Korkinet = lazy(() => import("./pages/Korkinet.jsx"));
const HolehRegel = lazy(() => import("./pages/HolehRegel.jsx"));
const TzlipatShot = lazy(() => import("./pages/TzlipatShot.jsx"));
const PritzatDisc = lazy(() => import("./pages/PritzatDisc.jsx"));
const Shever = lazy(() => import("./pages/Shever.jsx"));
const PTSD = lazy(() => import("./pages/PTSD.jsx"));
const Machshevon = lazy(() => import("./pages/Machshevon.jsx"));
const Nechut = lazy(() => import("./pages/Nechut.jsx"));

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ fontFamily:"'Heebo',Arial,sans-serif",direction:"rtl",background:"#080d18",color:"#e8edf2",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",textAlign:"center",padding:24 }}>
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

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<App />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/accessibility" element={<Accessibility />} />
            <Route path="/taonat-drakhim" element={<TaonatDrakhim />} />
            <Route path="/ofanoa" element={<Ofanoa />} />
            <Route path="/avoda" element={<Avoda />} />
            <Route path="/korkinet" element={<Korkinet />} />
            <Route path="/holeh-regel" element={<HolehRegel />} />
            <Route path="/tzlipat-shot" element={<TzlipatShot />} />
            <Route path="/pritzat-disc" element={<PritzatDisc />} />
            <Route path="/shever" element={<Shever />} />
            <Route path="/ptsd" element={<PTSD />} />
            <Route path="/machshevon" element={<Machshevon />} />
            <Route path="/nechut" element={<Nechut />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
