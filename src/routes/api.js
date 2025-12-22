const express = require('express')
const router = express.Router()
const { prisma } = require('../db/prisma')

// Helper function for regex extraction (reused in webhook and recovery)
const extractTransactionData = (message) => {
  // Improved TrxID Regex: Captures ID after TxnID, TrxID, Trans ID, or Ref
  const trxIdPattern = /(?:TrxID|TxnID|Trans\s*ID|Ref)[\s:\.]*([A-Za-z0-9]{6,})/i
  
  // Improved Sender Number Regex: Captures 11-digit number after 'Sender:' or 'From:'
  const phonePattern = /(?:Sender|From)[\s:\.]*(\+88)?(01\d{9})/i

  let extractedTrxID = null
  let extractedSenderNumber = null

  const match = message.match(trxIdPattern)
  if (match && match[1]) {
    extractedTrxID = match[1].toUpperCase()
  }

  const phoneMatch = message.match(phonePattern)
  if (phoneMatch && phoneMatch[2]) {
    extractedSenderNumber = phoneMatch[2]
  }

  return { extractedTrxID, extractedSenderNumber }
}

// Universal Webhook for ANY Android SMS Gateway
// Route: POST /api/payment/webhook
router.post('/payment/webhook', async (req, res) => {
  try {
    // 1. Log Raw Payload (Crucial for Debugging)
    console.log('------------------------------------------------')
    console.log('Webhook Received at:', new Date().toISOString())
    console.log('Webhook Body:', JSON.stringify(req.body, null, 2))

    // 2. Extract Data
    // We do NOT filter by sender (Bkash, Nagad, etc.) - Universal Acceptance
    const { message, trxID: payloadTrxID } = req.body

    if (!message) {
      console.log('Error: Message content missing')
      return res.status(200).json({ status: 'ignored', reason: 'Message content missing' })
    }

    // 3. Robust Regex Extraction
    let { extractedTrxID, extractedSenderNumber } = extractTransactionData(message)

    // If TrxID was provided in payload, use it (and normalize)
    if (payloadTrxID && !extractedTrxID) {
       extractedTrxID = payloadTrxID.toUpperCase()
    } else if (payloadTrxID && extractedTrxID && payloadTrxID.toUpperCase() !== extractedTrxID) {
       // If both exist but differ, prefer the regex one from message as it's the raw source, 
       // or prefer payload if we trust the gateway's extraction more.
       // Let's stick to the extracted one from message if found, as that's what we validated.
       // Actually, let's allow payloadTrxID to override if regex failed.
    }
    
    // Fallback: If regex failed but payload has it
    if (!extractedTrxID && payloadTrxID) {
      extractedTrxID = payloadTrxID.toUpperCase()
    }

    console.log('--- Extraction Results ---')
    console.log('Extracted TrxID:', extractedTrxID)
    console.log('Extracted Sender Number:', extractedSenderNumber)

    if (!extractedTrxID) {
      console.log('Result: Ignored (No TrxID found)')
      return res.status(200).json({ status: 'ignored', reason: 'No TrxID found' })
    }

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
    console.log('Auto-Approved TrxID:', extractedTrxID) // Specific log requested by user
    console.log('Match Found! User:', topUpRequest.user.email)
    
    // Add Diamonds to User
    await prisma.user.update({
      where: { id: topUpRequest.userId },
      data: {
        diamond: { increment: topUpRequest.package.diamondAmount }
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
    // Always return 200 to gateway to prevent retries on logic errors, but log the error
    res.status(200).json({ status: 'error', message: 'Internal Server Error' })
  }
})

// Missed Payment Recovery Endpoint
// Route: POST /api/admin/recover-payments
router.post('/admin/recover-payments', async (req, res) => {
  try {
    console.log('Starting Missed Payment Recovery...')
    
    // 1. Fetch SMS API Key
    let smsApiKey = process.env.SMS_API_KEY || ''
    const config = await prisma.appConfig.findUnique({ where: { key: 'SMS_API_KEY' } })
    if (config) smsApiKey = config.value

    if (!smsApiKey) {
      return res.status(500).json({ status: 'error', message: 'SMS_API_KEY not configured' })
    }

    // 2. Fetch last 50-100 SMS from Gateway
    const response = await fetch(`https://api.smsmobileapi.com/sendsms/get_messages?api_key=${smsApiKey}`)
    if (!response.ok) {
      throw new Error(`Gateway returned status: ${response.status}`)
    }
    
    const data = await response.json()
    // Assume data.messages or data is the array. 
    // The API documentation usually returns { messages: [...] } or just [...]
    // We'll try to detect array.
    let messages = []
    if (Array.isArray(data)) {
      messages = data
    } else if (data.messages && Array.isArray(data.messages)) {
      messages = data.messages
    } else {
      // Fallback: If it's a single object, wrap in array? Or error?
      console.log('Unexpected API response format:', data)
      // If data has 'error', return it
      if (data.error) return res.status(400).json({ status: 'error', message: data.error })
    }

    // Slice to ensure we process at most 100
    messages = messages.slice(0, 100)
    
    console.log(`Fetched ${messages.length} SMS messages for recovery analysis.`)
    
    const recoveredTrxIDs = []

    // 3. Process Loop
    for (const sms of messages) {
      // SMS object usually has 'message' and 'sender'
      const messageContent = sms.message
      if (!messageContent) continue

      const { extractedTrxID, extractedSenderNumber } = extractTransactionData(messageContent)
      
      if (!extractedTrxID) continue

      // Check DB for PENDING request
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

      if (topUpRequest) {
        // Approve it!
        console.log(`[RECOVERY] Found missed payment! TrxID: ${extractedTrxID}`)
        
        // Update User
        await prisma.user.update({
          where: { id: topUpRequest.userId },
          data: { diamond: { increment: topUpRequest.package.diamondAmount } }
        })

        // Update Request
        await prisma.topUpRequest.update({
          where: { id: topUpRequest.id },
          data: { status: 'COMPLETED', processedAt: new Date() }
        })

        // Notification
        let notificationMessage = `Deposit Successful (Recovered). ${topUpRequest.package.diamondAmount} Diamonds added via ${topUpRequest.package.name}.`
        let senderMismatch = false
        if (extractedSenderNumber && topUpRequest.senderNumber !== extractedSenderNumber) {
           senderMismatch = true
           notificationMessage = `Deposit Approved (Recovered, Warning: Sender number mismatch (${extractedSenderNumber})).`
        }

        await prisma.notification.create({
          data: {
            userId: topUpRequest.userId,
            message: notificationMessage,
            type: senderMismatch ? 'alert' : 'credit'
          }
        })
        
        recoveredTrxIDs.push(extractedTrxID)
      }
    }

    res.json({ 
      message: 'Recovery run complete.', 
      recovered_count: recoveredTrxIDs.length, 
      recovered: recoveredTrxIDs 
    })

  } catch (error) {
    console.error('Recovery Error:', error)
    res.status(500).json({ status: 'error', message: error.message })
  }
})

module.exports = router
