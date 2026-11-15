import React from "react";
import {createRoot} from "react-dom/client";
import Theater from "./theater";
import {setupStaticMedia} from "./static-media";
import {loadVisitorCount} from "./visit-counter";
import "../app/globals.css";
import "./pages.css";

setupStaticMedia();
void loadVisitorCount().catch(()=>{});
createRoot(document.getElementById("root")!).render(<Theater/>);
