export const formatPrice = (price, step) => {
    const multiplier = 1/step
    const p =  `${Math.floor(price * multiplier) / multiplier}`
    return p
}
