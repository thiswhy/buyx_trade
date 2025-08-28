import {postRecommendData} from "./trade/postRecommendData";

export const testAPI = async (req, res) => {
    try {
        const {apiKey, apiSecret, tradeData, userOptions} = req.body
        // await trade({userOptions, apiKey, apiSecret, tradeData})
        return await postRecommendData(req, res)
       // testCode()
    } catch (e) {
        res.status(500).json({error: e.message});
    }
}