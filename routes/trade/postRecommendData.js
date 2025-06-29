import {getUserApiKey} from "../../dataUtils/getUserApiKey";
import {trade} from "../../dataUtils/trade";

export const postRecommendData = async (req, res) => {
    try {
        const apiKeys = await getUserApiKey()
        for (const apiItem of apiKeys) {
            const {apiKey, apiSecret} = apiItem
            await trade({apiKey, apiSecret})
        }
    } catch (e) {
        console.log(e.message)
    }
}