import {gateTrade} from "./gateTrade";
import {binanceTrade} from "./binanceTrade";

export const apiTrade = async ({tradeData, userOptions}) => {
    const {belong} = userOptions
    switch (belong) {
        case 'Gate':
            await gateTrade({tradeData, userOptions})
            break;
        case 'Binance':
            await binanceTrade({tradeData, userOptions})
            break;
        default:
            break;
    }
}