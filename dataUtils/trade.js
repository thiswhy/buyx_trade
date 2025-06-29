import {isEmpty} from "lodash";
import {formatPrice} from "./formatPrice";

const GateApi = require('gate-api');

let client = new GateApi.ApiClient();
// {apiKey, apiSecret}
export const trade = async ({tradeData = [{symbol: "ETH", direction: "sell"}]}) => {
    try {
        const apiKey = "6095c2b77d34e16e2b9f3fb96b7fa27c"
        const apiSecret = "148e903372feeea3f93dffee77f46cd70719f0034f9a0e6ef63d71970d0cb46e"
        // const apiKey = "40b0138b40d9b453e00bc6b698123a9a"
        // const apiSecret = "ec175d37fe32af34416bfb0fdfac0c10534e2aa162a7a0aebaff27e16c8b862b"
        const userOptions = {
            currency: [], // 交易币种，当为空值默认全部交易币种
            insurance: "100", // 保证金余额
            leverage: "10", // 杠杆倍数 默认1
            maxVolume: "20", // 单笔交易最大金额 默认 20usdt
            takeProfit: "0.1", //默认不止盈
            stopLoss: "0.1", // 止损10% 20% 30% 选择其中一个
            direction: '', // 交易方向 默认空,空代表多空都做 || buy || sell
            isActive: true,
        }
        client.setApiKeySecret(apiKey, apiSecret);
        // client.basePath = 'https://api.gateio.ws/api/v4'
        client.basePath = 'https://api-testnet.gateapi.io/api/v4'
        const futuresApi = new GateApi.FuturesApi(client);
        const settle = "usdt"
        const futureContractData = []
        for (const tradeItem of tradeData) {
            const futureContract = await futuresApi.getFuturesContract(settle, `${tradeItem.symbol}_USDT`)
            futureContractData.push(futureContract.body)
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        // 用户需要设置这个最小的保证金余额，否则不允许交易
        if (userOptions.isActive) {
            let tradeInfo = tradeData
            if (userOptions.direction !== "") {
                tradeInfo = tradeData.filter(item => item.direction === userOptions.direction)
            }
            const futureAccount = await futuresApi.listFuturesAccounts(settle)
            // 获取用户的账户信息，查看持仓模式，如果是双向持仓，则需要改为单向持仓
            // 如果持仓模式修改不成功则拒绝下单操作
            let inDualMode = futureAccount.body.inDualMode
            if (inDualMode) {
                const positions = await futuresApi.listPositions(settle, {holding: true})
                if (isEmpty(positions.body)) {
                    try {
                        const dualModeResult = await futuresApi.setDualMode(settle, false)
                        console.log(dualModeResult.body)
                        inDualMode = dualModeResult.body.inDualMode
                    } catch (e) {
                    }
                }
            }
            if (inDualMode) {
                return false
            }
            for (const item of tradeInfo) {
                const {symbol, direction} = item
                const position = await futuresApi.getPosition(settle, `${symbol}_USDT`)
                if (position.body.size === 0) {
                    const futureAccount = await futuresApi.listFuturesAccounts(settle)
                    const canTrade = (Number(futureAccount.body.total) - Number(userOptions.insurance)) > (Number(userOptions.maxVolume) / Number(userOptions.leverage))
                    if (canTrade) {
                        const findFutureContract = futureContractData.find(item => item.name === `${symbol}_USDT`)
                        if (!isEmpty(findFutureContract)) {
                            const size = Math.floor(Number(userOptions.maxVolume) / (Number(findFutureContract.quantoMultiplier) * Number(findFutureContract.markPrice)) * Number(userOptions.leverage))
                            if (size > 0) {
                                console.log("size", size)
                                // 用户下单，拿到用户的止盈止损设置
                                // 首先先开仓下单
                                // 设置用户的杠杆倍数
                                await futuresApi.updatePositionLeverage(settle, `${symbol}_USDT`, `${Math.min(userOptions.leverage, findFutureContract.leverageMax)}`, {})
                                const createFuturesOrder = await futuresApi.createFuturesOrder(settle, {
                                    contract: `${symbol}_USDT`,
                                    size: direction === "buy" ? size : -size,
                                    price: 0,
                                    tif: "ioc",
                                }, {})
                                const lossPrice = direction === "buy" ? `${(1 - Number(userOptions.stopLoss)) * Number(createFuturesOrder.body.fillPrice)}` : `${(1 + Number(userOptions.stopLoss)) * Number(createFuturesOrder.body.fillPrice)}`
                                await futuresApi.createPriceTriggeredOrder(settle, {
                                    initial: {
                                        contract: `${symbol}_USDT`,
                                        size: 0,// 平仓
                                        price: "0",// 止损
                                        reduceOnly: true,
                                        close: true,
                                        tif: "ioc",
                                    },
                                    trigger: {
                                        strategyType: 0,
                                        priceType: 0,
                                        price: formatPrice(lossPrice, findFutureContract.orderPriceRound),
                                        rule: direction === "buy" ? 2 : 1
                                    },
                                    orderType: direction === "buy" ? "close-long-position" : "close-short-position",
                                })
                                if (userOptions.takeProfit) {
                                    const profitPrice = direction === "buy" ? `${(1 + Number(userOptions.takeProfit)) * Number(createFuturesOrder.body.fillPrice)}` : `${(1 - Number(userOptions.takeProfit)) * Number(createFuturesOrder.body.fillPrice)}`
                                    await futuresApi.createPriceTriggeredOrder(settle, {
                                        initial: {
                                            contract: `${symbol}_USDT`,
                                            size: 0,// 平仓
                                            price: "0",// 止盈
                                            reduceOnly: true,
                                            tif: "ioc",
                                            close: true,
                                        },
                                        trigger: {
                                            strategyType: 0,
                                            priceType: 0,
                                            price: formatPrice(profitPrice, findFutureContract.orderPriceRound),
                                            rule: direction === "buy" ? 1 : 2
                                        },
                                        orderType: direction === "buy" ? "close-long-position" : "close-short-position",
                                    })
                                }
                            }
                        } else {
                            return {
                                code: -1,
                                message: "保证金不足"
                            }
                        }
                    }
                } else if ((position.body.size < 0 && direction === "buy") || (position.body.size > 0 && direction === "sell")) {
                    // 进行平仓操作
                    await futuresApi.updatePositionLeverage(settle, `${symbol}_USDT`, position.body.leverage, {})
                    await futuresApi.createFuturesOrder(settle, {
                        contract: `${symbol}_USDT`,
                        size: position.body.size < 0 ? Math.abs(position.body.size) : -position.body.size,
                        price: 0,
                        tif: "ioc",
                    }, {})
                } else if ((position.body.size > 0 && direction === "buy") || (position.body.size < 0 && direction === "sell")) {
                    // 加仓操作暂时不开放
                }
            }
        }
    } catch (e) {
        console.log("e", e)
    }
}