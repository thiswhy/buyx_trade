import {postRecommendData} from "./trade/postRecommendData";
import {binanceTrade} from "../dataUtils/binanceTrade";
import {okxTrade} from "../dataUtils/okxTrade";

export const testAPI = async (req, res) => {
    try {
        const {apiKey, apiSecret, tradeData, userOptions} = req.body
        // await trade({userOptions, apiKey, apiSecret, tradeData})
        return await okxTrade([{symbol: 'ETH', direction: 'sell'}], {
            apiKey,
            apiSecret,
            direction: 'all',
            isTestOption: true,
            currency: ['BTC', 'ETH'],
            isActive: true,
            insurance: "200",
            maxVolume: "150",
            leverage: "2",
            stopLoss: "20",
            takeProfit: "20"
        })
        // testCode()
    } catch (e) {
        res.status(500).json({error: e.message});
    }
}