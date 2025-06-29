import {mongodbConnect} from "buydip_scheme";
export const dbConnect = async () =>{
    const MONGODB_URI = process.env.MONGODB_URI;
    console.log("MONGODB_URI",MONGODB_URI)
    await mongodbConnect(MONGODB_URI)
}