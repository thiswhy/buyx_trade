import {ApiStoreModel} from "buydip_scheme";
import CryptoJS from "crypto-js";

// 解密函数
const SECRET_KEY = process.env.SECRET_KEY

const decrypt = (text) => {
    const bytes = CryptoJS.AES.decrypt(text, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
}

export const getUserApiKey = async () => {
    const apiInfo = await ApiStoreModel.find({isActive: true});
    let apiKeys = [];
    for (const item of apiInfo) {
        const {apiKey, apiSecret, userId, isTestAPI} = item;
        apiKeys.push({
            userId,
            apiKey: decrypt(apiKey),
            apiSecret: decrypt(apiSecret),
            isTestAPI
        })
    }
    return apiKeys
}