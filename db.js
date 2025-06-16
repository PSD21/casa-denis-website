const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs').promises;

// Railway provides these environment variables automatically
const dbConfig = (() => {
    // First try Railway's MySQL environment variables (MYSQL prefix) - HIGHEST PRIORITY
    if (process.env.MYSQLHOST && process.env.MYSQLUSER && process.env.MYSQLPASSWORD) {
        console.log('🔧 Using Railway MySQL environment variables');
        
        // Clean up variables by removing all whitespace, newlines, and control characters
        const cleanHost = process.env.MYSQLHOST.replace(/[\r\n\t\s]/g, '').trim();
        const cleanUser = process.env.MYSQLUSER.replace(/[\r\n\t\s]/g, '').trim();
        const cleanPassword = process.env.MYSQLPASSWORD.replace(/[\r\n\t]/g, '').trim();
        const cleanDatabase = process.env.MYSQLDATABASE ? process.env.MYSQLDATABASE.replace(/[\r\n\t\s]/g, '').trim() : 'railway';
        
        console.log('🔍 Raw MySQL values - Host:', process.env.MYSQLHOST, 'User:', process.env.MYSQLUSER, 'DB:', process.env.MYSQLDATABASE);
        console.log('🧹 Cleaned MySQL values - Host:', cleanHost, 'User:', cleanUser, 'DB:', cleanDatabase);
        
        return {
            host: cleanHost,
            user: cleanUser,
            password: cleanPassword,
            database: cleanDatabase,
            port: parseInt(process.env.MYSQLPORT) || 3306,
            charset: 'utf8mb4',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            ssl: { rejectUnauthorized: false }
        };
    }
    
    // Then try DATABASE_URL format (Railway's preferred method)
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('mysql://')) {
        console.log('🔧 Using DATABASE_URL');
        try {
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
        } catch (error) {
            console.log('⚠️ Invalid DATABASE_URL format, trying individual variables');
        }
    }
    
    // Try Railway's DB environment variables (DB_ prefix) - FALLBACK
    if (process.env.DB_HOST && process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_NAME) {
        console.log('🔧 Using Railway DB environment variables');
        console.log('🔍 Raw DB values - Host:', process.env.DB_HOST, 'User:', process.env.DB_USER, 'DB:', process.env.DB_NAME);
        return {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            port: parseInt(process.env.DB_PORT) || 3306,
            charset: 'utf8mb4',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            ssl: { rejectUnauthorized: false }
        };
    }
    
    // Fallback to localhost for development
    console.log('🔧 Using localhost fallback (development mode)');
    return {
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'casa_denis_db',
        port: 3306,
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
    DATABASE_URL: !!process.env.DATABASE_URL,
    DB_HOST: !!process.env.DB_HOST,
    DB_USER: !!process.env.DB_USER,
    DB_PASSWORD: !!process.env.DB_PASSWORD,
    DB_NAME: !!process.env.DB_NAME,
    DB_PORT: process.env.DB_PORT,
    MYSQLHOST: !!process.env.MYSQLHOST,
    MYSQLUSER: !!process.env.MYSQLUSER,
    NODE_ENV: process.env.NODE_ENV
});

// Debug actual values (first few characters only for security)
console.log('Variable Values Check:', {
    MYSQLHOST_length: process.env.MYSQLHOST ? process.env.MYSQLHOST.length : 0,
    MYSQLUSER_length: process.env.MYSQLUSER ? process.env.MYSQLUSER.length : 0,
    MYSQLDATABASE_length: process.env.MYSQLDATABASE ? process.env.MYSQLDATABASE.length : 0,
    MYSQLHOST_starts: process.env.MYSQLHOST ? process.env.MYSQLHOST.substring(0, 15) + '...' : 'undefined',
    DB_HOST_length: process.env.DB_HOST ? process.env.DB_HOST.length : 0,
    DB_HOST_starts: process.env.DB_HOST ? process.env.DB_HOST.substring(0, 10) + '...' : 'undefined'
});

// Show actual values (safely) for debugging
if (process.env.DB_HOST) {
    console.log('🔍 DB Host:', process.env.DB_HOST);
    console.log('🔍 DB Port:', process.env.DB_PORT || '3306');
    console.log('🔍 DB Database:', process.env.DB_NAME);
    console.log('🔍 DB User:', process.env.DB_USER);
} else if (process.env.MYSQLHOST) {
    console.log('🔍 MySQL Host:', process.env.MYSQLHOST);
    console.log('🔍 MySQL Port:', process.env.MYSQLPORT);
    console.log('🔍 MySQL Database:', process.env.MYSQLDATABASE);
    console.log('🔍 MySQL User:', process.env.MYSQLUSER);
} else if (process.env.DATABASE_URL) {
    try {
        const url = new URL(process.env.DATABASE_URL);
        console.log('🔍 Database URL Host:', url.hostname);
        console.log('🔍 Database URL Port:', url.port);
        console.log('🔍 Database URL Database:', url.pathname.slice(1));
    } catch (error) {
        console.log('⚠️ Invalid DATABASE_URL format');
    }
} else {
    console.log('❌ NO RAILWAY MYSQL VARIABLES FOUND!');
    console.log('Available env vars:', Object.keys(process.env).filter(key => 
        key.includes('MYSQL') || key.includes('DATABASE') || key.includes('DB_')
    ));
}

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
