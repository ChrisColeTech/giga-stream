import "allotment/dist/style.css";
import { createRoot } from "react-dom/client";
import { App } from "@/components/chrome/App";
import "./index.css";

/* No StrictMode: it double-runs every effect in dev, and the pane tween engine owns refs and animation frames. */
const container = document.getElementById("root");
if (container === null) throw new Error("Missing #root element");

createRoot(container).render(<App />);
