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

    const { trackId, status, amount } = req.body
    
    if (!trackId) return res.status(400).json({ error: 'Missing trackId' })

    const transaction = await prisma.transaction.findUnique({
      where: { transactionId: trackId.toString() }
    })

    if (!transaction) {
        console.warn(`Transaction not found for trackId: ${trackId}`)
        return res.status(404).json({ error: 'Transaction not found' })
    }

    if (transaction.status === 'COMPLETED') {
        return res.json({ message: 'Already processed' })
    }

    // User instruction: If status === 'Paid'
    if (status === 'Paid') { 
       // Update Transaction
       await prisma.transaction.update({
         where: { id: transaction.id },
         data: { status: 'COMPLETED' }
       })

       // Update User Balance (dk = Dollar Balance)
       await prisma.user.update({
         where: { id: transaction.userId },
         data: { dk: { increment: parseFloat(amount) } }
       })

       // Send Notification
       await prisma.notification.create({
         data: {
           userId: transaction.userId,
           message: `Deposit of $${amount} via OxaPay successful.`,
           type: 'credit'
         }
       })
    } else if (status === 'Expired' || status === 'Failed') {
        await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: 'FAILED' }
        })
    } else {
        // Update other statuses like "Waiting", "Confirming"
        await prisma.transaction.update({
            where: { id: transaction.id },
            data: { status: status.toUpperCase() }
        })
    }

    res.json({ success: true })
  } catch (error) {
    console.error('Webhook Error:', error)
    res.status(500).json({ error: 'Webhook processing failed' })
  }
}

module.exports = { initiateOxapayPayment, handleOxapayWebhook }
