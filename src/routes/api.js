const express = require('express')
const router = express.Router()
const { prisma } = require('../db/prisma')

// Universal Webhook for ANY Android SMS Gateway
// Route: POST /api/payment/webhook
router.post('/payment/webhook', async (req, res) => {
  try {
    // 1. Log Raw Payload
    console.log('------------------------------------------------')
    console.log('Webhook Received at:', new Date().toISOString())
    console.log('Payload:', JSON.stringify(req.body, null, 2))

    // 2. Extract Data
    // We do NOT filter by sender (Bkash, Nagad, etc.) - Universal Acceptance
    const { message, trxID: payloadTrxID } = req.body

    if (!message) {
      console.log('Error: Message content missing')
      return res.status(400).json({ error: 'Message content missing' })
    }

    // 3. Universal Regex Extraction
    let extractedTrxID = payloadTrxID
    let extractedSenderNumber = null

    // Universal TrxID Regex
    // Captures ID after common labels: TrxID, TxnID, Trans ID, Ref, ID
    // OR matches a distinct alphanumeric string of 6+ chars if clearly isolated
    const trxIdPattern = /(?:TrxID|TxnID|TxnId|Trans\s*ID|Ref|ID)[\s:\.]*([A-Za-z0-9]{6,})/i
    
    // Universal Sender Number Regex (Bangladeshi 11 digits)
    // Matches 01[3-9] followed by 8 digits anywhere in the body
    const phonePattern = /(01[3-9]\d{8})/

    // Extract TrxID if not provided in payload
    if (!extractedTrxID) {
      const match = message.match(trxIdPattern)
      if (match && match[1]) {
        extractedTrxID = match[1]
      }
    }

    // Extract Sender Number
    const phoneMatch = message.match(phonePattern)
    if (phoneMatch && phoneMatch[1]) {
      extractedSenderNumber = phoneMatch[1]
    }

    console.log('--- Universal Extraction Results ---')
    console.log('Extracted TrxID:', extractedTrxID)
    console.log('Extracted Sender Number:', extractedSenderNumber)

    if (!extractedTrxID) {
      console.log('Result: Ignored (No TrxID found)')
      return res.status(200).json({ status: 'ignored', reason: 'No TrxID found' })
    }

    extractedTrxID = extractedTrxID.toUpperCase()

    // 4. Strict Business Rules: Check DB for PENDING Request
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

    // 5. Action: Process TopUp IMMEDIATELY
    console.log('Match Found! User:', topUpRequest.user.email)
    
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

    // 6. Intelligent Notification Logic
    let notificationMessage = `Deposit Successful. ${topUpRequest.package.diamondAmount} Diamonds added via ${topUpRequest.package.name}.`
    let senderMismatch = false

    if (extractedSenderNumber) {
      // Check if extracted number matches the user's submitted number
      if (topUpRequest.senderNumber !== extractedSenderNumber) {
        senderMismatch = true
        console.warn(`[WARNING] Sender Number Mismatch! Request: ${topUpRequest.senderNumber}, SMS: ${extractedSenderNumber}`)
        notificationMessage = `Deposit Approved (Warning: Sender number mismatch (${extractedSenderNumber}), but TrxID was correct). ${topUpRequest.package.diamondAmount} Diamonds added.`
      } else {
        console.log('Sender Number Verified: Match ✅')
      }
    }

    // Create Notification
    await prisma.notification.create({
      data: {
        userId: topUpRequest.userId,
        message: notificationMessage,
        type: senderMismatch ? 'alert' : 'credit'
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
