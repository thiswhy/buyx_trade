// binance-futures-trader.js
const BinanceFuturesClient = require('./BinanceFuturesClient');
const {formatPrice} = require("../formatPrice");

class BinanceFuturesTrader {
    constructor(apiKey, apiSecret, isTestnet = false) {
        this.client = new BinanceFuturesClient(apiKey, apiSecret, isTestnet);
    }

    /**
     * 检查保证金是否充足
     */
    async checkMargin(symbol, usdtAmount, minMargin) {
        try {
            const accountInfo = await this.client.getAccountInfo();
            const availableBalance = parseFloat(accountInfo.availableBalance);

            // 检查最小保证金要求
            if (availableBalance < minMargin) {
                throw new Error(`保证金不足，可用余额 ${availableBalance} USDT 小于最小要求 ${minMargin} USDT`);
            }

            // 计算所需保证金
            const currentPrice = await this.client.getCurrentPrice(symbol);
            const quantity = usdtAmount / currentPrice;
            const requiredMargin = usdtAmount; // 简化计算，实际应考虑杠杆

            if (availableBalance < requiredMargin) {
                throw new Error(`保证金不足，需要 ${requiredMargin} USDT，但只有 ${availableBalance} USDT`);
            }

            return true;
        } catch (error) {
            console.error('检查保证金失败:', error.message);
            throw error;
        }
    }

    /**
     * 计算交易数量
     */
    async calculateQuantity(symbolInfo, usdtAmount, currentPrice) {
        try {
            // 获取数量精度
            const quantityFilter = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
            const stepSize = parseFloat(quantityFilter.stepSize);

            // 计算数量并调整到合适的精度
            let quantity = usdtAmount / currentPrice;
            quantity = Math.floor(quantity / stepSize) * stepSize;

            return quantity.toFixed(symbolInfo.quantityPrecision);
        } catch (error) {
            console.error('计算数量失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取当前持仓
     */
    async getCurrentPosition(symbol) {
        try {
            const accountInfo = await this.client.getAccountInfo();
            const position = accountInfo.positions.find(p => p.symbol === symbol);

            if (position && parseFloat(position.positionAmt) !== 0) {
                return {
                    symbol: position.symbol,
                    positionAmt: parseFloat(position.positionAmt),
                    positionSide: parseFloat(position.positionAmt) > 0 ? 'LONG' : 'SHORT',
                    entryPrice: parseFloat(position.entryPrice),
                    leverage: parseFloat(position.leverage)
                };
            }

            return null;
        } catch (error) {
            console.error('获取持仓失败:', error.message);
            throw error;
        }
    }

    /**
     * 平仓
     */
    async closePosition(symbol) {
        try {
            const position = await this.getCurrentPosition(symbol);

            if (!position) {
                console.log('没有持仓需要平仓');
                return null;
            }

            const side = position.positionSide === 'LONG' ? 'SELL' : 'BUY';
            const quantity = Math.abs(position.positionAmt);

            console.log(`平仓: ${side} ${quantity} ${symbol}`);

            return await this.client.placeMarketOrder(
                symbol,
                side,
                quantity,
                true // reduceOnly
            );
        } catch (error) {
            console.error('平仓失败:', error.message);
            throw error;
        }
    }

    /**
     * 设置止盈止损
     */
    async setTakeProfitAndStopLoss(symbolInfo, entryPrice, quantity, takeProfitPercent, stopLossPercent, direction) {
        try {
            const symbol = symbolInfo.symbol;
            const priceStep = symbolInfo.filters.find(f => f.filterType === 'PRICE_FILTER').tickSize;
            const results = {};

            // 计算止盈止损价格
            let takeProfitPrice, stopLossPrice;

            if (direction === 'LONG') {
                if (takeProfitPercent) {
                    takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);
                    takeProfitPrice = formatPrice(takeProfitPrice, Number(priceStep));
                }
                if (stopLossPercent) {
                    stopLossPrice = entryPrice * (1 - stopLossPercent / 100);
                    stopLossPrice = formatPrice(stopLossPrice, Number(priceStep));
                }
            } else {
                if (takeProfitPercent) {
                    takeProfitPrice = entryPrice * (1 - takeProfitPercent / 100);
                    takeProfitPrice = formatPrice(takeProfitPrice, Number(priceStep));
                }
                if (stopLossPercent) {
                    stopLossPrice = entryPrice * (1 + stopLossPercent / 100);
                    stopLossPrice = formatPrice(stopLossPrice, Number(priceStep));
                }
            }

            console.log("takeProfitPrice", takeProfitPrice, "stopLossPrice", stopLossPrice)
            const closeSide = direction === 'LONG' ? 'SELL' : 'BUY';
            // 设置止盈单 - 使用正确的订单类型
            if (takeProfitPercent > 0) {
                results.takeProfit = await this.client.placeOrder(symbol, {
                    side: closeSide,
                    type: 'TAKE_PROFIT_MARKET', // 使用市价止盈
                    quantity: quantity,
                    stopPrice: Number(takeProfitPrice),
                    closePosition: 'true', // 平仓
                    timeInForce: 'GTC'
                });
                console.log(`止盈单设置: ${takeProfitPrice}`);
            }

            // 设置止损单 - 使用正确的订单类型
            if (stopLossPercent > 0) {
                results.stopLoss = await this.client.placeOrder(symbol, {
                    side: closeSide,
                    type: 'STOP_MARKET', // 使用市价止损
                    quantity: quantity,
                    stopPrice: Number(stopLossPrice),
                    closePosition: 'true', // 平仓
                    timeInForce: 'GTC'
                });
                console.log(`止损单设置: ${stopLossPrice}`);
            }
            return results;
        } catch (error) {
            console.error('设置止盈止损失败:', error.message);
            throw error;
        }
    }

    async  setupDualPositionMode() {
        try {
            // 获取当前持仓模式
            const currentMode = await this.client.getPositionMode();
            console.log('当前持仓模式:', currentMode);

            // 设置为双向持仓模式
            const result = await this.client.setPositionMode(true);
            console.log('设置双向持仓模式成功:', result);

            // 验证设置
            const newMode = await this.client.getPositionMode();
            console.log('新的持仓模式:', newMode);
        } catch (error) {
            console.error('设置持仓模式失败:', error);
        }
    }

    /**
     * 执行交易
     */
    async executeTrade(params) {
        const {
            symbol,
            usdtAmount,
            direction, // 'LONG' or 'SHORT'
            leverage,
            minMargin,
            takeProfitPercent,
            stopLossPercent,
            symbolInfo,
        } = params;

        try {
            console.log(`开始执行交易: ${symbol}, 方向: ${direction}, 金额: ${usdtAmount} USDT`);

            // 1. 检查保证金
            if (!await this.checkMargin(symbol, usdtAmount, minMargin)) {
                throw new Error('保证金检查失败');
            }

            // 设置双向持仓
            await this.setupDualPositionMode()

            // 2. 设置杠杆
            await this.client.setLeverage(symbol, leverage);
            console.log(`设置杠杆: ${leverage}x`);

            // 3. 获取当前价格和计算数量
            const currentPrice = await this.client.getCurrentPrice(symbol);
            const quantity = await this.calculateQuantity(symbolInfo, usdtAmount, currentPrice);
            console.log(`当前价格: ${currentPrice}, 计算数量: ${quantity}`);

            // 4. 检查当前持仓并平仓（如果需要）
            const currentPosition = await this.getCurrentPosition(symbol);
            if (currentPosition) {
                const currentDirection = currentPosition.positionSide;
                if ((currentDirection === 'LONG' && direction === 'SHORT') ||
                    (currentDirection === 'SHORT' && direction === 'LONG')) {
                    console.log(`发现反向持仓，先平仓: ${currentDirection}`);
                    await this.closePosition(symbol);
                }
            }

            // 5. 执行市价单
            const orderSide = direction === 'LONG' ? 'BUY' : 'SELL';
            const orderResult = await this.client.placeMarketOrder(symbol, orderSide, quantity);
            console.log('下单成功:', orderResult);

            // 6. 获取成交均价和实际数量
            let filledPrice = currentPrice;
            let filledQuantity = quantity;

            if (orderResult.orderId) {
                // 等待订单完全成交
                await new Promise(resolve => setTimeout(resolve, 2000));

                // 获取订单详情
                const orderInfo = await this.client.getOrder(symbol, orderResult.orderId);
                filledPrice = parseFloat(orderInfo.avgPrice) || currentPrice;

                // 获取实际成交数量
                if (orderInfo.executedQty) {
                    filledQuantity = parseFloat(orderInfo.executedQty);
                }

                console.log(`订单详情: 均价=${filledPrice}, 数量=${filledQuantity}, 状态=${orderInfo.status}`);
            }

            // 7. 设置止盈止损 - 使用实际成交价格和数量
            const tpSlResults = await this.setTakeProfitAndStopLoss(
                symbolInfo,
                filledPrice,
                filledQuantity,
                takeProfitPercent,
                stopLossPercent,
                direction,
            );

            console.log('交易完成，止盈止损已设置');

            return {
                success: true,
                order: orderResult,
                filledPrice,
                filledQuantity,
                takeProfitStopLoss: tpSlResults
            };

        } catch (error) {
            console.error('交易执行失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 取消所有挂单
     */
    async cancelAllOrders(symbol) {
        try {
            const openOrders = await this.client._sendRequest('GET', '/fapi/v1/openOrders', {symbol}, true);

            for (const order of openOrders) {
                await this.client.cancelOrder(symbol, order.orderId);
                console.log(`已取消订单: ${order.orderId}`);
            }

            return {success: true, cancelledCount: openOrders.length};
        } catch (error) {
            console.error('取消订单失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取交易对信息
     */
    async getSymbolInfo() {
        try {
            const exchangeInfo = await this.client._sendRequest('GET', '/fapi/v1/exchangeInfo', {});
            return exchangeInfo.symbols
        } catch (error) {
            console.error('获取交易对信息失败:', error.message);
            return []
        }
    }
}

module.exports = BinanceFuturesTrader;