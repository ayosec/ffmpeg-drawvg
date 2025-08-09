import { createContext } from "react";

import Backend from "./backend";

const MainRender = new Backend("MainRender");

const BackendContext = createContext(MainRender);

export default BackendContext;
