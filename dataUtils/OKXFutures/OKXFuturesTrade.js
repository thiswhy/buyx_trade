const OKXFuturesClient = require('./OKXFuturesClient');

class OKXFuturesTrader {
    constructor(apiKey, apiSecret, passphrase, isDemo = false) {
        this.client = new OKXFuturesClient(apiKey, apiSecret, passphrase, isDemo);
        this.symbolCache = new Map();
    }

    async getSymbolsInfo() {
        try {
            const instruments = await this.client.getInstruments();
            if (!instruments) {
                throw new Error(`获取币种信息出错`);
            }
            return instruments
        } catch (error) {
            return []
        }
    }

    /**
     * 获取并缓存交易对信息
     */
    async getSymbolInfo() {
        try {
            const instrument = await this.client.getInstruments();
            if (!instrument) {
                throw new Error(`查询出错`);
            }
            return instrument;
        } catch (error) {
            console.error('获取交易对信息失败:', error.message);
            throw error;
        }
    }

    /**
     * 计算精度位数
     */
    calculatePrecision(value) {
        if (value === 0) return 0;
        const str = value.toString();
        if (str.includes('e-')) {
            return parseInt(str.split('e-')[1]);
        }
        if (str.includes('.')) {
            return str.split('.')[1].length || 0;
        }
        return 0;
    }

    /**
     * 格式化数值到指定精度
     */
    formatToPrecision(value, precision) {
        return parseFloat(value.toFixed(precision));
    }

    /**
     * 检查保证金是否充足
     */
    async checkMargin(instId, usdtAmount, minMargin = 0) {
        try {
            const balance = await this.client.getBalance('USDT');
            if (!balance) {
                throw new Error('无法获取账户余额');
            }

            const availableBalance = parseFloat(balance.details[0].availBal);

            // 检查最小保证金要求
            if (availableBalance < minMargin) {
                throw new Error(`保证金不足，可用余额 ${availableBalance} USDT 小于最小要求 ${minMargin} USDT`);
            }

            // 检查总保证金是否足够
            if ((availableBalance - minMargin) < usdtAmount) {
                throw new Error(`保证金不足，需要 ${usdtAmount} USDT，但只有 ${availableBalance} USDT 可用`);
            }

            console.log(`保证金检查通过: 可用=${availableBalance} USDT`);
            return true;
        } catch (error) {
            console.error('检查保证金失败:', error.message);
            throw error;
        }
    }

    /**
     * 计算交易数量
     */
    async calculateQuantity(symbolInfo, lastPrice, usdtAmount, leverage = 1) {
        try {
            // 获取合约面值
            const ctVal = parseFloat(symbolInfo.ctVal);
            const minSz = parseFloat(symbolInfo.minSz); // 最小交易张数
            const lotSz = parseFloat(symbolInfo.lotSz); // 交易数量单位

            if (ctVal <= 0) {
                throw new Error(`合约面值无效: ${ctVal}`);
            }

            // 计算合约价值
            let contractValue;
            if (symbolInfo.ctType === 'linear') {
                // U本位合约：合约价值 = 价格 × 面值
                contractValue = lastPrice * ctVal;
            } else {
                // 币本位合约：合约价值 = 面值 / 价格
                contractValue = ctVal / lastPrice;
            }

            // 计算需要的张数
            let quantity = (usdtAmount * leverage) / contractValue;

            // 调整到合适的精度和最小单位
            quantity = this.adjustQuantityToPrecision(quantity, minSz, lotSz);

            console.log(`张数计算详情: 金额=${usdtAmount}, 杠杆=${leverage}, 面值=${ctVal}, 价格=${lastPrice}, 计算张数=${quantity}`);

            // 确保数量大于最小交易数量
            if (quantity < minSz) {
                throw new Error(`计算出的张数 ${quantity} 小于最小交易数量 ${minSz}`);
            }

            return quantity;

        } catch (error) {
            console.error('计算数量失败:', error.message);
            throw error;
        }
    }

    adjustQuantityToPrecision(quantity, minSz, lotSz) {
        // 使用小数位数控制精度
        const getMaxDecimals = (...numbers) => {
            return Math.max(...numbers.map(num => {
                const str = num.toString();
                return str.includes('.') ? str.split('.')[1].length : 0;
            }));
        };

        const maxDecimals = getMaxDecimals(quantity, minSz, lotSz);
        const precision = Math.min(maxDecimals, 8); // 限制最大精度为8位

        // 四舍五入到合适精度后再计算
        const roundToPrecision = (num, decimals) => {
            return parseFloat(num.toFixed(decimals));
        };

        const qRounded = roundToPrecision(quantity, precision);
        const lRounded = roundToPrecision(lotSz, precision);
        const mRounded = roundToPrecision(minSz, precision);

        // 计算倍数（使用更安全的除法）
        const multiples = qRounded / lRounded;

        // 使用 Math.trunc 而不是 Math.floor，避免负数问题
        const adjustedMultiples = Math.trunc(multiples);

        let adjustedQuantity = adjustedMultiples * lRounded;

        // 确保不小于最小交易数量
        if (adjustedQuantity < mRounded) {
            adjustedQuantity = mRounded;
        }

        // 最终精度调整
        adjustedQuantity = roundToPrecision(adjustedQuantity, precision);

        console.log(`保守调整: 输入=${quantity}, 输出=${adjustedQuantity}, 倍数=${adjustedMultiples}`);

        return adjustedQuantity;
    }

    /**
     * 获取当前持仓
     */
    async getCurrentPosition(instId) {
        try {
            const position = await this.client.getPosition(instId);
            if (position && parseFloat(position.pos) !== 0) {
                return {
                    instId: position.instId,
                    pos: parseFloat(position.pos),
                    posSide: position.posSide || (parseFloat(position.pos) > 0 ? 'long' : 'short'),
                    avgPx: parseFloat(position.avgPx),
                    lever: parseFloat(position.lever),
                    upl: parseFloat(position.upl),
                    liqPx: parseFloat(position.liqPx)
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
    async closePosition(instId) {
        try {
            const position = await this.getCurrentPosition(instId);
            if (!position) {
                console.log('没有持仓需要平仓');
                return null;
            }

            const side = position.pos > 0 ? 'sell' : 'buy';
            const quantity = Math.abs(position.pos);

            console.log(`平仓: ${side.toUpperCase()} ${quantity} ${instId}`);

            return await this.client.placeMarketOrder(instId, side, quantity);
        } catch (error) {
            console.error('平仓失败:', error.message);
            throw error;
        }
    }

    /**
     * 设置止盈止损
     */
    async setTakeProfitAndStopLoss(instId, entryPrice, quantity, takeProfitPercent, stopLossPercent, direction) {
        try {
            const results = {};
            const symbolInfo = await this.getSymbolInfo(instId);

            // 计算止盈止损价格
            let takeProfitPrice, stopLossPrice;

            if (direction.toLowerCase() === 'buy') {
                takeProfitPrice = entryPrice * (1 + takeProfitPercent / 100);
                stopLossPrice = entryPrice * (1 - stopLossPercent / 100);
            } else {
                takeProfitPrice = entryPrice * (1 - takeProfitPercent / 100);
                stopLossPrice = entryPrice * (1 + stopLossPercent / 100);
            }

            // 格式化价格到正确精度
            takeProfitPrice = this.formatToPrecision(takeProfitPrice, symbolInfo.pricePrecision);
            stopLossPrice = this.formatToPrecision(stopLossPrice, symbolInfo.pricePrecision);

            const closeSide = direction.toLowerCase() === 'buy' ? 'sell' : 'buy';

            // 设置止盈单
            if (takeProfitPercent > 0) {
                results.takeProfit = await this.client.placeTakeProfitOrder(
                    instId,
                    closeSide,
                    quantity,
                    takeProfitPrice
                );
                console.log(`止盈单设置: ${takeProfitPrice}`);
            }

            // 设置止损单
            if (stopLossPercent > 0) {
                results.stopLoss = await this.client.placeStopMarketOrder(
                    instId,
                    closeSide,
                    quantity,
                    stopLossPrice
                );
                console.log(`止损单设置: ${stopLossPrice}`);
            }

            return results;
        } catch (error) {
            console.error('设置止盈止损失败:', error.message);
            console.log('止盈止损设置失败，但交易已成功');
            return {};
        }
    }

    /**
     * 执行交易
     */
    async executeTrade(params) {
        const {
            instId,
            usdtAmount,
            direction, // 'buy' or 'sell'
            leverage = 2,
            minMargin = 0,
            takeProfitPercent = 0,
            stopLossPercent = 0,
            symbolInfo
        } = params;

        try {
            console.log(`开始执行交易: ${instId}, 方向: ${direction}, 金额: ${usdtAmount} USDT, 杠杆: ${leverage}x`);

            // 1. 检查保证金
            await this.checkMargin(instId, usdtAmount, minMargin);

            // 2. 设置杠杆倍数
            await this.client.setLeverage(instId, leverage);
            console.log(`设置杠杆: ${leverage}x`);

            await this.client.setLeverageMode(instId, leverage, 'cross')
            // 3. 获取当前价格和计算数量
            const ticker = await this.client.getTicker(instId);
            const currentPrice = parseFloat(ticker.last);
            const quantity = await this.calculateQuantity(symbolInfo, currentPrice, usdtAmount, leverage);

            if (quantity <= 0) {
                throw new Error(`计算出的交易数量 ${quantity} 无效`);
            }

            console.log(`当前价格: ${currentPrice}, 计算数量: ${quantity}`);

            // 5. 检查当前持仓并平仓（如果需要）
            const currentPosition = await this.getCurrentPosition(instId);
            if (currentPosition) {
                const currentDirection = currentPosition.posSide;
                if ((currentDirection === 'buy' && direction === 'sell') ||
                    (currentDirection === 'sell' && direction === 'buy')) {
                    console.log(`发现反向持仓，先平仓: ${currentDirection}`);
                    await this.closePosition(instId);
                    // 等待平仓完成
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            const positionMode = await this.client.getPositionMode(instId);

            if (positionMode === "net_mode") {
                await this.client.setPositionMode("long_short_mode", instId);
            }
            // 6. 执行市价单
            const orderResult = await this.client.placeMarketOrder(instId, direction, quantity);
            console.log('下单成功:', orderResult);
            return
            // 7. 获取成交信息
            let filledPrice = currentPrice;
            let filledQuantity = quantity;

            if (orderResult.ordId) {
                // 等待订单完全成交
                await new Promise(resolve => setTimeout(resolve, 2000));

                // 获取订单详情
                const orderInfo = await this.client.getOrder(instId, orderResult.ordId);
                if (orderInfo.avgPx) {
                    filledPrice = parseFloat(orderInfo.avgPx);
                }
                if (orderInfo.accFillSz) {
                    filledQuantity = parseFloat(orderInfo.accFillSz);
                }

                console.log(`订单详情: 均价=${filledPrice}, 数量=${filledQuantity}, 状态=${orderInfo.state}`);
            }

            // 8. 设置止盈止损
            if (takeProfitPercent > 0 || stopLossPercent > 0) {
                const tpSlResults = await this.setTakeProfitAndStopLoss(
                    instId,
                    filledPrice,
                    filledQuantity,
                    takeProfitPercent,
                    stopLossPercent,
                    direction
                );
                console.log('止盈止损已设置');
            }

            return {
                success: true,
                order: orderResult,
                filledPrice,
                filledQuantity,
                direction,
                leverage
            };

        } catch (error) {
            console.error('交易执行失败:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 取消所有挂单
     */
    async cancelAllOrders(instId) {
        try {
            const result = await this.client.cancelAllOrders(instId);
            console.log(`已取消 ${instId} 的所有挂单`);
            return result;
        } catch (error) {
            console.error('取消订单失败:', error.message);
            throw error;
        }
    }

    /**
     * 获取账户信息
     */
    async getAccountInfo() {
        try {
            const balance = await this.client.getBalance();
            const positions = await this.client.getPositions();

            return {
                balance: {
                    totalEq: parseFloat(balance.totalEq),
                    availBal: parseFloat(balance.availBal)
                },
                positions: positions.map(pos => ({
                    instId: pos.instId,
                    pos: parseFloat(pos.pos),
                    avgPx: parseFloat(pos.avgPx),
                    upl: parseFloat(pos.upl)
                }))
            };
        } catch (error) {
            console.error('获取账户信息失败:', error.message);
            throw error;
        }
    }
}

module.exports = OKXFuturesTrader;