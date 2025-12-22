const express = require('express')
const router = express.Router()
const { prisma } = require('../db/prisma')

// Webhook for Android SMS Gateway
// Route: POST /api/payment/webhook
router.post('/payment/webhook', async (req, res) => {
  try {
    console.log('Webhook Received:', req.body)

    // 1. Extract Data
    // Payload usually comes as JSON or Form Data depending on the app. 
    // We'll handle common fields.
    // Expected fields: sender (phone), message (content), trxID (optional, if app parsed it)
    const { sender, message, trxID: payloadTrxID } = req.body

    if (!message) {
      return res.status(400).json({ error: 'Message content missing' })
    }

    // 2. Extract TrxID from Message if not provided in payload
    let extractedTrxID = payloadTrxID

    if (!extractedTrxID) {
      // Regex Patterns for BD Mobile Banking
      const bkashPattern = /TrxID[\s:]+([A-Za-z0-9]+)/i
      const nagadPattern = /TxnID[\s:]+([A-Za-z0-9]+)/i
      const rocketPattern = /TxnId[\s:]+([A-Za-z0-9]+)/i
      
      const match = message.match(bkashPattern) || message.match(nagadPattern) || message.match(rocketPattern)
      if (match && match[1]) {
        extractedTrxID = match[1]
      }
    }

    if (!extractedTrxID) {
      console.log('No TrxID found in message:', message)
      return res.status(200).json({ status: 'ignored', reason: 'No TrxID found' })
    }

    extractedTrxID = extractedTrxID.toUpperCase()
    console.log('Extracted TrxID:', extractedTrxID)

    // 3. Find Pending Request with this TrxID
    const topUpRequest = await prisma.topUpRequest.findFirst({
      where: {
        trxId: extractedTrxID,
        status: 'PENDING'
      },
      include: {
        package: true,
        user: true
      }
    })

    if (!topUpRequest) {
      console.log('No pending request found for TrxID:', extractedTrxID)
      return res.status(200).json({ status: 'ignored', reason: 'TrxID not found or already processed' })
    }

    // 4. Verify Sender (Optional but recommended)
    // Some gateways send the sender address (e.g., "bKash", "16247"). 
    // We can check if the SMS is actually from the bank if we want strict security.
    // For now, we assume the Gateway App is trusted.

    // 5. Process TopUp
    // Add Diamonds to User
    await prisma.user.update({
      where: { id: topUpRequest.userId },
      data: {
        diamonds: { increment: topUpRequest.package.diamondAmount }
      }
    })

    // Update Request Status
    await prisma.topUpRequest.update({
      where: { id: topUpRequest.id },
      data: {
        status: 'COMPLETED',
        processedAt: new Date()
      }
    })

    // Create Notification
    await prisma.notification.create({
      data: {
        userId: topUpRequest.userId,
        message: `TopUp Successful! ${topUpRequest.package.diamondAmount} Diamonds added via ${topUpRequest.package.name}.`,
        type: 'credit'
      }
    })

    console.log(`TopUp Completed for User ${topUpRequest.userId} - TrxID: ${extractedTrxID}`)

    res.status(200).json({ status: 'success', message: 'TopUp processed successfully' })

  } catch (error) {
    console.error('Webhook Error:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

module.exports = router
