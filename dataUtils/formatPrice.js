const Decimal =require('decimal.js')

export const formatPrice = (price, step) => {
    const p = new Decimal(Number(price)).div(Number(step)).floor().times(Number(step)).toNumber()
    return `${p}`
}
