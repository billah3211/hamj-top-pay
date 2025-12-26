const { prisma } = require('../db/prisma')
const { createPayment } = require('../services/oxapayService')

const initiateOxapayPayment = async (req, res) => {
  try {
    const { amount } = req.body
    const userId = req.session.userId

    if (!userId) return res.status(401).json({ error: 'Unauthorized' })
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) return res.status(400).json({ error: 'Invalid amount' })

    const result = await createPayment(parseFloat(amount), userId)

    // Create pending transaction
    await prisma.transaction.create({
      data: {
        userId: userId,
        amount: parseFloat(amount),
        currency: 'USD',
        type: 'DEPOSIT',
        provider: 'oxapay',
        transactionId: result.trackId.toString(),
        status: 'PENDING',
        details: JSON.stringify({ orderId: result.orderId })
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

    // 1. Extract User ID
    if (!orderId) {
        console.warn('Missing orderId in webhook')
        return res.status(400).json({ error: 'Missing orderId' })
    }
    
    // Format: TRX-[Timestamp]-[UserId]
    const parts = orderId.split('-')
    const userId = parseInt(parts[parts.length - 1])

    if (isNaN(userId)) {
        console.error(`Failed to extract userId from orderId: ${orderId}`)
        return res.status(400).json({ error: 'Invalid userId in orderId' })
    }

    // 2. Verify Payment
    if (status === 'Paid') {
       const amountVal = parseFloat(amount)
       
       // 3. Update Balance (Increment DK/Dollar Balance)
       // Note: Using dk (Float) as amount is in USD/Float. 
       // If conversion to diamonds is needed, a rate must be applied. 
       // For now, we credit the USD amount to the user's balance.
       await prisma.user.update({
         where: { id: userId },
         data: { dk: { increment: amountVal } }
       })

       // 4. Save History (Create NEW Transaction)
       await prisma.transaction.create({
         data: {
            userId: userId,
            amount: amountVal,
            currency: 'USD', // Base currency is USD
            type: 'DEPOSIT',
            status: 'COMPLETED',
            method: `Oxapay - ${payCurrency || 'Unknown'}`,
            transactionId: txID || `Unknown-${Date.now()}`, // Use txID from webhook
            provider: 'oxapay',
            details: JSON.stringify(req.body)
         }
       })

       // 5. Log Success
       console.log(`Top Up Successful for User ${userId}`)

       // Send Notification
       await prisma.notification.create({
         data: {
           userId: userId,
           message: 'Top Up Successful',
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
