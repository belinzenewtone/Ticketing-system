
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const pg = require('pg')
const bcrypt = require('bcryptjs')

async function createAdmin() {
    const connectionString = "postgres://47680ad642e884f40ff18cf9ffa0d5ec5d8c01d56b9ed7cc23aadba86acb3626:sk_bXJLgsQgUaCKd7gWpO7_c@db.prisma.io:5432/postgres?sslmode=require"
    const pool = new pg.Pool({ connectionString })
    const adapter = new PrismaPg(pool)
    const prisma = new PrismaClient({ adapter })

    try {
        const email = 'admin@jtl.co.ke'
        const password = 'AdminPassword123!'
        const hashedPassword = await bcrypt.hash(password, 10)

        console.log(`Creating/Updating admin user: ${email}...`)

        // Use upsert to create or update
        const user = await prisma.user.upsert({
            where: { email },
            update: {
                password: hashedPassword,
                role: 'ADMIN',
                name: 'System Admin'
            },
            create: {
                email,
                password: hashedPassword,
                role: 'ADMIN',
                name: 'System Admin'
            }
        })

        console.log('Admin user created/updated successfully:', user.id)
        console.log('Email:', email)
        console.log('Password:', password)
    } catch (e) {
        console.error('Failed to create admin:', e)
    } finally {
        await prisma.$disconnect()
        await pool.end()
    }
}

createAdmin()
