import {postRecommendData} from "./trade/postRecommendData";
import {binanceTrade} from "../dataUtils/binanceTrade";
import {decrypt} from "../dataUtils/utils";
import {UserTradeOptionsModel} from "buydip_scheme/scheme/userTradeOptions";
import {isEmpty} from "lodash";
import {apiTrade} from "../dataUtils/apiTrade";
import {saveUserBalance} from "../dataUtils/saveUserBalance";

const GateApi = require('gate-api');
const TRADE_API_URL = process.env.TRADE_API_URL
const TRADE_TEST_API_URL = process.env.TRADE_TEST_API_URL
let client = new GateApi.ApiClient();
import BinanceFuturesTrade from "../dataUtils/BinanceFutures/BinanceFuturesTrade";

export const testAPI = async (req, res) => {
    try {
        // const options = await UserTradeOptionsModel.find({
        //     isActive: true,
        //     isDelete: false,
        //     belong: "Binance"
        // }).lean()
        // for (const option of options) {
        //     if (!isEmpty(option)) {
        //         const {apiKey, apiSecret, isTestOption, currency} = option
        //         console.log(decrypt(apiKey))
        //         const trader = new BinanceFuturesTrade(decrypt(apiKey), decrypt(apiSecret), isTestOption);
        //         const accountInfo = await trader.checkUserAccount();
        //         const {availableBalance, totalUnrealizedProfit, totalWalletBalance} = accountInfo
        //         const accountFunds = {
        //             total: totalWalletBalance,
        //             unrealisedPnl: totalUnrealizedProfit,
        //             available: availableBalance
        //         }
        //         saveUserBalance(option.userId, accountFunds)
        //     }
        // }
        // testCode()
    } catch (e) {
        res.status(500).json({error: e.message});
    }
}