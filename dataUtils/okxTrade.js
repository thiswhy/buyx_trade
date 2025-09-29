// 初始化交易器
import OKXFuturesTrader from "./OKXFutures/OKXFuturesTrade";
import {intersectionWith, isEmpty} from "lodash";
export const okxTrade = async (tradeData, userOptions) =>{

   //  const symbolInfo = await trader.getSymbolsInfo();
    // console.log("symbolInfo",symbolInfo)
    try {
        const {apiKey, apiSecret, isTestOption, currency, isActive} = userOptions
        const trader = new OKXFuturesTrader(
            '174e9b58-9d26-4867-b4d7-86b0d9135082',
            '2B83F117884D7C04B5729ECD5C6588D5',
            'Ryan@cy00',
            true // 使用模拟盘
        );

        let futureContractData = []
        const symbols = await trader.getSymbolInfo()
        let filterTradeDate = null
        if (!isEmpty(currency)) {
            filterTradeDate = intersectionWith(tradeData, currency, (a, b) => `${a.symbol}` === b)
        } else {
            filterTradeDate = tradeData
        }
        for (const tradeItem of filterTradeDate) {
            const symbolInfo = symbols.find(s => s.instId === `${tradeItem.symbol}-USDT-SWAP`);
            if (symbolInfo) {
                futureContractData.push({
                    ...tradeItem,
                    symbolInfo
                })
            }
        }
        console.log("futureContractData",futureContractData)
        if (isActive) {
            const {direction, insurance, maxVolume, leverage, stopLoss, takeProfit} = userOptions
            for (const item of futureContractData) {
                if (direction === 'all' || direction === item.direction) {
                    // 执行交易
                    const result = await trader.executeTrade({
                        instId: `${item.symbol}-USDT-SWAP`, // 交易对
                        usdtAmount: Number(maxVolume), // 交易金额
                        direction: item.direction, // 方向: long/short
                        leverage: Number(leverage), // 杠杆倍数
                        minMargin: Number(insurance), // 最小保证金要求
                        takeProfitPercent: Number(takeProfit), // 止盈百分比
                        stopLossPercent: Number(stopLoss), // 止损百分比
                        symbolInfo: item.symbolInfo,
                    });
                    console.log('交易结果:', result);
                }
            }
        }
    } catch (error) {
        console.error('交易失败:', error);
    }
}
