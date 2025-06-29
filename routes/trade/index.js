import express from "express";
import {postRecommendData} from "./postRecommendData";

export const tradeRoute = express.Router();
tradeRoute.post('/postRecommendData',postRecommendData)