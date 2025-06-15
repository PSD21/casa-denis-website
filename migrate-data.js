// =============================================
// CASA DENIS - SCRIPT MIGRARE DATE JSON LA MYSQL
// =============================================

const fs = require('fs').promises;
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();
 
// Configurare conexiune bază de date
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'casa_denis_db',
    charset: 'utf8mb4'
};

// Helper pentru citirea fișierelor JSON
async function readJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.warn(`⚠️ Fișierul ${filePath} nu există sau este invalid:`, error.message);
        return null;
    }
}

// Helper pentru logging cu culori
const log = {
    info: (msg) => console.log(`ℹ️ ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    warning: (msg) => console.log(`⚠️ ${msg}`),
    error: (msg) => console.log(`❌ ${msg}`),
    step: (msg) => console.log(`\n🔄 ${msg}`)
};

class DataMigration {
    constructor() {
        this.connection = null;
        this.migrationStats = {
            programs: 0,
            testimonials: 0,
            gallery: 0,
            spaces: 0,
            schedule: 0,
            pageContent: 0,
            messages: 0
        };
    }

    async connect() {
        try {
            this.connection = await mysql.createConnection(dbConfig);
            log.success('Conexiune la baza de date stabilită');
        } catch (error) {
            log.error('Eroare la conectarea la baza de date:', error.message);
            throw error;
        }
    }

    async disconnect() {
        if (this.connection) {
            await this.connection.end();
            log.info('Conexiune închisă');
        }
    }

    // 1. Migrare programe din programs.json
    async migratePrograms() {
        log.step('Migrarea programelor...');
        
        const programs = await readJsonFile(path.join(__dirname, 'data', 'programs.json'));
        if (!programs || !Array.isArray(programs)) {
            log.warning('Nu s-au găsit programe pentru migrare');
            return;
        }

        for (const program of programs) {
            try {
                await this.connection.execute(
                    `INSERT INTO programs (title, description, icon, color, order_index) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        program.title || 'Program fără titlu',
                        program.description || '',
                        program.icon || 'fas fa-book',
                        this.extractColor(program.color) || '#db2777',
                        parseInt(program.id) || 0
                    ]
                );
                this.migrationStats.programs++;
            } catch (error) {
                log.error(`Eroare la migrarea programului "${program.title}":`, error.message);
            }
        }
        
        log.success(`${this.migrationStats.programs} programe migrate cu succes`);
    }

    // 2. Migrare testimoniale din testimonials.json
    async migrateTestimonials() {
        log.step('Migrarea testimonialelor...');
        
        const testimonials = await readJsonFile(path.join(__dirname, 'data', 'testimonials.json'));
        if (!testimonials || !Array.isArray(testimonials)) {
            log.warning('Nu s-au găsit testimoniale pentru migrare');
            return;
        }

        for (const testimonial of testimonials) {
            try {
                await this.connection.execute(
                    `INSERT INTO testimonials (author_name, author_role, content, initials, color_scheme) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        testimonial.name || 'Anonim',
                        testimonial.role || '',
                        testimonial.text || '',
                        testimonial.initials || testimonial.name?.substring(0, 2) || 'AN',
                        testimonial.color || 'bg-purple-100'
                    ]
                );
                this.migrationStats.testimonials++;
            } catch (error) {
                log.error(`Eroare la migrarea testimonialului de la "${testimonial.name}":`, error.message);
            }
        }
        
        log.success(`${this.migrationStats.testimonials} testimoniale migrate cu succes`);
    }

    // 3. Migrare galerie din gallery.json
    async migrateGallery() {
        log.step('Migrarea galeriei...');
        
        const gallery = await readJsonFile(path.join(__dirname, 'data', 'gallery.json'));
        if (!gallery || !Array.isArray(gallery)) {
            log.warning('Nu s-au găsit imagini pentru migrare');
            return;
        }

        for (let i = 0; i < gallery.length; i++) {
            const image = gallery[i];
            try {
                await this.connection.execute(
                    `INSERT INTO gallery_items (title, description, image_path, alt_text, category, order_index) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        image.alt || `Imagine ${i + 1}`,
                        image.description || image.alt || '',
                        image.src || '',
                        image.alt || '',
                        image.category || 'general',
                        i + 1
                    ]
                );
                this.migrationStats.gallery++;
            } catch (error) {
                log.error(`Eroare la migrarea imaginii ${i + 1}:`, error.message);
            }
        }
        
        log.success(`${this.migrationStats.gallery} imagini migrate cu succes`);
    }

    // 4. Migrare spații din spaces.json
    async migrateSpaces() {
        log.step('Migrarea spațiilor...');
        
        const spaces = await readJsonFile(path.join(__dirname, 'data', 'spaces.json'));
        if (!spaces || !Array.isArray(spaces)) {
            log.warning('Nu s-au găsit spații pentru migrare');
            return;
        }

        for (const space of spaces) {
            try {
                await this.connection.execute(
                    `INSERT INTO spaces (name, role, description, image_path, color) 
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        space.name || 'Spațiu fără nume',
                        space.role || '',
                        space.description || '',
                        space.image || '',
                        this.extractColor(space.color) || '#f9a8d4'
                    ]
                );
                this.migrationStats.spaces++;
            } catch (error) {
                log.error(`Eroare la migrarea spațiului "${space.name}":`, error.message);
            }
        }
        
        log.success(`${this.migrationStats.spaces} spații migrate cu succes`);
    }

    // 5. Migrare program zilnic din schedule.json
    async migrateSchedule() {
        log.step('Migrarea programului zilnic...');
        
        const schedule = await readJsonFile(path.join(__dirname, 'data', 'schedule.json'));
        if (!schedule || !Array.isArray(schedule)) {
            log.warning('Nu s-a găsit programul zilnic pentru migrare');
            return;
        }

        for (let i = 0; i < schedule.length; i++) {
            const activity = schedule[i];
            try {
                const timeRange = activity.time || activity.activity || '';
                const [startTime, endTime] = this.parseTimeRange(timeRange);
                
                await this.connection.execute(
                    `INSERT INTO daily_schedule (start_time, end_time, activity_name, description, icon, order_index) 
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        startTime,
                        endTime,
                        activity.activity || activity.description || 'Activitate',
                        activity.description || activity.activity || '',
                        activity.icon || 'fas fa-clock',
                        i + 1
                    ]
                );
                this.migrationStats.schedule++;
            } catch (error) {
                log.error(`Eroare la migrarea activității ${i + 1}:`, error.message);
            }
        }
        
        log.success(`${this.migrationStats.schedule} activități migrate cu succes`);
    }

    // 6. Migrare conținut pagini (hero, about, contact)
    async migratePageContent() {
        log.step('Migrarea conținutului paginilor...');

        const pages = [
            { file: 'hero.json', page: 'home', section: 'hero' },
            { file: 'about.json', page: 'about', section: 'main' },
            { file: 'contact.json', page: 'contact', section: 'info' }
        ];

        for (const pageInfo of pages) {
            try {
                const content = await readJsonFile(path.join(__dirname, 'data', pageInfo.file));
                if (content) {
                    await this.connection.execute(
                        `INSERT INTO page_content (page_name, section_name, content_type, content) 
                         VALUES (?, ?, ?, ?)`,
                        [
                            pageInfo.page,
                            pageInfo.section,
                            'json',
                            JSON.stringify(content)
                        ]
                    );
                    this.migrationStats.pageContent++;
                }
            } catch (error) {
                log.error(`Eroare la migrarea conținutului ${pageInfo.file}:`, error.message);
            }
        }
        
        log.success(`${this.migrationStats.pageContent} pagini migrate cu succes`);
    }

    // 7. Migrare mesaje existente (dacă există)
    async migrateMessages() {
        log.step('Migrarea mesajelor existente...');
        
        const messages = await readJsonFile(path.join(__dirname, 'data', 'contact-messages.json'));
        if (!messages || !Array.isArray(messages)) {
            log.warning('Nu s-au găsit mesaje pentru migrare');
            return;
        }

        for (const message of messages) {
            try {
                await this.connection.execute(
                    `INSERT INTO messages (name, email, phone, message, message_type, status, created_at) 
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [
                        message.name || 'Anonim',
                        message.email || '',
                        message.phone || null,
                        message.message || '',
                        message.message_type || 'contact',
                        message.status || 'new',
                        message.created_at || new Date()
                    ]
                );
                this.migrationStats.messages++;
            } catch (error) {
                log.error(`Eroare la migrarea mesajului de la "${message.name}":`, error.message);
            }
        }
        
        log.success(`${this.migrationStats.messages} mesaje migrate cu succes`);
    }

    // 8. Creare utilizator admin implicit
    async createDefaultAdmin() {
        log.step('Crearea utilizatorului admin implicit...');
        
        try {
            const hashedPassword = await bcrypt.hash('parola123', 10);
            
            await this.connection.execute(
                `INSERT IGNORE INTO admin_users (username, email, password_hash) 
                 VALUES (?, ?, ?)`,
                ['admin', 'admin@casadenis.ro', hashedPassword]
            );
            
            log.success('Utilizator admin creat (username: admin, password: parola123)');
        } catch (error) {
            log.error('Eroare la crearea utilizatorului admin:', error.message);
        }
    }

    // 9. Configurare email implicită
    async setupDefaultEmailConfig() {
        log.step('Configurarea email-ului implicit...');
        
        try {
            await this.connection.execute(
                `INSERT IGNORE INTO email_settings (
                    smtp_host, smtp_port, smtp_username, smtp_password, 
                    from_email, from_name, admin_email
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    'smtp.gmail.com',
                    587,
                    'casa.denis2025@gmail.com',
                    process.env.EMAIL_PASS || 'your_app_password_here',
                    'casa.denis2025@gmail.com',
                    'Casa Denis',
                    'casa.denis2025@gmail.com'
                ]
            );
            
            log.success('Configurare email completă');
        } catch (error) {
            log.error('Eroare la configurarea email-ului:', error.message);
        }
    }

    // Helper pentru extragerea culorilor
    extractColor(colorInput) {
        if (!colorInput) return null;
        
        const colorMap = {
            'bg-pink-100': '#fce7f3',
            'bg-purple-100': '#f3e8ff',
            'bg-yellow-100': '#fef3c7',
            'bg-green-100': '#dcfce7',
            'bg-blue-100': '#dbeafe',
            'bg-orange-100': '#fed7aa',
            'pink': '#ec4899',
            'purple': '#8b5cf6',
            'yellow': '#eab308',
            'green': '#22c55e',
            'blue': '#3b82f6',
            'orange': '#f97316'
        };
        
        return colorMap[colorInput] || colorInput;
    }

    // Helper pentru parsarea intervalelor de timp
    parseTimeRange(timeString) {
        if (!timeString) return ['09:00:00', '10:00:00'];
        
        const timeRegex = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/;
        const match = timeString.match(timeRegex);
        
        if (match) {
            const [, startHour, startMin, endHour, endMin] = match;
            return [
                `${startHour.padStart(2, '0')}:${startMin}:00`,
                `${endHour.padStart(2, '0')}:${endMin}:00`
            ];
        }
        
        // Fallback pentru format nerecunoscut
        return ['09:00:00', '10:00:00'];
    }

    // Funcția principală de migrare
    async migrate() {
        console.log('\n🚀 ===== CASA DENIS - MIGRARE DATE =====\n');
        
        try {
            await this.connect();
            
            // Rulează toate migrările
            await this.migratePrograms();
            await this.migrateTestimonials();
            await this.migrateGallery();
            await this.migrateSpaces();
            await this.migrateSchedule();
            await this.migratePageContent();
            await this.migrateMessages();
            await this.createDefaultAdmin();
            await this.setupDefaultEmailConfig();
            
            // Afișează statisticile finale
            this.displayMigrationStats();
            
        } catch (error) {
            log.error('Eroare critică în timpul migrării:', error.message);
            throw error;
        } finally {
            await this.disconnect();
        }
    }

    // Afișare statistici migrare
    displayMigrationStats() {
        console.log('\n📊 ===== STATISTICI MIGRARE =====');
        console.log(`✅ Programe migrate: ${this.migrationStats.programs}`);
        console.log(`✅ Testimoniale migrate: ${this.migrationStats.testimonials}`);
        console.log(`✅ Imagini galerie migrate: ${this.migrationStats.gallery}`);
        console.log(`✅ Spații migrate: ${this.migrationStats.spaces}`);
        console.log(`✅ Activități program migrate: ${this.migrationStats.schedule}`);
        console.log(`✅ Pagini conținut migrate: ${this.migrationStats.pageContent}`);
        console.log(`✅ Mesaje migrate: ${this.migrationStats.messages}`);
        
        const total = Object.values(this.migrationStats).reduce((sum, count) => sum + count, 0);
        console.log(`\n🎉 TOTAL: ${total} înregistrări migrate cu succes!`);
        
        console.log('\n📋 ===== INFORMAȚII IMPORTANTE =====');
        console.log('👤 Utilizator admin: admin');
        console.log('🔑 Parolă admin: parola123');
        console.log('📧 Email configurat: casa.denis2025@gmail.com');
        console.log('⚠️  SCHIMBĂ PAROLA ADMIN după prima autentificare!');
        console.log('⚠️  Configurează parola email în .env (EMAIL_PASS)');
    }
}

// =============================================
// SCRIPT PRINCIPAL DE MIGRARE
// =============================================

async function runMigration() {
    const migration = new DataMigration();
    
    try {
        await migration.migrate();
        console.log('\n🎊 Migrarea s-a finalizat cu succes!');
        console.log('🚀 Poți porni acum serverul cu: npm start');
        
    } catch (error) {
        console.error('\n💥 Migrarea a eșuat:', error.message);
        console.log('\n🔧 Verifică:');
        console.log('  1. MySQL Server rulează');
        console.log('  2. Configurația din .env este corectă');
        console.log('  3. Baza de date casa_denis_db există');
        console.log('  4. Utilizatorul are permisiuni complete');
        process.exit(1);
    }
}

// Verificare arguments pentru rulare directă
if (require.main === module) {
    runMigration();
}

module.exports = DataMigration; 