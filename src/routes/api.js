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

    const { message, trxID: payloadTrxID, sender } = req.body

    // STEP 1: SAVE FIRST (Crucial)
    // Immediately upon receiving the request, create the SMSLog record.
    let log = null
    try {
      log = await prisma.sMSLog.create({
        data: {
          sender: sender || 'Unknown',
          message: message || '',
          status: 'RECEIVED'
        }
      })
      console.log('SMS Logged with ID:', log.id)
    } catch (e) {
      console.error('CRITICAL ERROR: Failed to log SMS:', e)
      // If logging fails, we might still try to process, but usually this is fatal.
    }

    // If no message, we can't process
    if (!message) {
      console.log('Error: Message content missing')
      return res.status(200).json({ success: true, message: 'Message content missing' })
    }

    // STEP 2: Security Check (Whitelist)
    const allowedSenders = ['bkash', 'nagad', 'rocket', '16216', 'upay']
    const senderNormalized = sender ? sender.toLowerCase() : ''
    
    // Check if sender is in the allowed list
    if (!allowedSenders.includes(senderNormalized)) {
      console.warn(`Security Alert: Fake SMS attempt from ${sender}`)

      // IF BLOCKED (Fake Sender): Update the existing log status
      if (log) {
        await prisma.sMSLog.update({
          where: { id: log.id },
          data: { status: 'SUSPICIOUS' }
        })
      }

      // Find the Culprit: Extract TrxID from this fake SMS
      let { extractedTrxID } = extractTransactionData(message)
      
      // Fallback if regex failed but payload has it
      if (!extractedTrxID && payloadTrxID) {
        extractedTrxID = payloadTrxID.toUpperCase()
      }

      if (extractedTrxID) {
        // Find the PENDING request with that TrxID
        const culpritRequest = await prisma.topUpRequest.findFirst({
          where: { 
            trxId: extractedTrxID,
            status: 'PENDING'
          }
        })

        if (culpritRequest) {
          console.log(`Culprit Found! Rejecting Request for TrxID: ${extractedTrxID}`)

          // Punish: Reject immediately
          await prisma.topUpRequest.update({
            where: { id: culpritRequest.id },
            data: { status: 'REJECTED' }
          })

          // Notify: Warn the user
          await prisma.notification.create({
            data: {
              userId: culpritRequest.userId,
              message: "WARNING: Fake SMS detected from a personal number. Your request is rejected and account flagged.",
              type: 'alert'
            }
          })
        }
      }

      // Return response and STOP.
      return res.status(200).json({ success: true, message: 'Blocked: Sender not allowed' })
    }

    // STEP 3: Process Real Payment
    // If allowed, proceed to extract TrxID and approve payment.
    
    // Robust Regex Extraction
    let { extractedTrxID, extractedSenderNumber } = extractTransactionData(message)

    // If TrxID was provided in payload, use it (and normalize)
    if (payloadTrxID && !extractedTrxID) {
       extractedTrxID = payloadTrxID.toUpperCase()
    } else if (payloadTrxID && extractedTrxID && payloadTrxID.toUpperCase() !== extractedTrxID) {
       // Conflict: stick to extractedTrxID usually, or allow payload override
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
      return res.status(200).json({ success: true, message: 'No TrxID found' })
    }

    // Check DB for PENDING Request
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
      return res.status(200).json({ success: true, message: 'TrxID not found or already processed' })
    }

    // Action: Process TopUp IMMEDIATELY
    console.log('Auto-Approved TrxID:', extractedTrxID)
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

    // Update Log if Payment Approved
    if (log) {
      await prisma.sMSLog.update({
        where: { id: log.id },
        data: { 
          status: 'PROCESSED_PAYMENT',
          trxId: extractedTrxID
        }
      })
    }

    // Notification Logic
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

  } catch (error) {
    console.error('Webhook Logic Error:', error)
    // We do NOT return error status, we return success so gateway doesn't retry infinitely for logic errors
  }

  // STEP 4: Always return success at the end
  return res.status(200).json({ success: true })
})

// Missed Payment Recovery Endpoint
// Route: POST /api/admin/recover-payments
router.post('/admin/recover-payments', async (req, res) => {
  return res.status(503).json({ 
    status: 'error', 
    message: 'Recovery feature is currently disabled by administrator.' 
  })
})

// Delete SMS Logs (Bulk)
router.post('/admin/delete-sms-logs', async (req, res) => {
  try {
    const { startDate, endDate, deleteType } = req.body // deleteType: 'ALL' or 'PROCESSED_ONLY'

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and End date are required' })
    }

    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    const whereClause = {
      createdAt: {
        gte: start,
        lte: end
      }
    }

    if (deleteType === 'PROCESSED_ONLY') {
      whereClause.status = {
        in: ['PROCESSED', 'PROCESSED_PAYMENT']
      }
    }

    const result = await prisma.sMSLog.deleteMany({
      where: whereClause
    })

    res.json({ count: result.count })

  } catch (error) {
    console.error('Delete SMS Logs Error:', error)
    res.status(500).json({ error: 'Failed to delete SMS logs' })
  }
})

// Get SMS Logs
router.get('/admin/sms-logs', async (req, res) => {
  try {
    const logs = await prisma.sMSLog.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' }
    })
    res.json(logs)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to fetch SMS logs' })
  }
})

// Route A: Send Warning SMS (Real SMS Gateway Integration)
router.post('/admin/send-warning-sms', async (req, res) => {
  try {
    const { phoneNumber, message } = req.body
    if (!phoneNumber || !message) return res.status(400).json({ error: 'Missing phone or message' })
    
    // API Details
    const API_URL = 'https://api.smsmobileapi.com/sendsms'
    const API_KEY = process.env.SMS_API_KEY

    if (!API_KEY) {
      console.error('Missing SMS_API_KEY in environment variables')
      return res.status(500).json({ error: 'Server configuration error: Missing SMS API Key' })
    }

    // Prepare parameters for x-www-form-urlencoded
    const params = new URLSearchParams()
    params.append('recipients', phoneNumber)
    params.append('message', message)
    params.append('apikey', API_KEY)
    params.append('sendsms', '1')

    // Call SMS API
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    })

    // Log the raw response for debugging
    const resultText = await response.text()
    console.log(`SMS API Response for ${phoneNumber}:`, resultText)

    // The API might return text or JSON. We assume success if the call completes.
    // If you need strict validation, parse resultText based on the provider's docs.
    
    res.json({ success: true, message: 'Warning sent successfully!' })

  } catch (error) {
    console.error('Send Warning SMS Error:', error)
    res.status(500).json({ error: 'Failed to send warning SMS' })
  }
})

// Route B: Force Approve SMS
router.post('/admin/force-approve-sms', async (req, res) => {
  try {
    const { logId } = req.body
    const log = await prisma.sMSLog.findUnique({ where: { id: parseInt(logId) } })
    
    if (!log) return res.status(404).json({ error: 'Log not found' })

    const { extractedTrxID } = extractTransactionData(log.message)
    
    if (!extractedTrxID) {
      return res.status(400).json({ error: 'No TrxID could be extracted from this message' })
    }

    const topUpRequest = await prisma.topUpRequest.findFirst({
      where: { 
        trxId: extractedTrxID,
        status: 'PENDING'
      },
      include: { package: true }
    })

    if (!topUpRequest) {
      return res.status(404).json({ error: `No PENDING request found for TrxID: ${extractedTrxID}` })
    }

    // Approve Payment
    await prisma.user.update({
      where: { id: topUpRequest.userId },
      data: { diamond: { increment: topUpRequest.package.diamondAmount } }
    })
    
    await prisma.topUpRequest.update({
      where: { id: topUpRequest.id },
      data: { status: 'COMPLETED', processedAt: new Date() }
    })

    // Update Log Status
    await prisma.sMSLog.update({
      where: { id: parseInt(logId) },
      data: { 
        status: 'MANUALLY_APPROVED', 
        trxId: extractedTrxID 
      }
    })
    
    // Notification
    await prisma.notification.create({
      data: {
        userId: topUpRequest.userId,
        message: `Deposit Approved Manually. ${topUpRequest.package.diamondAmount} Diamonds added via ${topUpRequest.package.name}.`,
        type: 'credit'
      }
    })

    res.json({ success: true, message: 'Payment Force Approved' })

  } catch (error) {
    console.error('Force Approve Error:', error)
    res.status(500).json({ error: 'Failed to force approve payment' })
  }
})

// Route C: Delete Single Log
router.delete('/admin/sms-log/:id', async (req, res) => {
  try {
    await prisma.sMSLog.delete({ where: { id: parseInt(req.params.id) } })
    res.json({ success: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to delete log' })
  }
})

module.exports = router
