const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs').promises;

// Railway provides these environment variables automatically
const dbConfig = (() => {
    // First try Railway's standard MySQL environment variables
    if (process.env.MYSQLHOST && process.env.MYSQLUSER && process.env.MYSQLPASSWORD && process.env.MYSQLDATABASE) {
        console.log('🔧 Using Railway MySQL environment variables');
        return {
            host: process.env.MYSQLHOST,
            user: process.env.MYSQLUSER,
            password: process.env.MYSQLPASSWORD,
            database: process.env.MYSQLDATABASE,
            port: parseInt(process.env.MYSQLPORT) || 3306,
            charset: 'utf8mb4',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            ssl: { rejectUnauthorized: false }
        };
    }
    
    // Then try DATABASE_URL format
    if (process.env.DATABASE_URL) {
        console.log('🔧 Using DATABASE_URL');
        const url = new URL(process.env.DATABASE_URL);
        return {
            host: url.hostname,
            user: url.username,
            password: url.password,
            database: url.pathname.slice(1),
            port: parseInt(url.port) || 3306,
            charset: 'utf8mb4',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            ssl: { rejectUnauthorized: false }
        };
    }
    
    // Fallback to individual environment variables or defaults
    console.log('🔧 Using individual DB environment variables');
    return {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'casa_denis_db',
        port: parseInt(process.env.DB_PORT) || 3306,
        charset: 'utf8mb4',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        ssl: false
    };
})();

console.log('Database Config:', {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    database: dbConfig.database,
    hasPassword: !!dbConfig.password,
    ssl: !!dbConfig.ssl
});

// Debug Railway environment variables
console.log('Railway Environment Check:', {
    MYSQLHOST: !!process.env.MYSQLHOST,
    MYSQLUSER: !!process.env.MYSQLUSER,
    MYSQLPASSWORD: !!process.env.MYSQLPASSWORD,
    MYSQLDATABASE: !!process.env.MYSQLDATABASE,
    MYSQLPORT: process.env.MYSQLPORT,
    DATABASE_URL: !!process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV
});

const pool = mysql.createPool(dbConfig);

async function setupDatabase() {
    try {
        const [rows] = await pool.execute('SELECT 1 as test');
        console.log('✅ MySQL database connected successfully');
        // Verify all tables from setup-db.js exist
        const tables = [
            'messages',
            'admin_users',
            'programs',
            'testimonials',
            'gallery_items',
            'spaces',
            'daily_schedule',
            'page_content',
            'email_settings'
        ];
        for (const table of tables) {
            await pool.execute(`SELECT 1 FROM ${table} LIMIT 1`);
        }
        console.log('✅ Database tables verified');
    } catch (error) {
        console.error('❌ MySQL connection failed:', error);
        console.log('⚠️ Falling back to JSON files');
        const dataDir = path.join(__dirname, 'data');
        await fs.mkdir(dataDir, { recursive: true });
        const files = [
            'messages.json',
            'programs.json',
            'testimonials.json',
            'spaces.json',
            'gallery.json',
            'contact.json'
        ];
        for (const file of files) {
            const filePath = path.join(dataDir, file);
            try {
                await fs.access(filePath);
            } catch {
                const content = file === 'contact.json' ? '{"address":"","phone":"","email":"","hours":""}' : '[]';
                await fs.writeFile(filePath, content);
            }
        }
        console.log('✅ JSON file system ready');
    }
}

module.exports = { pool, setupDatabase };
