import {getUserApiKey} from "../../dataUtils/getUserApiKey";
import {trade} from "../../dataUtils/trade";
import {UserTradeOptionsModel} from "buydip_scheme/scheme/userTradeOptions";
import {isEmpty, orderBy} from "lodash";
import {FundFlowModel, OverallRecModel} from "buydip_scheme";
import moment from "moment";
import {formatResponse} from "../../dataUtils/formatResponse";

export const postRecommendData = async (req, res) => {
    try {
        const volumeData = await OverallRecModel.find({createdAt: {$gte: moment().startOf('day').toDate()}})
        const todaySymbol = volumeData.map((item) => {
            return item.symbol
        })
        const todayFunds = await FundFlowModel.find({
            symbol: {$in: todaySymbol},
            date: moment().subtract(1, 'days').format('YYYY-MM-DD')
        }).lean()
        const todayTotalFunds = todayFunds.map(obj => ({
            ...obj,
            sum: Number(obj.inAmount) + Number(obj.outAmount)
        }));
        const sortTodayFunds = orderBy(todayTotalFunds, ["sum"], ['desc'])
        const symbolOrderMap = sortTodayFunds.reduce((map, obj, index) => {
            map[obj.symbol] = index;
            return map;
        }, {});
        const sortedArray = orderBy(volumeData, obj => symbolOrderMap[obj.symbol]);
        if (!isEmpty(sortedArray)) {
            const apiKeys = await getUserApiKey()
            for (const apiItem of apiKeys) {
                const {userId, apiKey, apiSecret} = apiItem
                const option = await UserTradeOptionsModel.findOne({userId, isActive: true}).lean()
                console.log("option", option)
                if (!isEmpty(option)) {
                    await trade({apiKey, apiSecret, userOptions: option, tradeData: sortedArray})
                }
            }
        }
        return formatResponse(res, 200, 0, {}, 'success')
    } catch (e) {
        console.log(e, e.message)
    }
}