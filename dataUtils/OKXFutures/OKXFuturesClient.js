const crypto = require('crypto');

class OKXFuturesClient {
    constructor(apiKey, apiSecret, passphrase, isTest = false) {
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.passphrase = passphrase;
        this.baseURL = 'https://www.okx.com';
        this.isTest = isTest;
        this.recvWindow = 5000;
    }

    /**
     * 生成签名
     */
    _generateSignature(timestamp, method, requestPath, body = '') {
        method = method.toUpperCase();

        const [path, query] = requestPath.split('?');
        let message = timestamp + method + path;

        if (query) {
            message += '?' + query;
        }

        if ((method === 'POST' || method === 'PUT') && body && body !== '{}') {
            message += body;
        }

        return crypto.createHmac('sha256', this.apiSecret).update(message).digest('base64');
    }

    /**
     * 发送HTTP请求
     */
    async _sendRequest(method, endpoint, params = {}, isSigned = false) {
        return new Promise((resolve, reject) => {
            const timestamp = new Date().toISOString();
            let body = '';
            let requestPath = endpoint;

            console.log(`请求: ${method} ${endpoint}`, params);

            if (method.toUpperCase() === 'GET' && Object.keys(params).length > 0) {
                const queryString = new URLSearchParams(params).toString();
                requestPath += `?${queryString}`;
            } else if (method.toUpperCase() === 'POST' && Object.keys(params).length > 0) {
                body = JSON.stringify(params);
            }

            const headers = {
                'Content-Type': 'application/json',
                'OK-ACCESS-KEY': this.apiKey,
                'OK-ACCESS-PASSPHRASE': this.passphrase,
                'OK-ACCESS-TIMESTAMP': timestamp,
                'x-simulated-trading': this.isTest ? '1' : '0'
            };

            if (isSigned) {
                const signature = this._generateSignature(timestamp, method, requestPath, body);
                headers['OK-ACCESS-SIGN'] = signature;
            }

            const url = this.baseURL + requestPath;
            const https = require('https');
            const urlObj = new URL(url);

            const options = {
                hostname: urlObj.hostname,
                port: 443,
                path: urlObj.pathname + urlObj.search,
                method: method,
                headers: headers
            };

            const req = https.request(options, (res) => {
                let data = '';

                console.log('响应状态:', res.statusCode);

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.code !== '0' && parsed.code !== undefined) {
                            reject(new Error(`OKX API Error: ${parsed.msg} (code: ${parsed.code})`));
                        } else {
                            resolve(parsed.data || parsed);
                        }
                    } catch (error) {
                        reject(new Error(`响应解析失败: ${error.message}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(new Error(`网络请求失败: ${error.message}`));
            });

            req.setTimeout(10000, () => {
                req.destroy();
                reject(new Error('请求超时'));
            });

            if (method.toUpperCase() === 'POST' && body) {
                req.write(body);
            }

            req.end();
        });
    }

    /**
     * 获取交易产品基础信息
     */
    async getInstruments(instType = 'SWAP', uly = '') {
        const params = {instType};
        if (uly) params.uly = uly;
        return this._sendRequest('GET', '/api/v5/public/instruments', params, false);
    }

    /**
     * 获取当前价格
     */
    async getTicker(instId) {
        const data = await this._sendRequest('GET', '/api/v5/market/ticker', {instId}, false);
        return data && data.length > 0 ? data[0] : null;
    }

    /**
     * 获取账户余额
     */
    async getBalance(ccy = 'USDT') {
        const data = await this._sendRequest('GET', '/api/v5/account/balance', {ccy}, true);
        return data && data.length > 0 ? data[0] : null;
    }

    async getPositionMode(instId = '') {
        const params = {};
        if (instId) params.instFamily = instId;

        const data = await this._sendRequest('GET', '/api/v5/account/config', params, true);
        if (data && data.length > 0) {
            return data[0].posMode;
        }
        throw new Error('未获取到持仓模式');
    }

    async setPositionMode(posMode, instId = '') {
        if (!['net_mode', 'long_short_mode'].includes(posMode)) {
            throw new Error('posMode 参数必须是 "net_mode" 或 "long_short_mode"');
        }

        const params = {posMode};
        if (instId) params.instId = instId;

        return this._sendRequest('POST', '/api/v5/account/set-position-mode', params, true);
    }

    async setLeverageMode(instId, lever, mgnMode = 'cross') {
        if (!['cross', 'isolated'].includes(mgnMode)) {
            throw new Error('mgnMode 参数必须是 "cross" 或 "isolated"');
        }
        const params = {
            instId,
            lever: lever.toString(),
            mgnMode
        };
        return this._sendRequest('POST', '/api/v5/account/set-leverage', params, true);
    }

    /**
     * 获取持仓信息
     */
    async getPositions(instType = 'SWAP', instId = '') {
        const params = {instType};
        if (instId) params.instId = instId;
        const data = await this._sendRequest('GET', '/api/v5/account/positions', params, true);
        return data || [];
    }

    /**
     * 获取单个持仓
     */
    async getPosition(instId) {
        const positions = await this.getPositions('SWAP', instId);
        const activePosition = positions.find(pos => {
            const posSize = parseFloat(pos.pos);
            return posSize !== 0 && !isNaN(posSize);
        });
        return activePosition || null;
    }

    /**
     * 设置杠杆倍数
     */
    async setLeverage(instId, lever, mgnMode = 'cross') {
        const params = {
            instId,
            lever: lever.toString(),
            mgnMode
        };
        return this._sendRequest('POST', '/api/v5/account/set-leverage', params, true);
    }

    /**
     * 市价下单 - 修正版本
     */
    async placeMarketOrder(instId, side, sz, tdMode = 'cross') {
        try {
            // 参数验证
            if (!instId || !side || sz === undefined || sz === null) {
                throw new Error('缺少必要参数: instId, side, sz');
            }

            if (!['buy', 'sell'].includes(side.toLowerCase())) {
                throw new Error('side 参数必须是 "buy" 或 "sell"');
            }

            if (!['isolated', 'cross'].includes(tdMode)) {
                throw new Error('tdMode 参数必须是 "isolated" 或 "cross"');
            }
            //
            // if (!['long', 'short', 'net'].includes(posSide)) {
            //     throw new Error('posSide 参数必须是 "long", "short" 或 "net"');
            // }

            // 正确的市价单参数
            const orderParams = {
                isTradeBorrowMode: false,
                instId: instId,
                tdMode: tdMode,
                side: side.toLowerCase(),
                ordType: 'market',
                sz: Number(sz),
                posSide: side === "buy" ? "long" : "short"
            };

            console.log('市价单参数:', orderParams);
            return await this._sendRequest('POST', '/api/v5/trade/order', orderParams, true);
        } catch (error) {
            console.error('市价下单失败:', error.message);
            throw error;
        }
    }

    /**
     * 按金额市价下单（使用quoteSz参数）
     */
    async placeMarketOrderByQuote(instId, side, quoteSz, tdMode = 'cross', posSide = 'net') {
        try {
            if (!instId || !side || quoteSz === undefined || quoteSz === null) {
                throw new Error('缺少必要参数: instId, side, quoteSz');
            }

            if (!['buy', 'sell'].includes(side.toLowerCase())) {
                throw new Error('side 参数必须是 "buy" 或 "sell"');
            }

            const quoteSzStr = quoteSz.toString();

            // 使用quoteSz参数的市价单
            const orderParams = {
                instId: instId,
                tdMode: tdMode,
                side: side.toLowerCase(),
                ordType: 'market',
                quoteSz: quoteSzStr,  // 使用quoteSz而不是sz
                posSide: posSide.toLowerCase()
            };

            console.log('按金额市价单参数:', orderParams);
            return await this._sendRequest('POST', '/api/v5/trade/order', orderParams, true);
        } catch (error) {
            console.error('按金额市价下单失败:', error.message);
            throw error;
        }
    }

    /**
     * 限价单
     */
    async placeLimitOrder(instId, side, sz, px, tdMode = 'cross', posSide = 'net') {
        const orderParams = {
            instId,
            tdMode,
            side: side.toLowerCase(),
            ordType: 'limit',
            sz: sz.toString(),
            px: px.toString(),
            posSide: posSide.toLowerCase()
        };

        return this._sendRequest('POST', '/api/v5/trade/order', orderParams, true);
    }

    /**
     * 获取订单信息
     */
    async getOrder(instId, ordId) {
        const data = await this._sendRequest('GET', '/api/v5/trade/order', {
            instId,
            ordId
        }, true);
        return data && data.length > 0 ? data[0] : null;
    }

    /**
     * 撤销订单
     */
    async cancelOrder(instId, ordId) {
        return this._sendRequest('POST', '/api/v5/trade/cancel-order', {
            instId,
            ordId
        }, true);
    }

    /**
     * 撤销全部订单
     */
    async cancelAllOrders(instId) {
        return this._sendRequest('POST', '/api/v5/trade/cancel-all-orders', {
            instId
        }, true);
    }

}

module.exports = OKXFuturesClient;