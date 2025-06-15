const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs').promises;

const dbConfig = process.env.DATABASE_URL
    ? (() => {
          const url = new URL(process.env.DATABASE_URL);
          return {
              host: url.hostname,
              user: url.username,
              password: url.password,
              database: url.pathname.slice(1),
              port: url.port || process.env.MYSQLPORT || 3306,
              charset: 'utf8mb4',
              waitForConnections: true,
              connectionLimit: 10,
              queueLimit: 0,
              ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
          };
      })()
    : {
          host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
          user: process.env.MYSQLUSER || process.env.DB_USER || 'root',
          password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
          database: process.env.MYSQLDATABASE || process.env.DB_NAME || 'casa_denis_db',
          port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
          charset: 'utf8mb4',
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
      };

console.log('Database Config:', {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    database: dbConfig.database,
    hasPassword: !!dbConfig.password
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
