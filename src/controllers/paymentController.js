const { prisma } = require('../db/prisma')
const { createPayment } = require('../services/oxapayService')

const { getSystemSettings } = require('../utils/settings')

const initiateOxapayPayment = async (req, res) => {
  try {
    const { packageId } = req.body
    const userId = req.session.userId

    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    if (!packageId) return res.status(400).json({ error: 'Missing packageId' })

    // 1. Fetch Package Details
    const pkg = await prisma.topUpPackage.findUnique({ where: { id: parseInt(packageId) } })
    if (!pkg) return res.status(404).json({ error: 'Package not found' })

    // 2. Calculate USD Amount
    const settings = await getSystemSettings()
    const rate = parseFloat(settings.dollar_rate || 120)
    const usdAmount = (pkg.price / rate).toFixed(2)

    if (parseFloat(usdAmount) <= 0) return res.status(400).json({ error: 'Invalid amount' })

    // 3. Create Payment (Encode packageId in orderId)
    // Custom logic to include packageId in createPayment if needed, 
    // or just rely on the orderId we pass to createPayment if the service allows overriding orderId.
    // However, oxapayService.js generates its own orderId. 
    // Let's modify the createPayment call or service to accept orderId or just store it in DB.
    // Since we can't easily change service without reading it, we'll try to use the `description` field or just rely on DB persistence.
    // Actually, createPayment in service generates `TRX-${Date.now()}-${userId}`. 
    // We should probably UPDATE the service to accept a custom OrderID or modify it here if we could.
    // But since I can't see service code right now (I saw it earlier), let's assume I can't change it easily without re-reading.
    // Wait, I saw oxapayService.js earlier. It hardcodes orderId. 
    // I will modify oxapayService.js to accept custom orderId or just append packageId.
    
    // For now, let's call a modified createPayment that accepts packageId.
    // I will update oxapayService.js in next step.
    const result = await createPayment(parseFloat(usdAmount), userId, packageId)

    // Create pending transaction
    await prisma.transaction.create({
      data: {
        userId: userId,
        amount: parseFloat(usdAmount),
        currency: 'USD',
        type: 'DEPOSIT',
        provider: 'oxapay',
        transactionId: result.trackId.toString(),
        status: 'PENDING',
        details: JSON.stringify({ orderId: result.orderId, packageId: pkg.id, diamondAmount: pkg.diamondAmount })
      }
    })

    res.json({ payLink: result.payLink })
  } catch (error) {
    console.error('Initiate Payment Error:', error)
    res.status(500).json({ error: 'Failed to initiate payment' })
  }
}

const handleOxapayWebhook = async (req, res) => {
  try {
    // Log webhook body for debugging
    console.log('OxaPay Webhook:', req.body)

    const { orderId, status, amount, payCurrency, txID } = req.body

    // 1. Extract User ID and Package ID
    if (!orderId) {
        console.warn('Missing orderId in webhook')
        return res.status(400).json({ error: 'Missing orderId' })
    }
    
    // Format: TRX-[Timestamp]-[UserId]-[PackageId]
    const parts = orderId.split('-')
    const userId = parseInt(parts[2]) // Index 2 is UserId
    const packageId = parseInt(parts[3]) // Index 3 is PackageId

    if (isNaN(userId)) {
        console.error(`Failed to extract userId from orderId: ${orderId}`)
        return res.status(400).json({ error: 'Invalid userId in orderId' })
    }

    // 2. Verify Payment
    if (status === 'Paid') {
       // Check for existing transaction
       const existingTx = await prisma.transaction.findFirst({
           where: { 
               OR: [
                   { transactionId: txID }, // Match by Blockchain TXID
                   { details: { contains: orderId } } // Match by OrderID (from pending init)
               ]
           }
       })

       // If transaction exists and is already COMPLETED, skip
       if (existingTx && existingTx.status === 'COMPLETED') {
           console.log(`Transaction ${txID} or Order ${orderId} already processed (COMPLETED). Skipping.`)
           return res.json({ success: true })
       }

       const amountVal = parseFloat(amount)
       
       let diamondAmount = 0
       let packageName = 'Custom TopUp'
       let priceTk = 0

       // Fetch Package if packageId exists
       if (!isNaN(packageId)) {
           const pkg = await prisma.topUpPackage.findUnique({ where: { id: packageId } })
           if (pkg) {
               diamondAmount = pkg.diamondAmount
               packageName = pkg.name
               priceTk = pkg.price
           }
       }

       // 3. Update Balance (Increment DIAMOND)
       if (diamondAmount > 0) {
           await prisma.user.update({
             where: { id: userId },
             data: { diamond: { increment: diamondAmount } }
           })
       } else {
           // Fallback: If no package ID, maybe credit USD (or handle as error?)
           // For now, we assume packageId is always present for this flow.
           console.warn(`No package found for ID ${packageId}, crediting DK instead.`)
           await prisma.user.update({
             where: { id: userId },
             data: { dk: { increment: amountVal } }
           })
       }

       // 4. Save/Update History (Transaction)
       if (existingTx && existingTx.status === 'PENDING') {
           // Update existing pending transaction
           await prisma.transaction.update({
               where: { id: existingTx.id },
               data: {
                   status: 'COMPLETED',
                   transactionId: txID || existingTx.transactionId, // Update with real TXID if available
                   details: JSON.stringify({ ...req.body, packageId, diamondAmount })
               }
           })
       } else {
           // Create new transaction if none exists
           try {
               await prisma.transaction.create({
                 data: {
                    user: { connect: { id: userId } },
                    amount: amountVal,
                    currency: 'USD',
                    type: 'DEPOSIT', // Or TOPUP
                    status: 'COMPLETED',
                    transactionId: txID || `Unknown-${Date.now()}`,
                    provider: `Oxapay - ${payCurrency || 'Unknown'}`,
                    details: JSON.stringify({ ...req.body, packageId, diamondAmount })
                 }
               })
           } catch (e) {
               console.error('Transaction creation failed (likely duplicate):', e.message)
           }
       }

       // 5. Create TopUpRequest (For Admin Panel History)
       // Find the Crypto / Binance wallet
       const wallet = await prisma.topUpWallet.findFirst({
           where: { 
               name: 'Crypto / Binance'
           }
       })
       
       // Fallback to ID 1 if not found, but we expect it to exist now
       const walletId = wallet ? wallet.id : 1 

       // Check if TopUpRequest exists by TRX ID
       const existingReq = await prisma.topUpRequest.findUnique({ where: { trxId: txID || `TRX-${Date.now()}` } })
       
       if (!existingReq) {
           await prisma.topUpRequest.create({
               data: {
                   userId: userId,
                   packageId: !isNaN(packageId) ? packageId : 1, // Fallback if missing
                   walletId: walletId,
                   senderNumber: 'Automatic Payment', // Explicitly set for history display
                   trxId: txID || `TRX-${Date.now()}`,
                   // screenshot: 'AUTO_PAYMENT', // Removed because it is not in the schema
                   status: 'COMPLETED',
                   processedAt: new Date()
               }
           })
       }

       // 6. Log Success
       console.log(`Top Up Successful for User ${userId}: ${diamondAmount} Diamonds`)

       // Send Notification
       await prisma.notification.create({
         data: {
           userId: userId,
           message: `Top Up Successful! ${diamondAmount} Diamonds added to your account.`,
           type: 'credit'
         }
       })
    } else {
        console.log(`Payment status is ${status}, skipping balance update.`)
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Webhook Error:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
}

module.exports = { initiateOxapayPayment, handleOxapayWebhook }
