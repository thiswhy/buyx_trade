import CryptoJS from "crypto-js";

// 解密函数
const SECRET_KEY = process.env.SECRET_KEY

export const decrypt = (text) => {
    const bytes = CryptoJS.AES.decrypt(text, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
}