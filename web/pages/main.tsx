import React from "react";
import {createRoot} from "react-dom/client";
import Theater from "./theater";
import {setupStaticMedia} from "./static-media";
import {loadVisitorCount} from "./visit-counter";
import "../app/globals.css";
import "./pages.css";

setupStaticMedia();
function recordVisit(){void loadVisitorCount().catch(()=>window.setTimeout(recordVisit,60_000));}
recordVisit();
createRoot(document.getElementById("root")!).render(<Theater/>);
