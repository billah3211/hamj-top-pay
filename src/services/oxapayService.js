const axios = require('axios')
const { prisma } = require('../db/prisma')

const createPayment = async (amount, userId, packageId) => {
  try {
    const merchantKey = process.env.OXAPAY_MERCHANT_KEY
    if (!merchantKey) throw new Error('OXAPAY_MERCHANT_KEY is missing')

    // Append packageId to orderId for tracking
    const orderId = packageId ? `TRX-${Date.now()}-${userId}-${packageId}` : `TRX-${Date.now()}-${userId}`

    const response = await axios.post('https://api.oxapay.com/merchants/request', {
      merchant: merchantKey,
      amount: amount,
      lifeTime: 30, // Link expiration in minutes
      feePaidByPayer: 0,
      underPaidCover: 2.5,
      callbackUrl: 'https://hamj-top-pay.onrender.com/api/pay/oxapay/webhook',
      returnUrl: 'https://hamj-top-pay.onrender.com/dashboard',
      description: `TopUp for User ${userId}`,
      orderId: orderId
    })

    if (response.data && response.data.result === 100) {
      return {
        payLink: response.data.payLink,
        trackId: response.data.trackId,
        orderId: orderId
      }
    } else {
      throw new Error(response.data.message || 'Payment request failed')
    }
  } catch (error) {
    console.error('OxaPay Create Error:', error.response?.data || error.message)
    throw error
  }
}

module.exports = { createPayment }
