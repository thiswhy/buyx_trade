import CryptoJS from "crypto-js";
import {ApiStoreModel} from "buydip_scheme";
import {ObjectId} from "mongodb";
import {trade} from "../dataUtils/trade";
import {postRecommendData} from "./trade/postRecommendData";
import {UserTradeOptionsModel} from "buydip_scheme/scheme/userTradeOptions";

export const testAPI = async (req, res) => {
    try {
        const {apiKey, apiSecret, tradeData, userOptions} = req.body
        // await trade({userOptions, apiKey, apiSecret, tradeData})
        // await testCode()
        return await postRecommendData(req, res)
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
    const apiKey = encrypt("10f69dced7a3a29edc83550475b2f7b3")
    const apiSecret = encrypt("0141a715d1e7791e7ad594c7e215f18e8ba1d77214cd6515b493e83e07447386")
    // const apiModel = new ApiStoreModel({
    //     userId: new ObjectId("6849486328f573984cfe0065"),
    //     apiKey: apiKey,
    //     apiSecret,
    //     isActive: true,
    //     belong: "Gate"
    // })
    // await apiModel.save()

    const userOptionModel = new UserTradeOptionsModel({
        userId: new ObjectId("66042c8dda590dfa1b3a8166"),
        "currency": [], // 手动设定的币种，["BTC","ETH"]
        "insurance": "900", // 最少保证金余额
        "leverage": "2", // 杠杆倍数
        "maxVolume": "25", // 单笔仓位下单数量
        "takeProfit": "", // 止盈 数字，为数字，0.3 表示浮动30%止盈
        "stopLoss": "0.6", // 止损 数字，0.99 表示浮动99%止损
        "direction": "", // 方向 sell buy，表示只做多单或者只做空单，空表示多空都做
        "isActive": true,
    })
    await userOptionModel.save();
}