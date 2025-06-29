import {Router} from "express";
import {tradeRoute} from "./trade";
import {testAPI} from "./testAPI";

export const routers = Router();
routers.use('/trade-api/', tradeRoute)
routers.use('/trade-api/test', testAPI)