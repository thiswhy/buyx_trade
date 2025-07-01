import CryptoJS from "crypto-js";
import {ApiStoreModel} from "buydip_scheme";
import {ObjectId} from "mongodb";
import {getUserApiKey} from "../dataUtils/getUserApiKey";
import {postRecommendData} from "./trade/postRecommendData";
import {trade} from "../dataUtils/trade";

export const testAPI = async (req, res) => {
    try {
        const {apiKey, apiSecret, tradeData, userOptions} = req.body
        await trade({userOptions, apiKey, apiSecret, tradeData})
        res.status(200).json({status: 'alive'})
    } catch (e) {
        res.status(500).json({error: e.message});
    }
}

const testCode = async () => {
    const SECRET_KEY = process.env.SECRET_KEY

    function encrypt(text) {
        return CryptoJS.AES.encrypt(text, SECRET_KEY).toString();
    }

    const decrypt = (text) => {
        const bytes = CryptoJS.AES.decrypt(text, SECRET_KEY);
        return bytes.toString(CryptoJS.enc.Utf8);
    }
    const apiKey = encrypt("40b0138b40d9b453e00bc6b698123a9a")
    const apiSecret = encrypt("ec175d37fe32af34416bfb0fdfac0c10534e2aa162a7a0aebaff27e16c8b862b")
    const apiModel = new ApiStoreModel({
        userId: new ObjectId("66042c8dda590dfa1b3a8166"),
        apiKey: apiKey,
        apiSecret,
        isActive: true,
        belong: "Gate"
    })
    await apiModel.save()
}