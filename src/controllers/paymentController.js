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
        try {
            await prisma.$transaction(async (tx) => {
                // A. Strict Check: Is this TXID already processed?
                // This prevents "Unique constraint failed" if a completed transaction already exists.
                const existingCompleted = await tx.transaction.findUnique({
                    where: { transactionId: txID }
                })

                if (existingCompleted && existingCompleted.status === 'COMPLETED') {
                    console.log(`Transaction ${txID} already COMPLETED. Ignoring.`)
                    return // Treated as success
                }

                // B. Find Pending Transaction by OrderID (if not found by TXID)
                const pendingTx = await tx.transaction.findFirst({
                    where: { 
                        details: { contains: orderId },
                        status: 'PENDING'
                    }
                })

                // C. Prepare Data
                const amountVal = parseFloat(amount)
                let diamondAmount = 0
                let packageName = 'Custom TopUp'
                let priceTk = 0

                if (!isNaN(packageId)) {
                    const pkg = await tx.topUpPackage.findUnique({ where: { id: parseInt(packageId) } })
                    if (pkg) {
                        diamondAmount = pkg.diamondAmount
                        packageName = pkg.name
                        priceTk = pkg.price
                    }
                }

                // D. Update Balance (Increment)
                if (diamondAmount > 0) {
                    await tx.user.update({
                        where: { id: userId },
                        data: { diamond: { increment: diamondAmount } }
                    })
                } else {
                    await tx.user.update({
                        where: { id: userId },
                        data: { dk: { increment: amountVal } }
                    })
                }

                // E. Update or Create Transaction
                if (pendingTx) {
                    // Update existing pending transaction
                    // We must ensure 'transactionId' doesn't conflict. 
                    // Since we checked findUnique(txID) above, conflict is unlikely unless race condition.
                    await tx.transaction.update({
                        where: { id: pendingTx.id },
                        data: {
                            status: 'COMPLETED',
                            transactionId: txID, // Update with real TXID
                            details: JSON.stringify({ ...req.body, packageId, diamondAmount })
                        }
                    })
                } else {
                    // Create new transaction
                    await tx.transaction.create({
                        data: {
                            user: { connect: { id: userId } },
                            amount: amountVal,
                            currency: 'USD',
                            type: 'DEPOSIT',
                            status: 'COMPLETED',
                            transactionId: txID,
                            provider: `Oxapay - ${payCurrency || 'Unknown'}`,
                            details: JSON.stringify({ ...req.body, packageId, diamondAmount })
                        }
                    })
                }

                // F. Create TopUpRequest (For Admin/User History)
                // Find Wallet
                const wallet = await tx.topUpWallet.findFirst({
                    where: { 
                        OR: [
                            { name: { contains: 'Binance', mode: 'insensitive' } },
                            { name: { contains: 'Crypto', mode: 'insensitive' } }
                        ]
                    }
                })
                const walletId = wallet ? wallet.id : 1 

                // Check strict uniqueness for TopUpRequest too (using trxId)
                const existingReq = await tx.topUpRequest.findUnique({ where: { trxId: txID } })
                
                if (!existingReq) {
                    await tx.topUpRequest.create({
                        data: {
                            userId: userId,
                            packageId: !isNaN(packageId) ? parseInt(packageId) : 1,
                            walletId: walletId,
                            senderNumber: `Oxapay-${payCurrency}`,
                            trxId: txID,
                            screenshot: 'AUTO_PAYMENT',
                            status: 'COMPLETED',
                            processedAt: new Date()
                        }
                    })
                }

                // G. Send Notification
                await tx.notification.create({
                    data: {
                        userId: userId,
                        message: `Top Up Successful! ${diamondAmount} Diamonds added to your account.`,
                        type: 'credit'
                    }
                })
            })

            return res.json({ success: true })

        } catch (error) {
            console.error('Webhook Processing Failed:', error)
            // If uniqueness error occurs despite checks, it implies race condition.
            // Returning 500 triggers retry, which should hit "Already COMPLETED" check next time.
            return res.status(500).json({ error: 'Internal processing error' })
        }
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
