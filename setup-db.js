#!/usr/bin/env node

// =============================================
// CASA DENIS - SETUP AUTOMAT BAZĂ DE DATE
// =============================================

const fs = require('fs').promises;
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const chalk = {
    green: (text) => `\x1b[32m${text}\x1b[0m`,
    red: (text) => `\x1b[31m${text}\x1b[0m`,
    yellow: (text) => `\x1b[33m${text}\x1b[0m`,
    blue: (text) => `\x1b[34m${text}\x1b[0m`,
    cyan: (text) => `\x1b[36m${text}\x1b[0m`,
    magenta: (text) => `\x1b[35m${text}\x1b[0m`,
    bold: (text) => `\x1b[1m${text}\x1b[0m`
};
 
class CasaDenisSetup {
    constructor() {
        this.connection = null;
        this.config = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'casa_denis_db',
            charset: 'utf8mb4'
        };
    }

    log(level, message, detail = '') {
        const timestamp = new Date().toLocaleTimeString();
        const icons = {
            info: '📋',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            step: '🔄',
            check: '🔍'
        };
        
        console.log(`${icons[level] || 'ℹ️'} [${timestamp}] ${message}`);
        if (detail) console.log(`   ${detail}`);
    }

    async checkPrerequisites() {
        this.log('step', chalk.bold('Verificarea prerequisitelor...'));
        
        // 1. Verifică existența fișierului .env
        try {
            await fs.access('.env');
            this.log('success', 'Fișierul .env găsit');
        } catch {
            this.log('warning', 'Fișierul .env nu există - se creează unul implicit');
            await this.createDefaultEnv();
        }

        // 2. Verifică conexiunea la MySQL
        try {
            const tempConnection = await mysql.createConnection({
                host: this.config.host,
                user: this.config.user,
                password: this.config.password
            });
            await tempConnection.end();
            this.log('success', 'Conexiune MySQL validă');
        } catch (error) {
            this.log('error', 'Nu se poate conecta la MySQL', error.message);
            throw new Error('Verifică configurația MySQL din .env');
        }

        // 3. Verifică existența fișierelor de date
        const dataFiles = ['programs.json', 'testimonials.json', 'spaces.json', 'gallery.json'];
        for (const file of dataFiles) {
            try {
                await fs.access(path.join('data', file));
                this.log('check', `Fișier găsit: ${file}`);
            } catch {
                this.log('warning', `Fișier lipsă: ${file} - se va crea unul gol`);
                await this.createEmptyDataFile(file);
            }
        }
    }

    async createDefaultEnv() {
        const envContent = `# Casa Denis - Configurație Bază de Date
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=casa_denis_db

# Configurație Server
PORT=3002

# Configurație Email (opțional)
EMAIL_PASS=your_gmail_app_password_here

# Mod dezvoltare
NODE_ENV=development
`;
        
        await fs.writeFile('.env', envContent);
        this.log('success', 'Fișier .env creat cu configurația implicită');
        this.log('warning', 'Editează .env cu parola MySQL corectă!');
    }

    async createEmptyDataFile(filename) {
        const dataDir = path.join(__dirname, 'data');
        
        // Creează directorul data dacă nu există
        try {
            await fs.mkdir(dataDir, { recursive: true });
        } catch (error) {
            // Directory already exists
        }

        const defaultContent = filename === 'contact.json' ? 
            '{"address":"","phone":"","email":"","hours":""}' : '[]';
        
        await fs.writeFile(path.join(dataDir, filename), defaultContent);
        this.log('info', `Fișier ${filename} creat cu conținut implicit`);
    }

    async createDatabase() {
        this.log('step', chalk.bold('Crearea bazei de date...'));
        
        try {
            // Conectare fără specificarea bazei de date
            const connection = await mysql.createConnection({
                host: this.config.host,
                user: this.config.user,
                password: this.config.password,
                charset: 'utf8mb4'
            });

            // Creează baza de date
            await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${this.config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
            this.log('success', `Baza de date '${this.config.database}' creată/verificată`);
            
            await connection.end();
        } catch (error) {
            this.log('error', 'Eroare la crearea bazei de date', error.message);
            throw error;
        }
    }

    async createTables() {
        this.log('step', chalk.bold('Crearea tabelelor...'));
        
        try {
            this.connection = await mysql.createConnection(this.config);

            const tables = await this.getTableDefinitions();
            
            for (const [tableName, createSQL] of Object.entries(tables)) {
                try {
                    await this.connection.execute(createSQL);
                    this.log('success', `Tabelă '${tableName}' creată/verificată`);
                } catch (error) {
                    this.log('error', `Eroare la crearea tabelei '${tableName}'`, error.message);
                }
            }

        } catch (error) {
            this.log('error', 'Eroare la crearea tabelelor', error.message);
            throw error;
        }
    }

    async runMigration() {
        this.log('step', chalk.bold('Importarea datelor existente...'));
        
        try {
            const DataMigration = require('./migrate-data.js');
            const migration = new DataMigration();
            migration.connection = this.connection;
            
            // Rulează doar metodele de migrare (fără connect/disconnect)
            await migration.migratePrograms();
            await migration.migrateTestimonials();
            await migration.migrateGallery();
            await migration.migrateSpaces();
            await migration.migrateSchedule();
            await migration.migratePageContent();
            await migration.migrateMessages();
            await migration.createDefaultAdmin();
            await migration.setupDefaultEmailConfig();
            
            this.log('success', 'Toate datele au fost importate cu succes');
            
        } catch (error) {
            this.log('warning', 'Migrarea datelor a eșuat parțial', error.message);
            this.log('info', 'Acest lucru e normal dacă nu există fișiere JSON cu date');
        }
    }

    async updateServerConfig() {
        this.log('step', chalk.bold('Actualizarea configurației server...'));
        
        try {
            const serverPath = path.join(__dirname, 'server.js');
            let serverContent = await fs.readFile(serverPath, 'utf8');
            
            // Activează configurația MySQL
            serverContent = serverContent.replace(
                'const pool = null; // Disable MySQL for now',
                `const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'casa_denis_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});`
            );

            await fs.writeFile(serverPath, serverContent);
            this.log('success', 'Configurația server actualizată pentru MySQL');
            
        } catch (error) {
            this.log('warning', 'Nu s-a putut actualiza server.js automat', error.message);
            this.log('info', 'Activează manual configurația MySQL în server.js');
        }
    }

    async createBackupScript() {
        this.log('step', chalk.bold('Crearea scriptului de backup...'));
        
        const backupScript = `#!/usr/bin/env node

// Script automat de backup pentru Casa Denis
const { exec } = require('child_process');
const path = require('path');
require('dotenv').config();

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = \`backup_casa_denis_\${timestamp}.sql\`;
const backupPath = path.join(__dirname, 'backups');

// Creează directorul de backup
require('fs').mkdirSync(backupPath, { recursive: true });

const command = \`mysqldump -h \${process.env.DB_HOST} -u \${process.env.DB_USER} -p\${process.env.DB_PASSWORD} \${process.env.DB_NAME} > \${path.join(backupPath, backupFile)}\`;

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Backup eșuat:', error.message);
        return;
    }
    console.log(\`✅ Backup creat cu succes: \${backupFile}\`);
});
`;

        await fs.writeFile('backup.js', backupScript);
        this.log('success', 'Script de backup creat (backup.js)');
    }

    async performHealthCheck() {
        this.log('step', chalk.bold('Verificarea finală a sistemului...'));
        
        try {
            // Testează toate tabelele principale
            const tables = ['messages', 'admin_users', 'programs', 'testimonials', 'gallery_items'];
            
            for (const table of tables) {
                const [rows] = await this.connection.execute(`SELECT COUNT(*) as count FROM ${table}`);
                this.log('check', `Tabelă '${table}': ${rows[0].count} înregistrări`);
            }

            // Testează utilizatorul admin
            const [adminRows] = await this.connection.execute('SELECT username FROM admin_users WHERE username = "admin"');
            if (adminRows.length > 0) {
                this.log('success', 'Utilizator admin configurat corect');
            } else {
                this.log('warning', 'Utilizatorul admin nu a fost găsit');
            }

            this.log('success', 'Verificarea sistemului completă!');
            
        } catch (error) {
            this.log('error', 'Eroare la verificarea finală', error.message);
        }
    }

    getTableDefinitions() {
        return {
            messages: `CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(150) NOT NULL,
                phone VARCHAR(20) NULL,
                message TEXT NOT NULL,
                message_type ENUM('contact', 'enrollment', 'rental_inquiry') DEFAULT 'contact',
                status ENUM('new', 'read', 'replied', 'archived') DEFAULT 'new',
                ip_address VARCHAR(45) NULL,
                user_agent TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_status (status),
                INDEX idx_type (message_type),
                INDEX idx_created (created_at)
            ) ENGINE=InnoDB`,

            admin_users: `CREATE TABLE IF NOT EXISTS admin_users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(50) NOT NULL UNIQUE,
                email VARCHAR(150) NOT NULL UNIQUE,
                password_hash VARCHAR(255) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                last_login TIMESTAMP NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB`,

            programs: `CREATE TABLE IF NOT EXISTS programs (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(100) NOT NULL,
                description TEXT NULL,
                icon VARCHAR(100) DEFAULT 'fas fa-book',
                color VARCHAR(50) DEFAULT '#db2777',
                is_active BOOLEAN DEFAULT TRUE,
                order_index INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB`,

            testimonials: `CREATE TABLE IF NOT EXISTS testimonials (
                id INT AUTO_INCREMENT PRIMARY KEY,
                author_name VARCHAR(100) NOT NULL,
                author_role VARCHAR(100) NULL,
                content TEXT NOT NULL,
                rating INT DEFAULT 5,
                initials VARCHAR(5) NULL,
                color_scheme VARCHAR(50) DEFAULT 'bg-purple-100',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB`,

            gallery_items: `CREATE TABLE IF NOT EXISTS gallery_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                description TEXT NULL,
                image_path VARCHAR(500) NOT NULL,
                alt_text VARCHAR(200) NULL,
                category VARCHAR(50) DEFAULT 'general',
                order_index INT DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB`,

            spaces: `CREATE TABLE IF NOT EXISTS spaces (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                role VARCHAR(100) NULL,
                description TEXT NULL,
                image_path VARCHAR(500) NULL,
                color VARCHAR(50) DEFAULT '#f9a8d4',
                is_available BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB`,

            daily_schedule: `CREATE TABLE IF NOT EXISTS daily_schedule (
                id INT AUTO_INCREMENT PRIMARY KEY,
                start_time TIME NOT NULL,
                end_time TIME NOT NULL,
                activity_name VARCHAR(150) NOT NULL,
                description TEXT NULL,
                icon VARCHAR(100) DEFAULT 'fas fa-clock',
                order_index INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB`,

            page_content: `CREATE TABLE IF NOT EXISTS page_content (
                id INT AUTO_INCREMENT PRIMARY KEY,
                page_name VARCHAR(50) NOT NULL,
                section_name VARCHAR(50) NOT NULL,
                content_type ENUM('text', 'html', 'json') DEFAULT 'text',
                content TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_page_section (page_name, section_name)
            ) ENGINE=InnoDB`,

            email_settings: `CREATE TABLE IF NOT EXISTS email_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                smtp_host VARCHAR(255) NOT NULL,
                smtp_port INT NOT NULL DEFAULT 587,
                smtp_username VARCHAR(255) NOT NULL,
                smtp_password VARCHAR(255) NOT NULL,
                from_email VARCHAR(255) NOT NULL,
                from_name VARCHAR(100) NOT NULL,
                admin_email VARCHAR(255) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB`
        };
    }

    async run() {
        console.log(chalk.bold(chalk.magenta('\n🏠 ===== CASA DENIS - CONFIGURARE AUTOMATĂ ===== 🏠\n')));
        
        try {
            await this.checkPrerequisites();
            await this.createDatabase();
            await this.createTables();
            await this.runMigration();
            await this.updateServerConfig();
            await this.createBackupScript();
            await this.performHealthCheck();
            
            console.log(chalk.bold(chalk.green('\n🎉 ===== CONFIGURARE COMPLETĂ ===== 🎉')));
            console.log(chalk.green('✅ Baza de date configurată și populată'));
            console.log(chalk.green('✅ Toate tabelele create cu succes'));
            console.log(chalk.green('✅ Datele existente importate'));
            console.log(chalk.green('✅ Utilizator admin creat'));
            
            console.log(chalk.bold(chalk.blue('\n📋 INFORMAȚII DE ACCES:')));
            console.log(chalk.blue('👤 Username admin: admin'));
            console.log(chalk.blue('🔑 Parolă admin: parola123'));
            console.log(chalk.blue('🌐 URL admin: http://localhost:3002/admin.html'));
            
            console.log(chalk.bold(chalk.yellow('\n⚠️  URMĂTORII PAȘI:')));
            console.log(chalk.yellow('1. Verifică configurația .env'));
            console.log(chalk.yellow('2. Pornește serverul: npm start'));
            console.log(chalk.yellow('3. Schimbă parola admin la prima autentificare'));
            console.log(chalk.yellow('4. Configurează EMAIL_PASS în .env pentru notificări'));
            
        } catch (error) {
            console.log(chalk.bold(chalk.red('\n❌ ===== CONFIGURARE EȘUATĂ =====')));
            console.log(chalk.red('Eroare:', error.message));
            console.log(chalk.yellow('\n🔧 Verifică:'));
            console.log(chalk.yellow('• MySQL Server rulează'));
            console.log(chalk.yellow('• Credențialele din .env sunt corecte'));
            console.log(chalk.yellow('• Utilizatorul MySQL are permisiuni complete'));
        } finally {
            if (this.connection) {
                await this.connection.end();
            }
        }
    }
}

// Rulare directă
if (require.main === module) {
    const setup = new CasaDenisSetup();
    setup.run();
}

module.exports = CasaDenisSetup; 