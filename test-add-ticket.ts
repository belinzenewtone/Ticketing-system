
import { addTicket } from './src/services/tickets'
import { PrismaClient } from '@prisma/client'

// Mock auth by overriding it if necessary, or just run it and see if it fails on session
// Since this is a standalone script, 'auth()' from next-auth might fail if not in a request context.
// But we can at least see if the rest of the logic (Prisma) works.

async function test() {
    try {
        console.log("Testing addTicket with dummy data...")
        const result = await addTicket({
            employee_name: "Test User",
            department: "IT",
            category: "software",
            priority: "medium",
            subject: "Test Ticket",
            description: "Testing the submission error",
            sentiment: "neutral",
            ticket_date: new Date().toISOString().split('T')[0]
        })
        console.log("Result:", JSON.stringify(result, null, 2))
    } catch (e) {
        console.error("Test failed:", e)
    }
}

test()
