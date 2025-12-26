const express = require('express')
const router = express.Router()
const { initiateOxapayPayment, handleOxapayWebhook } = require('../controllers/paymentController')

// Initiate Payment
// Assuming /api/pay/oxapay/create
router.post('/create', initiateOxapayPayment)

// Webhook
// Assuming /api/pay/oxapay/webhook
router.post('/webhook', handleOxapayWebhook)

module.exports = router
