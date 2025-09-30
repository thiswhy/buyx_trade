const Decimal =require('decimal.js')

export const formatPrice = (price, step) => {
    const p = new Decimal(price).div(step).floor().times(step).toNumber()
    return `${p}`
}
