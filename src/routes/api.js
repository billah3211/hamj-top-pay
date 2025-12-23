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

    const { message, trxID: payloadTrxID } = req.body

    // Check ALL possible fields for sender
    const rawSender = req.body.sender || req.body.number || req.body.from || 'Unknown'

    // Phone Number Normalization (CRITICAL)
    const normalizedSender = rawSender.toString().replace(/^(\+?88|88)/, '')
    
    console.log('Incoming SMS:', rawSender, 'Normalized:', normalizedSender)

    // STEP 1: Immediate Database Save (Crucial)
    let log = null
    try {
      log = await prisma.sMSLog.create({
        data: {
          sender: rawSender, // Keep original raw sender
          message: message || '',
          status: 'RECEIVED'
        }
      })
      console.log('SMS Logged with ID:', log.id)
    } catch (e) {
      console.error('CRITICAL ERROR: Failed to log SMS:', e)
    }

    // If no message, we can't process further
    if (!message) {
      console.log('Error: Message content missing')
      return res.status(200).json({ success: true, message: 'Message content missing' })
    }

    // STEP 2: Categorize & Process

    const allowedSenders = ['bkash', 'nagad', 'rocket', 'upay']
    const normalizedLower = normalizedSender.toLowerCase()

    // Condition A (Whitelist)
    if (allowedSenders.includes(normalizedLower)) {
       console.log('Sender is Whitelisted. Proceeding to Payment Logic...')
       
       // --- PAYMENT PROCESSING LOGIC ---
       
       // Robust Regex Extraction
       let { extractedTrxID, extractedSenderNumber } = extractTransactionData(message)

       // If TrxID was provided in payload, use it (and normalize)
       if (payloadTrxID && !extractedTrxID) {
          extractedTrxID = payloadTrxID.toUpperCase()
       }

       // Fallback: If regex failed but payload has it
       if (!extractedTrxID && payloadTrxID) {
         extractedTrxID = payloadTrxID.toUpperCase()
       }

       console.log('--- Extraction Results ---')
       console.log('Extracted TrxID:', extractedTrxID)
       console.log('Extracted Sender Number:', extractedSenderNumber)

       if (extractedTrxID) {
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

         if (topUpRequest) {
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
                 status: 'PROCESSED',
                 trxId: extractedTrxID
               }
             })
           }

           // Notification Logic
           let notificationMessage = `Deposit Successful. ${topUpRequest.package.diamondAmount} Diamonds added via ${topUpRequest.package.name}.`
           let senderMismatch = false

           if (extractedSenderNumber) {
             if (topUpRequest.senderNumber !== extractedSenderNumber) {
               senderMismatch = true
               console.warn(`[WARNING] Sender Number Mismatch! Request: ${topUpRequest.senderNumber}, SMS: ${extractedSenderNumber}`)
               notificationMessage = `Deposit Approved (Warning: Sender number mismatch (${extractedSenderNumber}), but TrxID was correct). ${topUpRequest.package.diamondAmount} Diamonds added.`
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
         } else {
           console.log(`Result: Ignored (No PENDING request found for TrxID: ${extractedTrxID})`)
         }
       } else {
         console.log('Result: Ignored (No TrxID found)')
       }

    } 
    // Condition B (Suspicious/Fake)
    else if (/^01\d{9}$/.test(normalizedSender)) {
       // Matches BD Mobile Number
       console.warn(`Suspicious SMS from BD Number: ${normalizedSender}`)
       if (log) {
         await prisma.sMSLog.update({
           where: { id: log.id },
           data: { status: 'SUSPICIOUS' }
         })
       }
    }
    // Condition C (Junk/Other)
    else {
       // Do nothing. Leave status as 'RECEIVED'
       console.log(`Sender ${normalizedSender} is unknown/junk. Leaving log as RECEIVED.`)
    }

    console.log('------------------------------------------------')

  } catch (error) {
    console.error('Webhook Logic Error:', error)
  }

  // Always return success
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

// Helper: Calculate User Level
const calculateLevel = (count) => {
  if (count < 100) return 0;
  if (count < 500) return 1;
  if (count < 1200) return 2;
  if (count < 2000) return 3;
  if (count < 5000) return 4;
  if (count < 10000) return 5;
  if (count < 15000) return 6;
  return 7 + Math.floor((count - 15000) / 5000);
}

// Helper: Get Level Progress
const getLevelProgress = (count) => {
  let start = 0, next = 100;
  if (count < 100) { start = 0; next = 100; }
  else if (count < 500) { start = 100; next = 500; }
  else if (count < 1200) { start = 500; next = 1200; }
  else if (count < 2000) { start = 1200; next = 2000; }
  else if (count < 5000) { start = 2000; next = 5000; }
  else if (count < 10000) { start = 5000; next = 10000; }
  else if (count < 15000) { start = 10000; next = 15000; }
  else {
    const base = 15000;
    const step = 5000;
    const diff = count - base;
    const levelOffset = Math.floor(diff / step);
    start = base + levelOffset * step;
    next = start + step;
  }
  
  const percent = Math.min(100, Math.max(0, ((count - start) / (next - start)) * 100));
  
  return { current: count, next, start, percent };
}

// Get Public User Profile (JSON)
router.get('/profile/:username', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ 
        where: { username: req.params.username },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            email: true,
            country: true,
            createdAt: true,
            currentAvatar: true,
            bio: true,
            website: true,
            social: true
        }
    })
    
    if (!user) return res.status(404).json({ error: 'User not found' })

    const taskCount = await prisma.linkSubmission.count({ where: { visitorId: user.id, status: 'APPROVED' } })
    const level = calculateLevel(taskCount)
    const levelProgress = getLevelProgress(taskCount)

    res.json({
        ...user,
        level,
        levelProgress
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Failed to fetch profile' })
  }
})

module.exports = router
