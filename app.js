import dotenv from 'dotenv';

dotenv.config({path: '.env'})
import bodyParser from 'body-parser';
import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import cors from 'cors';
import {routers} from "./routes";
import {dbConnect} from "./dbConnect";

const app = express();

app.use(cors({
    origin: true, // 允许这个源的跨源请求
    credentials: true, // 允许跨源请求携带凭据，如cookies
}))
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(express.urlencoded({extended: false}));
app.use(cookieParser());
app.use(bodyParser.urlencoded({
    extended: true
}));
dbConnect()
app.use(routers)
module.exports = app;