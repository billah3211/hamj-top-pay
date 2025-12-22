const express = require('express')
const router = express.Router()
const { prisma } = require('../db/prisma')

// Webhook for Android SMS Gateway
// Route: POST /api/payment/webhook
router.post('/payment/webhook', async (req, res) => {
  try {
    // 1. Log Raw Payload
    console.log('------------------------------------------------')
    console.log('Webhook Received at:', new Date().toISOString())
    console.log('Payload:', JSON.stringify(req.body, null, 2))

    // 2. Extract Data
    const { sender, message, trxID: payloadTrxID } = req.body

    if (!message) {
      console.log('Error: Message content missing')
      return res.status(400).json({ error: 'Message content missing' })
    }

    // 3. Smart Extraction Logic
    let extractedTrxID = payloadTrxID
    let extractedSenderNumber = null

    // Regex for TrxID (matches TrxID, TxnID, TransID followed by alphanumeric)
    const trxIdPattern = /(?:TrxID|TxnID|TxnId|TransID)[\s:]*([A-Za-z0-9]+)/i
    
    // Regex for BD Phone Number (matches 01[3-9] followed by 8 digits)
    // Matches "from 017..." or just "017..." inside text
    const phonePattern = /(?:from|sender|mobile|num|Tk)[\s:\.]*(01[3-9]\d{8})/i
    // Fallback simple phone pattern
    const simplePhonePattern = /(01[3-9]\d{8})/

    // Extract TrxID if not in payload
    if (!extractedTrxID) {
      const match = message.match(trxIdPattern)
      if (match && match[1]) {
        extractedTrxID = match[1]
      }
    }

    // Extract Sender Number from Body
    const phoneMatch = message.match(phonePattern) || message.match(simplePhonePattern)
    if (phoneMatch && phoneMatch[1]) {
      extractedSenderNumber = phoneMatch[1]
    }

    console.log('--- Extraction Results ---')
    console.log('Extracted TrxID:', extractedTrxID)
    console.log('Extracted Sender Number:', extractedSenderNumber)

    if (!extractedTrxID) {
      console.log('Result: Ignored (No TrxID found)')
      return res.status(200).json({ status: 'ignored', reason: 'No TrxID found' })
    }

    extractedTrxID = extractedTrxID.toUpperCase()

    // 4. Verification Logic: Search DB for PENDING request
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
      console.log(`Result: Ignored (No PENDING request found for TrxID: ${extractedTrxID})`)
      return res.status(200).json({ status: 'ignored', reason: 'TrxID not found or already processed' })
    }

    console.log('Match Found! User:', topUpRequest.user.email, 'Requested Sender:', topUpRequest.senderNumber)

    // Optional: Verify Sender Number
    if (extractedSenderNumber) {
      // Normalize numbers (remove +88 if present, though regex handles 01...)
      if (topUpRequest.senderNumber !== extractedSenderNumber) {
        console.warn(`[WARNING] Sender Number Mismatch! Request: ${topUpRequest.senderNumber}, SMS says: ${extractedSenderNumber}`)
        // We log it but proceed because TrxID is the unique proof of payment.
        // You can uncomment the next line to STRICTLY block mismatches:
        // return res.status(200).json({ status: 'failed', reason: 'Sender number mismatch' })
      } else {
        console.log('Sender Number Verified: Match ✅')
      }
    }

    // 5. Action: Process TopUp
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
    console.log('------------------------------------------------')

    res.status(200).json({ status: 'success', message: 'TopUp processed successfully' })

  } catch (error) {
    console.error('Webhook Error:', error)
    res.status(500).json({ error: 'Internal Server Error' })
  }
})

module.exports = router
