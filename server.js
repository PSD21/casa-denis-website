const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 8080;

// Middleware 
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'casadenis-project', 'public')));

// Authentication Middleware
const authenticateAdmin = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const [rows] = await pool.execute(
            'SELECT * FROM admin_users WHERE id = ? AND is_active = TRUE',
            [token]
        );
        
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid token' });
        }
        
        req.admin = rows[0];
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
};

// Admin Authentication Routes
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM admin_users WHERE username = ? AND is_active = TRUE',
            [username]
        );
        
        if (rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const admin = rows[0];
        const validPassword = await bcrypt.compare(password, admin.password_hash);
        
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Update last login
        await pool.execute(
            'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
            [admin.id]
        );
        
        res.json({ 
            token: admin.id,
            admin: {
                id: admin.id,
                username: admin.username,
                email: admin.email
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Protected Admin Routes
app.get('/api/admin/content/:page', authenticateAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM page_content WHERE page_name = ? ORDER BY order_index',
            [req.params.page]
        );
        res.json(rows);
    } catch (error) {
        console.error('Content fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
});

app.post('/api/admin/content', authenticateAdmin, async (req, res) => {
    const { page_name, section_name, content_type, content, order_index } = req.body;
    
    try {
        const [result] = await pool.execute(
            `INSERT INTO page_content 
            (page_name, section_name, content_type, content, order_index) 
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
            content_type = VALUES(content_type),
            content = VALUES(content),
            order_index = VALUES(order_index)`,
            [page_name, section_name, content_type, content, order_index]
        );
        
        res.json({ 
            id: result.insertId,
            message: 'Content saved successfully'
        });
    } catch (error) {
        console.error('Content save error:', error);
        res.status(500).json({ error: 'Failed to save content' });
    }
});

app.delete('/api/admin/content/:id', authenticateAdmin, async (req, res) => {
    try {
        await pool.execute(
            'DELETE FROM page_content WHERE id = ?',
            [req.params.id]
        );
        res.json({ message: 'Content deleted successfully' });
    } catch (error) {
        console.error('Content delete error:', error);
        res.status(500).json({ error: 'Failed to delete content' });
    }
});

// Gallery Management Routes
app.get('/api/admin/gallery', authenticateAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM gallery_items ORDER BY order_index'
        );
        res.json(rows);
    } catch (error) {
        console.error('Gallery fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch gallery items' });
    }
});

app.post('/api/admin/gallery', authenticateAdmin, async (req, res) => {
    const { title, description, image_path, category, order_index } = req.body;
    
    try {
        const [result] = await pool.execute(
            `INSERT INTO gallery_items 
            (title, description, image_path, category, order_index) 
            VALUES (?, ?, ?, ?, ?)`,
            [title, description, image_path, category, order_index]
        );
        
        res.json({ 
            id: result.insertId,
            message: 'Gallery item added successfully'
        });
    } catch (error) {
        console.error('Gallery save error:', error);
        res.status(500).json({ error: 'Failed to save gallery item' });
    }
});

app.delete('/api/admin/gallery/:id', authenticateAdmin, async (req, res) => {
    try {
        await pool.execute(
            'DELETE FROM gallery_items WHERE id = ?',
            [req.params.id]
        );
        res.json({ message: 'Gallery item deleted successfully' });
    } catch (error) {
        console.error('Gallery delete error:', error);
        res.status(500).json({ error: 'Failed to delete gallery item' });
    }
});

// Testimonials Management Routes
app.get('/api/admin/testimonials', authenticateAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM testimonials ORDER BY created_at DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error('Testimonials fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch testimonials' });
    }
});

app.post('/api/admin/testimonials', authenticateAdmin, async (req, res) => {
    const { author_name, author_role, content, rating } = req.body;
    
    try {
        const [result] = await pool.execute(
            `INSERT INTO testimonials 
            (author_name, author_role, content, rating) 
            VALUES (?, ?, ?, ?)`,
            [author_name, author_role, content, rating]
        );
        
        res.json({ 
            id: result.insertId,
            message: 'Testimonial added successfully'
        });
    } catch (error) {
        console.error('Testimonial save error:', error);
        res.status(500).json({ error: 'Failed to save testimonial' });
    }
});

app.delete('/api/admin/testimonials/:id', authenticateAdmin, async (req, res) => {
    try {
        await pool.execute(
            'DELETE FROM testimonials WHERE id = ?',
            [req.params.id]
        );
        res.json({ message: 'Testimonial deleted successfully' });
    } catch (error) {
        console.error('Testimonial delete error:', error);
        res.status(500).json({ error: 'Failed to delete testimonial' });
    }
});



// MySQL Connection Pool
/*
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'casa_denis_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});
*/

// SIMPLE FIX: Just add these lines to your server.js file
// Find the MySQL pool creation and replace it with this:

// Use the database configuration from db.js
const { pool } = require('./db.js');

// Test database connection and setup
async function setupDatabase() {
    try {
        // Test MySQL connection
        const [rows] = await pool.execute('SELECT 1 as test');
        console.log('✅ MySQL database connected successfully');
        
        // Ensure all tables exist (basic check)
        try {
            await pool.execute('SELECT COUNT(*) FROM messages');
            await pool.execute('SELECT COUNT(*) FROM admin_users');
            console.log('✅ Database tables verified');
        } catch (error) {
            console.log('⚠️ Some tables may be missing. Run setup-db.js if needed.');
        }
        
    } catch (error) {
        console.error('❌ MySQL connection failed:', error.message);
        console.log('⚠️ Falling back to JSON files');
        
        // Create data directory if it doesn't exist
        const dataDir = path.join(__dirname, 'data');
        try {
            await fs.mkdir(dataDir, { recursive: true });
        } catch (error) {
            // Directory already exists
        }
        
        // Initialize empty JSON files if they don't exist
        const defaultFiles = {
            'messages.json': [],
            'about-detailed.json': getDefaultAboutDetailed()
        };
        
        for (const [filename, defaultData] of Object.entries(defaultFiles)) {
            const filePath = path.join(dataDir, filename);
            try {
                await fs.access(filePath);
            } catch (error) {
                await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
                console.log(`✅ Created ${filename}`);
            }
        }
        
        console.log('✅ JSON file system ready');
    }
}

setupDatabase();

// Email transporter setup
let emailTransporter = null;
let emailStatus = '⏳ CONFIGURING...';

async function setupEmailTransporter() {
    try {
        // Try to get email settings from database
        const [rows] = await pool.execute('SELECT * FROM email_settings WHERE is_active = TRUE LIMIT 1');
        if (rows.length > 0) {
            const settings = rows[0];
            emailTransporter = nodemailer.createTransport({
                host: settings.smtp_host,
                port: settings.smtp_port,
                secure: false,
                auth: {
                    user: settings.smtp_username,
                    pass: settings.smtp_password
                },
                tls: {
                    rejectUnauthorized: false
                }
            });
            console.log('✅ Email transporter configured from database');
            emailStatus = '✅ ENABLED (Database Config)';
        } else {
            throw new Error('No email settings found in database');
        }
    } catch (error) {
        console.log('⚠️ Database email settings not available, using .env configuration');
        
        const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS || 'your_app_password_here';
        
        if (emailPass === 'your_app_password_here') {
            console.log('⚠️ Gmail App Password not configured!');
            console.log('📧 To enable email notifications:');
            console.log('   1. Go to https://myaccount.google.com/apppasswords');
            console.log('   2. Generate an App Password for "Casa Denis"');
            console.log('   3. Create .env file with: EMAIL_PASS=your_16_char_app_password');
            console.log('   4. Restart the server');
            emailStatus = '❌ DISABLED (No App Password)';
            emailTransporter = null;
            return;
        }
        
        // Configure Gmail SMTP for Casa Denis from .env
        emailTransporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
                user: 'casa.denis2025@gmail.com',
                pass: emailPass
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        
        console.log('✅ Email transporter configured from .env');
        emailStatus = '✅ ENABLED (.env Config)';
    }
    
    // Test email connection if transporter is set up
    if (emailTransporter) {
        try {
            await emailTransporter.verify();
            console.log('✅ Email connection verified successfully');
        } catch (verifyError) {
            console.error('❌ Email verification failed:', verifyError.message);
            if (verifyError.message.includes('Invalid login')) {
                console.log('💡 Tip: Make sure you\'re using a Gmail App Password, not your regular password');
                console.log('📧 Get App Password: https://myaccount.google.com/apppasswords');
                emailStatus = '❌ DISABLED (Invalid Credentials)';
                emailTransporter = null;
            } else {
                emailStatus = '⚠️ ENABLED (Connection Issues)';
            }
        }
    }
}

setupEmailTransporter();

// Data file paths (for JSON backup compatibility)
const dataPath = {
    hero: path.join(__dirname, 'data', 'hero.json'),
    about: path.join(__dirname, 'data', 'about.json'),
    programs: path.join(__dirname, 'data', 'programs.json'),
    schedule: path.join(__dirname, 'data', 'schedule.json'),
    spaces: path.join(__dirname, 'data', 'spaces.json'),
    gallery: path.join(__dirname, 'data', 'gallery.json'),
    testimonials: path.join(__dirname, 'data', 'testimonials.json'),
    contact: path.join(__dirname, 'data', 'contact.json'),
    messages: path.join(__dirname, 'data', 'messages.json')
};

// Helper functions
async function readData(file) {
    try {
        const data = await fs.readFile(file, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
}

async function writeData(file, data) {
    try {
        await fs.writeFile(file, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing data:', error);
        return false;
    }
}

// Enhanced Email Functions
async function sendEmail(to, subject, htmlContent, messageId = null) {
    if (!emailTransporter) {
        console.error('❌ Email transporter not configured');
        return false;
    }

    try {
        const [settingsRows] = await pool.execute('SELECT * FROM email_settings WHERE is_active = TRUE LIMIT 1');
        if (settingsRows.length === 0) {
            throw new Error('No active email settings found');
        }
        
        const settings = settingsRows[0];
        
        const mailOptions = {
            from: `${settings.from_name} <${settings.from_email}>`,
            to: to,
            subject: subject,
            html: htmlContent
        };

        const result = await emailTransporter.sendMail(mailOptions);
        
        // Log successful email
        await pool.execute(
            'INSERT INTO email_logs (message_id, recipient_email, subject, status, sent_at) VALUES (?, ?, ?, ?, NOW())',
            [messageId, to, subject, 'sent']
        );
        
        console.log('✅ Email sent successfully to:', to);
        return true;
        
    } catch (error) {
        console.error('❌ Email sending failed:', error.message);
        
        // Log failed email
        try {
            await pool.execute(
                'INSERT INTO email_logs (message_id, recipient_email, subject, status, error_message, sent_at) VALUES (?, ?, ?, ?, ?, NOW())',
                [messageId, to, subject, 'failed', error.message]
            );
        } catch (logError) {
            console.error('Failed to log email error:', logError);
        }
        
        return false;
    }
}

async function sendNotificationEmail(messageData) {
    try {
        const [settingsRows] = await pool.execute('SELECT admin_email FROM email_settings WHERE is_active = TRUE LIMIT 1');
        if (settingsRows.length === 0) {
            console.error('No email settings found');
            return false;
        }
        
        const adminEmail = settingsRows[0].admin_email;
        
        const typeText = {
            'contact': 'Mesaj de Contact',
            'enrollment': 'Cerere de Înscriere',
            'rental_inquiry': 'Cerere Închiriere Spațiu'
        };
        
        const subject = `[Casa Denis] ${typeText[messageData.message_type] || 'Mesaj Nou'} - ${messageData.name}`;
        
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
                <div style="background: linear-gradient(135deg, #ec4899, #8b5cf6); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">🏠 Casa Denis</h1>
                    <p style="color: white; margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">${typeText[messageData.message_type] || 'Mesaj Nou'}</p>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border-left: 4px solid #ec4899; margin-bottom: 20px;">
                        <h3 style="color: #8b5cf6; margin: 0 0 15px 0;">📝 Detalii mesaj:</h3>
                        <p style="margin: 0 0 8px 0;"><strong>👤 Nume:</strong> ${messageData.name}</p>
                        <p style="margin: 0 0 8px 0;"><strong>📧 Email:</strong> <a href="mailto:${messageData.email}" style="color: #ec4899; text-decoration: none;">${messageData.email}</a></p>
                        ${messageData.phone ? `<p style="margin: 0 0 8px 0;"><strong>📞 Telefon:</strong> <a href="tel:${messageData.phone}" style="color: #ec4899; text-decoration: none;">${messageData.phone}</a></p>` : ''}
                        <p style="margin: 0 0 8px 0;"><strong>🏷️ Tip:</strong> ${typeText[messageData.message_type] || 'Contact'}</p>
                        <p style="margin: 0;"><strong>📅 Data:</strong> ${new Date(messageData.created_at).toLocaleDateString('ro-RO', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric', 
                            hour: '2-digit', 
                            minute: '2-digit' 
                        })}</p>
                    </div>
                    
                    <div style="background: #fffbeb; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                        <h3 style="color: #92400e; margin: 0 0 10px 0;">💬 Mesaj:</h3>
                        <p style="margin: 0; line-height: 1.6; color: #92400e; font-style: italic;">"${messageData.message.replace(/\n/g, '<br>')}"</p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://casadenis.ro/admin.html#messages" 
                           style="background: linear-gradient(135deg, #ec4899, #8b5cf6); 
                                  color: white; 
                                  padding: 15px 30px; 
                                  text-decoration: none; 
                                  border-radius: 25px; 
                                  font-weight: bold; 
                                  display: inline-block;
                                  box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3);">
                            🔧 Vezi în Dashboard Admin
                        </a>
                    </div>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                        <p style="margin: 0; color: #6b7280; font-size: 14px;">
                            📧 Pentru a răspunde direct: 
                            <a href="mailto:${messageData.email}?subject=Re: ${encodeURIComponent(typeText[messageData.message_type] || 'Mesaj')}" 
                               style="color: #ec4899; text-decoration: none; font-weight: 500;">${messageData.email}</a>
                        </p>
                        <p style="margin: 10px 0 0 0; color: #9ca3af; font-size: 12px;">
                            Acest email a fost generat automat de sistemul Casa Denis
                        </p>
                    </div>
                </div>
            </div>
        `;
        
        return await sendEmail(adminEmail, subject, htmlContent, messageData.id);
        
    } catch (error) {
        console.error('Error sending notification email:', error);
        return false;
    }
}

async function sendConfirmationEmail(messageData) {
    try {
        const typeText = {
            'contact': 'mesajul dumneavoastră',
            'enrollment': 'cererea de înscriere',
            'rental_inquiry': 'cererea de închiriere'
        };
        
        const subject = `✅ Confirmare ${typeText[messageData.message_type] || 'mesaj'} - Casa Denis`;
        
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb;">
                <div style="background: linear-gradient(135deg, #ec4899, #8b5cf6); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                    <h1 style="color: white; margin: 0; font-size: 28px;">🏠 Casa Denis</h1>
                    <p style="color: white; margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Mulțumim pentru mesaj!</p>
                </div>
                
                <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    <h2 style="color: #8b5cf6; margin-top: 0;">Bună ziua, ${messageData.name}! 👋</h2>
                    
                    <p style="color: #374151; line-height: 1.6; margin-bottom: 20px; font-size: 16px;">
                        Mulțumim că ne-ați contactat! Am primit <strong>${typeText[messageData.message_type] || 'mesajul'}</strong> 
                        și vă vom răspunde în cel mai scurt timp posibil (de obicei în maxim 24 de ore).
                    </p>
                    
                    <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #0ea5e9; margin: 25px 0;">
                        <h3 style="color: #0369a1; margin: 0 0 10px 0; font-size: 16px;">📨 Mesajul dumneavoastră:</h3>
                        <p style="margin: 0; color: #075985; font-style: italic; line-height: 1.5;">"${messageData.message}"</p>
                    </div>
                    
                    <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #22c55e; margin: 25px 0;">
                        <h3 style="color: #166534; margin: 0 0 15px 0; font-size: 16px;">📞 Informații de contact:</h3>
                        <p style="margin: 0 0 8px 0; color: #166534;"><strong>📧 Email:</strong> casa.denis2025@gmail.com</p>
                        <p style="margin: 0 0 8px 0; color: #166534;"><strong>📞 Telefoane:</strong> +40 740 490 171, +40 740 096 051</p>
                        <p style="margin: 0 0 8px 0; color: #166534;"><strong>📍 Adresă:</strong> Strada Satmarel 402, Satu Mare, România</p>
                        <p style="margin: 0; color: #166534;"><strong>🕒 Program:</strong> Luni - Vineri: 07:00 - 18:00</p>
                    </div>
                    
                    <div style="text-align: center; margin: 30px 0;">
                        <a href="https://casadenis.ro" 
                           style="background: linear-gradient(135deg, #ec4899, #8b5cf6); 
                                  color: white; 
                                  padding: 12px 25px; 
                                  text-decoration: none; 
                                  border-radius: 25px; 
                                  font-weight: bold; 
                                  display: inline-block; 
                                  margin: 0 10px 10px 0;">
                            🌐 Vizitează site-ul
                        </a>
                        <a href="https://www.instagram.com/casa_denis_" 
                           style="background: #E4405F; 
                                  color: white; 
                                  padding: 12px 25px; 
                                  text-decoration: none; 
                                  border-radius: 25px; 
                                  font-weight: bold; 
                                  display: inline-block; 
                                  margin: 0 10px 10px 0;">
                            📸 Instagram
                        </a>
                    </div>
                    
                    <div style="background: #fef3c7; padding: 20px; border-radius: 8px; border-left: 4px solid #f59e0b; margin: 25px 0;">
                        <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 16px;">🌟 Ce ne face speciali:</h3>
                        <ul style="margin: 0; padding-left: 20px; color: #92400e; line-height: 1.6;">
                            <li>Personal calificat și dedicat</li>
                            <li>Spații moderne și sigure</li>
                            <li>Program flexibil adaptat nevoilor</li>
                            <li>Mese sănătoase incluse</li>
                            <li>Activități educaționale variate</li>
                        </ul>
                    </div>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                        <p style="margin: 0; color: #8b5cf6; font-size: 16px; font-weight: 600;">
                            Cu drag,<br>
                            <strong style="color: #ec4899;">Echipa Casa Denis</strong> 💜
                        </p>
                        <p style="margin: 15px 0 0 0; color: #6b7280; font-size: 14px; font-style: italic;">
                            "Un loc unde copiii înfloresc!" 🌟
                        </p>
                    </div>
                </div>
            </div>
        `;
        
        return await sendEmail(messageData.email, subject, htmlContent, messageData.id);
        
    } catch (error) {
        console.error('Error sending confirmation email:', error);
        return false;
    }
}

// === ENHANCED MESSAGES API ===

// Get all messages with pagination and filtering
app.get('/api/messages', async (req, res) => {
    try {
        const { 
            status, 
            type, 
            page = 1, 
            limit = 20, 
            search,
            dateFrom,
            dateTo 
        } = req.query;
        
        // Get all messages from database
        const [rows] = await pool.execute('SELECT * FROM messages ORDER BY created_at DESC');
        
        // Apply filters
        let filteredMessages = rows;
        
        if (status) {
            filteredMessages = filteredMessages.filter(msg => msg.status === status);
        }
        
        if (type) {
            filteredMessages = filteredMessages.filter(msg => msg.message_type === type);
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            filteredMessages = filteredMessages.filter(msg => 
                msg.name.toLowerCase().includes(searchLower) ||
                msg.email.toLowerCase().includes(searchLower) ||
                msg.message.toLowerCase().includes(searchLower)
            );
        }
        
        if (dateFrom) {
            filteredMessages = filteredMessages.filter(msg => 
                new Date(msg.created_at) >= new Date(dateFrom)
            );
        }
        
        if (dateTo) {
            filteredMessages = filteredMessages.filter(msg => 
                new Date(msg.created_at) <= new Date(dateTo + ' 23:59:59')
            );
        }
        
        // Sort by date (newest first)
        filteredMessages.sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );
        
        // Apply pagination
        const offset = (page - 1) * limit;
        const paginatedMessages = filteredMessages.slice(offset, offset + parseInt(limit));
        
        const total = filteredMessages.length;
        
        res.json({
            success: true,
            messages: paginatedMessages,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: total,
                pages: Math.ceil(total / limit),
                hasNext: parseInt(page) < Math.ceil(total / limit),
                hasPrev: parseInt(page) > 1
            }
        });
        
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Eroare la încărcarea mesajelor',
            messages: []
        });
    }
});

// Create new message
app.post('/api/messages', async (req, res) => {
    try {
        const { name, email, phone, message, message_type = 'contact' } = req.body;
        const ip_address = req.ip || req.connection.remoteAddress;
        const user_agent = req.get('User-Agent');
        
        // Enhanced validations
        if (!name || !email || !message) {
            return res.status(400).json({ 
                success: false,
                error: 'Numele, email-ul și mesajul sunt obligatorii' 
            });
        }
        
        if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({ 
                success: false,
                error: 'Adresa de email nu este validă' 
            });
        }
        
        if (message.length < 10) {
            return res.status(400).json({ 
                success: false,
                error: 'Mesajul trebuie să aibă cel puțin 10 caractere' 
            });
        }
        
        if (phone && !phone.match(/^[\+]?[\d\s\-\(\)]{7,15}$/)) {
            return res.status(400).json({ 
                success: false,
                error: 'Numărul de telefon nu este valid' 
            });
        }
        
        // Insert into database
        const [result] = await pool.execute(
            `INSERT INTO messages (name, email, phone, message, message_type, ip_address, user_agent) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [name.trim(), email.trim(), phone?.trim() || null, message.trim(), message_type, ip_address, user_agent]
        );
        
        const messageId = result.insertId;
        
        // Get the created message
        const [messageRows] = await pool.execute('SELECT * FROM messages WHERE id = ?', [messageId]);
        const messageData = messageRows[0];
        
        // Send emails asynchronously
        setImmediate(async () => {
            try {
                await Promise.all([
                    sendNotificationEmail(messageData),
                    sendConfirmationEmail(messageData)
                ]);
            } catch (emailError) {
                console.error('Email sending error:', emailError);
            }
        });
        
        // Backup to JSON file for compatibility
        try {
            const existingMessages = await readData(dataPath.messages);
            const jsonMessage = {
                id: uuidv4(),
                name: name.trim(),
                email: email.trim(),
                phone: phone?.trim() || '',
                message: message.trim(),
                message_type,
                date: new Date().toISOString().split('T')[0],
                created_at: new Date().toISOString()
            };
            existingMessages.push(jsonMessage);
            await writeData(dataPath.messages, existingMessages);
        } catch (jsonError) {
            console.warn('JSON backup failed:', jsonError.message);
        }
        
        res.status(201).json({
            success: true,
            message: 'Mesajul a fost trimis cu succes! Vă vom răspunde în cel mai scurt timp.',
            id: messageId
        });
        
    } catch (error) {
        console.error('Error creating message:', error);
        res.status(500).json({ 
            success: false,
            error: 'Eroare la trimiterea mesajului. Vă rugăm încercați din nou.' 
        });
    }
});

// Update message status
app.patch('/api/messages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const validStatuses = ['new', 'read', 'replied', 'archived'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false,
                error: 'Status invalid. Valorile permise: ' + validStatuses.join(', ') 
            });
        }
        
        const [result] = await pool.execute(
            'UPDATE messages SET status = ?, updated_at = NOW() WHERE id = ?', 
            [status, id]
        );
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Mesajul nu a fost găsit' 
            });
        }
        
        res.json({ 
            success: true, 
            message: `Status actualizat la: ${status}` 
        });
        
    } catch (error) {
        console.error('Error updating message:', error);
        res.status(500).json({ 
            success: false,
            error: 'Eroare la actualizarea mesajului' 
        });
    }
});

// Delete message
app.delete('/api/messages/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const [result] = await pool.execute('DELETE FROM messages WHERE id = ?', [id]);
        
        if (result.affectedRows === 0) {
            return res.status(404).json({ 
                success: false,
                error: 'Mesajul nu a fost găsit' 
            });
        }
        
        res.json({ 
            success: true, 
            message: 'Mesaj șters cu succes' 
        });
        
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ 
            success: false,
            error: 'Eroare la ștergerea mesajului' 
        });
    }
});

// Get message statistics
app.get('/api/messages/stats', async (req, res) => {
    try {
        const [totalRows] = await pool.execute('SELECT COUNT(*) as total FROM messages');
        const [newRows] = await pool.execute('SELECT COUNT(*) as new_messages FROM messages WHERE status = "new"');
        const [todayRows] = await pool.execute('SELECT COUNT(*) as today FROM messages WHERE DATE(created_at) = CURDATE()');
        const [weekRows] = await pool.execute('SELECT COUNT(*) as this_week FROM messages WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)');
        const [typeRows] = await pool.execute(`
            SELECT message_type, COUNT(*) as count 
            FROM messages 
            GROUP BY message_type
        `);
        const [statusRows] = await pool.execute(`
            SELECT status, COUNT(*) as count 
            FROM messages 
            GROUP BY status
        `);
        
        const stats = {
            total: totalRows[0].total,
            new: newRows[0].new_messages,
            today: todayRows[0].today,
            this_week: weekRows[0].this_week,
            by_type: typeRows.reduce((acc, row) => {
                acc[row.message_type] = row.count;
                return acc;
            }, {}),
            by_status: statusRows.reduce((acc, row) => {
                acc[row.status] = row.count;
                return acc;
            }, {})
        };
        
        res.json({
            success: true,
            stats
        });
        
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ 
            success: false,
            error: 'Eroare la încărcarea statisticilor' 
        });
    }
});

// === EMAIL SETTINGS API ===

// Get email settings
app.get('/api/email-settings', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM email_settings WHERE is_active = TRUE LIMIT 1');
        
        if (rows.length === 0) {
            return res.json({
                success: false,
                message: 'Nu există configurări email active'
            });
        }
        
        // Don't send password in response
        const settings = { ...rows[0] };
        delete settings.smtp_password;
        
        res.json({
            success: true,
            settings
        });
        
    } catch (error) {
        console.error('Error fetching email settings:', error);
        res.status(500).json({ 
            success: false,
            error: 'Eroare la încărcarea configurărilor email' 
        });
    }
});

// Update email settings
app.put('/api/email-settings', async (req, res) => {
    try {
        const {
            smtp_host,
            smtp_port,
            smtp_username,
            smtp_password,
            from_email,
            from_name,
            admin_email
        } = req.body;
        
        // Validate required fields
        if (!smtp_host || !smtp_port || !smtp_username || !from_email || !from_name || !admin_email) {
            return res.status(400).json({
                success: false,
                error: 'Toate câmpurile sunt obligatorii'
            });
        }
        
        // Validate email addresses
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(from_email) || !emailRegex.test(admin_email)) {
            return res.status(400).json({
                success: false,
                error: 'Adresele de email nu sunt valide'
            });
        }
        
        // Disable current active settings
        await pool.execute('UPDATE email_settings SET is_active = FALSE');
        
        // Insert new settings (only include password if provided)
        let query, params;
        if (smtp_password) {
            query = `INSERT INTO email_settings 
                     (smtp_host, smtp_port, smtp_username, smtp_password, from_email, from_name, admin_email, is_active) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`;
            params = [smtp_host, smtp_port, smtp_username, smtp_password, from_email, from_name, admin_email];
        } else {
            // Keep existing password if not provided
            const [existingRows] = await pool.execute('SELECT smtp_password FROM email_settings ORDER BY id DESC LIMIT 1');
            const existingPassword = existingRows.length > 0 ? existingRows[0].smtp_password : '';
            
            query = `INSERT INTO email_settings 
                     (smtp_host, smtp_port, smtp_username, smtp_password, from_email, from_name, admin_email, is_active) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)`;
            params = [smtp_host, smtp_port, smtp_username, existingPassword, from_email, from_name, admin_email];
        }
        
        await pool.execute(query, params);
        
        // Reconfigure email transporter
        await setupEmailTransporter();
        
        res.json({
            success: true,
            message: 'Configurările email au fost actualizate cu succes'
        });
        
    } catch (error) {
        console.error('Error updating email settings:', error);
        res.status(500).json({ 
            success: false,
            error: 'Eroare la actualizarea configurărilor email' 
        });
    }
});

// Test email configuration
app.post('/api/email-settings/test', async (req, res) => {
    try {
        const { test_email } = req.body;
        
        if (!test_email || !test_email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
            return res.status(400).json({
                success: false,
                error: 'Email de test invalid'
            });
        }
        
        const testSubject = 'Test Email - Casa Denis';
        const testContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #8b5cf6;">🧪 Test Email - Casa Denis</h2>
                <p>Acest email a fost trimis pentru a testa configurarea sistemului de email.</p>
                <p><strong>Data testului:</strong> ${new Date().toLocaleString('ro-RO')}</p>
                <p style="color: #22c55e;">✅ Dacă primești acest email, configurarea funcționează corect!</p>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
                <p style="color: #6b7280; font-size: 14px;">
                    Sistem de management Casa Denis<br>
                    Acest email a fost generat automat.
                </p>
            </div>
        `;
        
        const emailSent = await sendEmail(test_email, testSubject, testContent);
        
        if (emailSent) {
            res.json({
                success: true,
                message: `Email de test trimis cu succes la ${test_email}`
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Eroare la trimiterea email-ului de test'
            });
        }
        
    } catch (error) {
        console.error('Error testing email:', error);
        res.status(500).json({ 
            success: false,
            error: 'Eroare la testarea configurației email' 
        });
    }
});

// === ENHANCED GALLERY API ===

// Gallery storage configuration
const galleryStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'casadenis-project', 'public', 'images');
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        // Keep original filename but ensure it's unique
        const timestamp = Date.now();
        const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${timestamp}_${originalName}`);
    }
});

// File filter for gallery images
const galleryFileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Doar fișiere JPG, PNG și WEBP sunt permise!'), false);
    }
};

// Create upload middleware with file size limit
const uploadGallery = multer({ 
    storage: galleryStorage,
    fileFilter: galleryFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Get all gallery images
app.get('/api/gallery', async (req, res) => {
    try {
        const gallery = await readData(dataPath.gallery);
        // Sort by upload date (newest first)
        const sortedGallery = gallery.sort((a, b) => 
            new Date(b.uploadDate || 0) - new Date(a.uploadDate || 0)
        );
        res.json(sortedGallery);
    } catch (error) {
        console.error('Error loading gallery:', error);
        res.status(500).json({ 
            success: false,
            error: 'Eroare la încărcarea galeriei' 
        });
    }
});

// Upload new image to gallery
app.post('/api/gallery/upload', uploadGallery.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false,
                error: 'Nu a fost încărcat niciun fișier' 
            });
        }

        const { alt } = req.body;
        
        if (!alt || alt.trim() === '') {
            // Delete the uploaded file if alt text is missing
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.warn('Could not delete file:', unlinkError.message);
            }
            return res.status(400).json({ 
                success: false,
                error: 'Descrierea imaginii este obligatorie' 
            });
        }

        // Get image dimensions using sharp or image-size
        const sharp = require('sharp');
        let width = 0, height = 0, aspectRatio = 1;
        
        try {
            const metadata = await sharp(req.file.path).metadata();
            width = metadata.width || 0;
            height = metadata.height || 0;
            aspectRatio = width > 0 && height > 0 ? width / height : 1;
        } catch (dimensionError) {
            console.warn('Could not get image dimensions:', dimensionError.message);
        }

        // Load existing gallery data
        const gallery = await readData(dataPath.gallery);
        
        // Determine image type based on aspect ratio
        let imageType = 'square';
        if (aspectRatio > 1.3) {
            imageType = 'wide'; // Landscape/wide images
        } else if (aspectRatio < 0.8) {
            imageType = 'tall'; // Portrait images
        }
        
        // Create new gallery item with dimension data
        const newItem = {
            id: uuidv4(),
            src: `images/${req.file.filename}`,
            alt: alt.trim(),
            uploadDate: new Date().toISOString(),
            size: req.file.size,
            filename: req.file.filename,
            width,
            height,
            aspectRatio,
            imageType
        };
        
        // Add to gallery array
        gallery.push(newItem);
        
        // Save updated gallery
        await writeData(dataPath.gallery, gallery);
        
        console.log('✅ Gallery image uploaded:', req.file.filename, `(${imageType}, ${width}x${height})`);
        
        res.status(201).json({
            success: true,
            message: 'Imagine încărcată cu succes!',
            image: newItem
        });
        
    } catch (error) {
        console.error('Error uploading gallery image:', error);
        
        // Clean up uploaded file if there was an error
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.warn('Could not delete file after error:', unlinkError.message);
            }
        }
        
        res.status(500).json({ 
            success: false,
            error: 'Eroare la încărcarea imaginii' 
        });
    }
});

// Update gallery item (edit alt text)
app.put('/api/gallery/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { alt } = req.body;
        
        if (!alt || alt.trim() === '') {
            return res.status(400).json({ 
                success: false,
                error: 'Descrierea imaginii este obligatorie' 
            });
        }
        
        const gallery = await readData(dataPath.gallery);
        const imageIndex = gallery.findIndex(img => img.id === id);
        
        if (imageIndex === -1) {
            return res.status(404).json({ 
                success: false,
                error: 'Imaginea nu a fost găsită' 
            });
        }
        
        // Update alt text
        gallery[imageIndex].alt = alt.trim();
        gallery[imageIndex].updatedDate = new Date().toISOString();
        
        // Save updated gallery
        await writeData(dataPath.gallery, gallery);
        
        res.json({
            success: true,
            message: 'Descrierea imaginii a fost actualizată',
            image: gallery[imageIndex]
        });
        
    } catch (error) {
        console.error('Error updating gallery item:', error);
        res.status(500).json({ 
            success: false,
            error: 'Eroare la actualizarea imaginii' 
        });
    }
});

// Delete gallery image
app.delete('/api/gallery/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        const gallery = await readData(dataPath.gallery);
        const imageIndex = gallery.findIndex(img => img.id === id);
        
        if (imageIndex === -1) {
            return res.status(404).json({ 
                success: false,
                error: 'Imaginea nu a fost găsită' 
            });
        }
        
        const imageToDelete = gallery[imageIndex];
        
        // Delete physical file
        const imagePath = path.join(__dirname, 'casadenis-project', 'public', imageToDelete.src);
        try {
            await fs.unlink(imagePath);
            console.log('✅ Physical file deleted:', imageToDelete.filename);
        } catch (unlinkError) {
            console.warn('Could not delete physical file:', unlinkError.message);
        }
        
        // Remove from gallery array
        gallery.splice(imageIndex, 1);
        
        // Save updated gallery
        await writeData(dataPath.gallery, gallery);
        
        res.json({
            success: true,
            message: 'Imaginea a fost ștearsă cu succes'
        });
        
    } catch (error) {
        console.error('Error deleting gallery image:', error);
        res.status(500).json({ 
            success: false,
            error: 'Eroare la ștergerea imaginii' 
        });
    }
});

// Get gallery preview for homepage (prioritizes tall images)
app.get('/api/gallery/preview', async (req, res) => {
    try {
        const gallery = await readData(dataPath.gallery);
        
        // Sort images: tall images first, then by upload date
        const sortedGallery = gallery.sort((a, b) => {
            // Prioritize tall images
            if (a.imageType === 'tall' && b.imageType !== 'tall') return -1;
            if (b.imageType === 'tall' && a.imageType !== 'tall') return 1;
            
            // For same type, sort by upload date (newest first)
            return new Date(b.uploadDate || 0) - new Date(a.uploadDate || 0);
        });
        
        // Take first 8 images (prioritizing tall ones)
        const previewImages = sortedGallery.slice(0, 8);
        
        res.json({
            success: true,
            images: previewImages,
            totalCount: gallery.length,
            tallCount: gallery.filter(img => img.imageType === 'tall').length,
            wideCount: gallery.filter(img => img.imageType === 'wide').length
        });
        
    } catch (error) {
        console.error('Error loading gallery preview:', error);
        res.status(500).json({ 
            success: false,
            error: 'Eroare la încărcarea preview-ului galeriei',
            images: []
        });
    }
});

// Bulk operations for gallery
app.post('/api/gallery/bulk', async (req, res) => {
    try {
        const { action, imageIds } = req.body;
        
        if (!action || !Array.isArray(imageIds) || imageIds.length === 0) {
            return res.status(400).json({ 
                success: false,
                error: 'Acțiune sau ID-uri invalide' 
            });
        }
        
        const gallery = await readData(dataPath.gallery);
        let deletedCount = 0;
        
        if (action === 'delete') {
            // Find images to delete
            const imagesToDelete = gallery.filter(img => imageIds.includes(img.id));
            
            // Delete physical files
            for (const image of imagesToDelete) {
                const imagePath = path.join(__dirname, 'casadenis-project', 'public', image.src);
                try {
                    await fs.unlink(imagePath);
                    deletedCount++;
                } catch (unlinkError) {
                    console.warn('Could not delete physical file:', unlinkError.message);
                }
            }
            
            // Remove from gallery array
            const updatedGallery = gallery.filter(img => !imageIds.includes(img.id));
            
            // Save updated gallery
            await writeData(dataPath.gallery, updatedGallery);
            
            res.json({
                success: true,
                message: `${deletedCount} imagini au fost șterse`,
                deletedCount
            });
        } else {
            res.status(400).json({ 
                success: false,
                error: 'Acțiune nerecunoscută' 
            });
        }
        
    } catch (error) {
        console.error('Error in bulk gallery operation:', error);
        res.status(500).json({ 
            success: false,
            error: 'Eroare la operația în masă' 
        });
    }
});

// === PĂSTRĂM TOATE RUTELE EXISTENTE PENTRU COMPATIBILITATE ===

// Hero
app.get('/api/hero', async (req, res) => {
    const hero = await readData(dataPath.hero);
    res.json(hero);
});

app.put('/api/hero', async (req, res) => {
    try {
        await writeData(dataPath.hero, req.body);
        res.json({
            success: true,
            data: req.body
        });
    } catch (err) {
        console.error('Error updating hero:', err);
        res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
});

// About
app.get('/api/about', async (req, res) => {
    const about = await readData(dataPath.about);
    res.json(about);
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'casadenis-project', 'public', 'images');
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ storage: storage });

app.put('/api/about', upload.single('image'), async (req, res) => {
    try {
        const existingData = await readData(dataPath.about);

        const data = {
            title: req.body.title || '',
            description: req.body.description || '',
            mission: req.body.mission || '',
            image: req.file ? `/images/${req.file.originalname}` : existingData.image
        };

        await writeData(dataPath.about, data);
        res.json({
            success: true,
            data
        });
    } catch (err) {
        console.error('Error in /api/about:', err);
        res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
});

// Programs
app.get('/api/programs', async (req, res) => {
    const programs = await readData(dataPath.programs);
    res.json(programs);
});

app.post('/api/programs', async (req, res) => {
    try {
        const programs = await readData(dataPath.programs);
        const newProgram = { id: uuidv4(), ...req.body };
        programs.push(newProgram);
        await writeData(dataPath.programs, programs);
        res.json({
            success: true,
            data: newProgram
        });
    } catch (err) {
        res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
});

app.put('/api/programs/:id', async (req, res) => {
    try {
        const programs = await readData(dataPath.programs);
        const index = programs.findIndex(p => p.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ 
                success: false,
                error: 'Programul nu a fost găsit' 
            });
        }

        programs[index] = { id: req.params.id, ...req.body };
        await writeData(dataPath.programs, programs);
        res.json({
            success: true,
            data: programs[index]
        });
    } catch (err) {
        res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
});

app.delete('/api/programs/:id', async (req, res) => {
    try {
        const programs = await readData(dataPath.programs);
        const filtered = programs.filter(p => p.id !== req.params.id);
        if (filtered.length === programs.length) {
            return res.status(404).json({ 
                success: false,
                error: 'Programul nu a fost găsit' 
            });
        }
        await writeData(dataPath.programs, filtered);
        res.json({ 
            success: true,
            message: 'Program șters' 
        });
    } catch (err) {
        res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
});

// Schedule
app.get('/api/schedule', async (req, res) => {
    try {
        const schedule = await readData(dataPath.schedule);
        if (!schedule || schedule.length === 0) {
            const defaultSchedule = [
                { time: "07:00 - 08:00", description: "Sosire și acomodare", icon: "fas fa-door-open" },
                { time: "08:00 - 09:00", description: "Mic dejun", icon: "fas fa-bread-slice" },
                { time: "09:00 - 12:00", description: "Asistență la teme", icon: "fas fa-book-open" },
                { time: "12:00 - 13:00", description: "Prânz", icon: "fas fa-utensils" },
                { time: "13:00 - 15:00", description: "Activități educative", icon: "fas fa-book" },
                { time: "15:00 - 15:30", description: "Gustare", icon: "fas fa-ice-cream" },
                { time: "15:30 - 17:00", description: "Activități creative", icon: "fas fa-paint-brush" },
                { time: "17:00 - 18:00", description: "Joc liber și plecare", icon: "fas fa-child" }
            ];
            await writeData(dataPath.schedule, defaultSchedule);
            res.json(defaultSchedule);
        } else {
            res.json(schedule);
        }
    } catch (error) {
        console.error('Error loading schedule:', error);
        res.status(500).json({ 
            success: false,
            error: 'Eroare la încărcarea programului' 
        });
    }
});

app.put('/api/schedule', async (req, res) => {
    try {
        const scheduleData = req.body;

        if (!Array.isArray(scheduleData)) {
            return res.status(400).json({ 
                success: false,
                error: 'Datele trebuie să fie un array' 
            });
        }

        await writeData(dataPath.schedule, scheduleData);
        res.json({ 
            success: true,
            message: 'Program salvat cu succes' 
        });
    } catch (error) {
        console.error('Error saving schedule:', error);
        res.status(500).json({ 
            success: false,
            error: 'Eroare la salvarea programului' 
        });
    }
});

// Spaces
app.get('/api/spaces', async (req, res) => {
    try {
        const spaces = await readData(dataPath.spaces) || [];
        res.json(spaces);
    } catch (err) {
        res.status(500).json({ 
            success: false,
            error: 'Eroare la încărcare' 
        });
    }
});

const uploadSpaces = multer({ storage: storage });

app.post('/api/spaces', uploadSpaces.single('image'), async (req, res) => {
    try {
        const { name, role, description, color } = req.body;
        if (!name || !role || !description || !color) {
            return res.status(400).json({ 
                success: false,
                error: 'Toate câmpurile sunt obligatorii' 
            });
        }

        let imageUrl = '';
        if (req.file) {
            imageUrl = '/images/' + req.file.originalname;
        } else {
            return res.status(400).json({ 
                success: false,
                error: 'Imaginea este obligatorie' 
            });
        }

        const spaces = await readData(dataPath.spaces) || [];
        const newSpace = {
            id: Date.now().toString(),
            name, role, description, color,
            image: imageUrl
        };

        spaces.push(newSpace);
        await writeData(dataPath.spaces, spaces);
        res.json({
            success: true,
            data: newSpace
        });
    } catch (err) {
        res.status(500).json({ 
            success: false,
            error: 'Eroare la salvare' 
        });
    }
});

app.put('/api/spaces/:id', uploadSpaces.single('image'), async (req, res) => {
    try {
        const { name, role, description, color } = req.body;
        const spaces = await readData(dataPath.spaces) || [];
        const index = spaces.findIndex(s => s.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ 
                success: false,
                error: 'Spațiul nu a fost găsit' 
            });
        }

        let imageUrl = spaces[index].image;
        if (req.file) {
            imageUrl = '/images/' + req.file.originalname;
        }

        spaces[index] = {
            ...spaces[index],
            name: name || spaces[index].name,
            role: role || spaces[index].role,
            description: description || spaces[index].description,
            color: color || spaces[index].color,
            image: imageUrl
        };

        await writeData(dataPath.spaces, spaces);
        res.json({
            success: true,
            data: spaces[index]
        });
    } catch (err) {
        res.status(500).json({ 
            success: false,
            error: 'Eroare la editare' 
        });
    }
});

app.delete('/api/spaces/:id', async (req, res) => {
    try {
        const spaces = await readData(dataPath.spaces) || [];
        const filtered = spaces.filter(s => s.id !== req.params.id);
        if (filtered.length === spaces.length) {
            return res.status(404).json({ 
                success: false,
                error: 'Spațiul nu a fost găsit' 
            });
        }
        await writeData(dataPath.spaces, filtered);
        res.json({ 
            success: true,
            message: 'Spațiu șters' 
        });
    } catch (err) {
        res.status(500).json({ 
            success: false,
            error: 'Eroare la ștergere' 
        });
    }
});

// Testimonials
app.get('/api/testimonials', async (req, res) => {
    const testimonials = await readData(dataPath.testimonials);
    res.json(testimonials);
});

app.post('/api/testimonials', async (req, res) => {
    try {
        const testimonials = await readData(dataPath.testimonials);
        const newTestimonial = { id: uuidv4(), ...req.body };
        testimonials.push(newTestimonial);
        await writeData(dataPath.testimonials, testimonials);
        res.json({
            success: true,
            data: newTestimonial
        });
    } catch (err) {
        res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
});

app.put('/api/testimonials/:id', async (req, res) => {
    try {
        const testimonials = await readData(dataPath.testimonials);
        const index = testimonials.findIndex(t => t.id === req.params.id);
        if (index === -1) {
            return res.status(404).json({ 
                success: false,
                error: 'Testimonialul nu a fost găsit' 
            });
        }
        testimonials[index] = { id: req.params.id, ...req.body };
        await writeData(dataPath.testimonials, testimonials);
        res.json({
            success: true,
            data: testimonials[index]
        });
    } catch (err) {
        res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
});

app.delete('/api/testimonials/:id', async (req, res) => {
    try {
        const testimonials = await readData(dataPath.testimonials);
        const filtered = testimonials.filter(t => t.id !== req.params.id);
        if (filtered.length === testimonials.length) {
            return res.status(404).json({ 
                success: false,
                error: 'Testimonialul nu a fost găsit' 
            });
        }
        await writeData(dataPath.testimonials, filtered);
        res.json({ 
            success: true,
            message: 'Testimonial șters' 
        });
    } catch (err) {
        res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
});

// Contact
app.get('/api/contact', async (req, res) => {
    const contact = await readData(dataPath.contact);
    res.json(contact);
});

app.put('/api/contact', async (req, res) => {
    try {
        await writeData(dataPath.contact, req.body);
        res.json({
            success: true,
            data: req.body
        });
    } catch (err) {
        res.status(500).json({ 
            success: false,
            error: err.message 
        });
    }
});

// Enhanced Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        // Check database first
        const [rows] = await pool.execute('SELECT * FROM admin_users WHERE username = ? AND is_active = TRUE', [username]);
        
        if (rows.length > 0) {
            const user = rows[0];
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            
            if (isValidPassword) {
                // Update last login
                await pool.execute('UPDATE admin_users SET last_login = NOW() WHERE id = ?', [user.id]);
                return res.json({ 
                    success: true,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email
                    } 
                });
            }
        }
        
        // Fallback to hardcoded credentials
        if (username === 'admin' && password === 'parola123') {
            return res.json({ 
                success: true,
                user: {
                    username: 'admin',
                    email: 'admin@casadenis.ro'
                }
            });
        }
        
        res.status(401).json({ 
            success: false,
            error: 'Utilizator sau parolă incorectă' 
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Eroare la autentificare' 
        });
    }
});

// Create new admin user
app.post('/api/admin-users', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Validate input
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username, email și parola sunt obligatorii'
            });
        }
        
        // Check if user already exists
        const [existingUsers] = await pool.execute(
            'SELECT id FROM admin_users WHERE username = ? OR email = ?', 
            [username, email]
        );
        
        if (existingUsers.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Username sau email deja există'
            });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Insert new user
        const [result] = await pool.execute(
            'INSERT INTO admin_users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, hashedPassword]
        );
        
        res.status(201).json({
            success: true,
            message: 'Utilizator admin creat cu succes',
            user: {
                id: result.insertId,
                username,
                email
            }
        });
        
    } catch (error) {
        console.error('Error creating admin user:', error);
        res.status(500).json({
            success: false,
            error: 'Eroare la crearea utilizatorului'
        });
    }
});

// === ADVANCED GALLERY FEATURES ===

// Get gallery statistics
app.get('/api/gallery/stats', async (req, res) => {
    try {
        const gallery = await readData(dataPath.gallery);
        
        const stats = {
            total_images: gallery.length,
            total_size: gallery.reduce((sum, img) => sum + (img.size || 0), 0),
            avg_size: gallery.length > 0 ? gallery.reduce((sum, img) => sum + (img.size || 0), 0) / gallery.length : 0,
            recent_uploads: gallery.filter(img => {
                const uploadDate = new Date(img.uploadDate);
                const weekAgo = new Date();
                weekAgo.setDate(weekAgo.getDate() - 7);
                return uploadDate > weekAgo;
            }).length,
            file_types: gallery.reduce((acc, img) => {
                const extension = img.filename ? img.filename.split('.').pop().toLowerCase() : 'unknown';
                acc[extension] = (acc[extension] || 0) + 1;
                return acc;
            }, {})
        };
        
        res.json({
            success: true,
            stats
        });
        
    } catch (error) {
        console.error('Error getting gallery stats:', error);
        res.status(500).json({
            success: false,
            error: 'Eroare la încărcarea statisticilor'
        });
    }
});

// === BACKUP AND MAINTENANCE ROUTES ===

// Create data backup
app.post('/api/backup', async (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, 'backups', timestamp);
        
        // Create backup directory
        await fs.mkdir(backupDir, { recursive: true });
        
        // Backup JSON files
        const dataFiles = ['hero', 'about', 'programs', 'schedule', 'spaces', 'gallery', 'testimonials', 'contact'];
        
        for (const file of dataFiles) {
            try {
                const data = await readData(dataPath[file]);
                await fs.writeFile(
                    path.join(backupDir, `${file}.json`), 
                    JSON.stringify(data, null, 2)
                );
            } catch (fileError) {
                console.warn(`Could not backup ${file}:`, fileError.message);
            }
        }
        
        // Backup database
        try {
            const [messages] = await pool.execute('SELECT * FROM messages ORDER BY created_at DESC');
            await fs.writeFile(
                path.join(backupDir, 'messages_db.json'),
                JSON.stringify(messages, null, 2)
            );
            
            const [emailLogs] = await pool.execute('SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT 1000');
            await fs.writeFile(
                path.join(backupDir, 'email_logs.json'),
                JSON.stringify(emailLogs, null, 2)
            );
        } catch (dbError) {
            console.warn('Database backup partial failure:', dbError.message);
        }
        
        res.json({
            success: true,
            message: 'Backup creat cu succes',
            backup_path: backupDir,
            timestamp
        });
        
    } catch (error) {
        console.error('Error creating backup:', error);
        res.status(500).json({
            success: false,
            error: 'Eroare la crearea backup-ului'
        });
    }
});

// System health check
app.get('/api/health', async (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {},
            disk_usage: {},
            memory_usage: process.memoryUsage()
        };
        
        // Check database connection
        try {
            await pool.execute('SELECT 1');
            health.services.database = 'connected';
        } catch (dbError) {
            health.services.database = 'error';
            health.status = 'degraded';
        }
        
        // Check email service
        health.services.email = emailTransporter ? 'configured' : 'not_configured';
        
        // Check file system
        try {
            const imagesDir = path.join(__dirname, 'casadenis-project', 'public', 'images');
            const files = await fs.readdir(imagesDir);
            health.disk_usage.images_count = files.length;
        } catch (fsError) {
            health.disk_usage.error = 'Could not read images directory';
        }
        
        // Check data files
        for (const [key, filePath] of Object.entries(dataPath)) {
            try {
                await fs.access(filePath);
                health.disk_usage[`${key}_file`] = 'exists';
            } catch {
                health.disk_usage[`${key}_file`] = 'missing';
            }
        }
        
        res.json(health);
        
    } catch (error) {
        console.error('Health check error:', error);
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// === ERROR HANDLING MIDDLEWARE ===

// Handle multer errors
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'Fișierul este prea mare. Mărimea maximă permisă este 5MB.'
            });
        }
        return res.status(400).json({
            success: false,
            error: 'Eroare la încărcarea fișierului: ' + error.message
        });
    }
    
    if (error.message.includes('Only JPG, PNG')) {
        return res.status(400).json({
            success: false,
            error: error.message
        });
    }
    
    next(error);
});

// General error handler
app.use((error, req, res, next) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Eroare internă a serverului'
    });
});

// === CONTACT MESSAGES API (MySQL-based) ===

// Create new contact message
app.post('/api/contact/submit', async (req, res) => {
    try {
        const { 
            name, email, phone, message_type, message,
            child_name, child_age, allergies, medical_issues, 
            preferred_activities 
        } = req.body;
        
        console.log('📝 Received contact form submission:', { name, email, message_type });
        
        // Validate required fields
        if (!name || !email || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'Numele, email-ul și mesajul sunt obligatorii' 
            });
        }

        // Save to MySQL database
        const [result] = await pool.execute(
            `INSERT INTO messages (name, email, phone, message, message_type, status, child_name, child_age, allergies, medical_issues, preferred_activities, ip_address, user_agent, created_at) 
             VALUES (?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                name.trim(),
                email.trim(),
                phone ? phone.trim() : null,
                message.trim(),
                message_type || 'contact',
                child_name ? child_name.trim() : null,
                child_age ? parseInt(child_age) : null,
                allergies ? allergies.trim() : null,
                medical_issues ? medical_issues.trim() : null,
                preferred_activities ? preferred_activities.trim() : null,
                req.ip,
                req.get('User-Agent')
            ]
        );

        const messageId = result.insertId;
        console.log('✅ Message saved to database with ID:', messageId);

        // Send email notification to admin
        if (emailTransporter) {
            try {
                const messageTypeMap = {
                    'contact': 'Întrebare generală',
                    'enrollment': 'Înscriere copil',
                    'rental_inquiry': 'Închiriere spațiu'
                };
                
                // Create enrollment data object for email
                const enrollmentData = {
                    name, email, phone, message_type, message,
                    child_name, child_age, allergies, medical_issues,
                    preferred_activities
                };

                const emailHTML = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f8fafc;">
                        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                            <h2 style="color: #7c3aed; text-align: center; margin-bottom: 30px;">
                                🏠 Mesaj nou de pe Casa Denis
                            </h2>
                            
                            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                                <h3 style="color: #374151; margin: 0 0 15px 0;">Detalii contact:</h3>
                                <p style="margin: 5px 0;"><strong>Nume:</strong> ${name}</p>
                                <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
                                ${phone ? `<p style="margin: 5px 0;"><strong>Telefon:</strong> ${phone}</p>` : ''}
                                <p style="margin: 5px 0;"><strong>Tipul mesajului:</strong> ${messageTypeMap[message_type] || message_type}</p>
                                ${child_name ? `<p style="margin: 5px 0;"><strong>👶 Numele copilului:</strong> ${child_name}</p>` : ''}
                                ${child_age ? `<p style="margin: 5px 0;"><strong>🎂 Vârsta copilului:</strong> ${child_age} ani</p>` : ''}
                                ${allergies ? `<p style="margin: 5px 0;"><strong>🚫 Alergii:</strong> ${allergies}</p>` : ''}
                                ${medical_issues ? `<p style="margin: 5px 0;"><strong>🏥 Probleme medicale:</strong> ${medical_issues}</p>` : ''}
                                ${preferred_activities ? `<p style="margin: 5px 0;"><strong>🎨 Activități preferate:</strong> ${preferred_activities}</p>` : ''}

                                <p style="margin: 5px 0;"><strong>ID mesaj:</strong> #${messageId}</p>
                            </div>
                            
                            <div style="background: #eff6ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
                                <h3 style="color: #1e40af; margin: 0 0 15px 0;">Mesajul:</h3>
                                <p style="line-height: 1.6; color: #374151; white-space: pre-wrap;">${message}</p>
                            </div>
                            
                            <div style="text-align: center; margin-top: 30px;">
                                <a href="http://localhost:${port}/admin.html#messages" 
                                   style="background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; 
                                          border-radius: 6px; display: inline-block; font-weight: bold;">
                                    Vezi în Admin Panel
                                </a>
                            </div>
                        </div>
                    </div>
                `;

                await emailTransporter.sendMail({
                    from: `"Casa Denis Website" <casa.denis2025@gmail.com>`,
                    to: 'casa.denis2025@gmail.com',
                    subject: `🏠 Mesaj nou: ${messageTypeMap[message_type] || 'Contact'} - ${name}`,
                    html: emailHTML
                });

                console.log('📧 Email notification sent successfully');
            } catch (emailError) {
                console.error('❌ Error sending email notification:', emailError);
                // Don't fail the whole request if email fails
            }
        }

        res.json({ 
            success: true, 
            message: 'Mesajul a fost trimis cu succes! Îți vom răspunde în cel mai scurt timp posibil.',
            id: messageId
        });

    } catch (error) {
        console.error('Error submitting contact message:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Eroare la trimiterea mesajului. Te rugăm să încerci din nou.' 
        });
    }
});

// Get all contact messages (for admin)
app.get('/api/contact/messages', async (req, res) => {
    try {
        const { 
            status, 
            type, 
            page = 1, 
            limit = 20, 
            search,
            dateFrom,
            dateTo 
        } = req.query;
        
        // Get all messages from database
        const [rows] = await pool.execute('SELECT * FROM messages ORDER BY created_at DESC');
        
        // Apply filters
        let filteredMessages = rows;
        
        if (status) {
            filteredMessages = filteredMessages.filter(msg => msg.status === status);
        }
        
        if (type) {
            filteredMessages = filteredMessages.filter(msg => msg.message_type === type);
        }
        
        if (search) {
            const searchLower = search.toLowerCase();
            filteredMessages = filteredMessages.filter(msg => 
                msg.name.toLowerCase().includes(searchLower) ||
                msg.email.toLowerCase().includes(searchLower) ||
                msg.message.toLowerCase().includes(searchLower)
            );
        }
        
        if (dateFrom) {
            filteredMessages = filteredMessages.filter(msg => 
                new Date(msg.created_at) >= new Date(dateFrom)
            );
        }
        
        if (dateTo) {
            filteredMessages = filteredMessages.filter(msg => 
                new Date(msg.created_at) <= new Date(dateTo + ' 23:59:59')
            );
        }
        
        // Sort by date (newest first)
        filteredMessages.sort((a, b) => 
            new Date(b.created_at) - new Date(a.created_at)
        );
        
        // If pagination is requested, apply it
        if (req.query.page || req.query.limit) {
            const offset = (page - 1) * limit;
            const paginatedMessages = filteredMessages.slice(offset, offset + parseInt(limit));
            
            const total = filteredMessages.length;
            
            res.json({
                success: true,
                messages: paginatedMessages,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: total,
                    pages: Math.ceil(total / limit),
                    hasNext: parseInt(page) < Math.ceil(total / limit),
                    hasPrev: parseInt(page) > 1
                }
            });
        } else {
            // Return just the messages array for backward compatibility with frontend
            res.json(filteredMessages || []);
        }
    } catch (error) {
        console.error('Error fetching contact messages:', error);
        res.status(500).json({ error: 'Error fetching messages' });
    }
});

// Update message status (mark as read/replied)
app.put('/api/contact/messages/:id', async (req, res) => {
    try {
        const messageId = parseInt(req.params.id);
        const { status } = req.body;

        await pool.execute(
            'UPDATE messages SET status = ?, updated_at = NOW() WHERE id = ?',
            [status, messageId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating message:', error);
        res.status(500).json({ error: 'Error updating message' });
    }
});

// Delete contact message
app.delete('/api/contact/messages/:id', async (req, res) => {
    try {
        const messageId = parseInt(req.params.id);

        await pool.execute('DELETE FROM messages WHERE id = ?', [messageId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ error: 'Error deleting message' });
    }
});

// Get contact statistics
app.get('/api/contact/stats', async (req, res) => {
    try {
        const [totalRows] = await pool.execute('SELECT COUNT(*) as total FROM messages');
        const [unreadRows] = await pool.execute('SELECT COUNT(*) as unread FROM messages WHERE status = "new"');
        const [todayRows] = await pool.execute('SELECT COUNT(*) as today FROM messages WHERE DATE(created_at) = CURDATE()');
        const [enrollmentRows] = await pool.execute('SELECT COUNT(*) as enrollments FROM messages WHERE message_type = "enrollment"');

        res.json({
            total: totalRows[0].total,
            unread: unreadRows[0].unread,
            today: todayRows[0].today,
            enrollments: enrollmentRows[0].enrollments
        });
    } catch (error) {
        console.error('Error fetching contact stats:', error);
        res.status(500).json({ error: 'Error fetching statistics' });
    }
});




// === GRACEFUL SHUTDOWN ===

process.on('SIGTERM', async () => {
    console.log('🔄 SIGTERM received, shutting down gracefully...');
    
    // Close database pool
    try {
        await pool.end();
        console.log('✅ Database connections closed');
    } catch (error) {
        console.error('❌ Error closing database:', error);
    }
    
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('\n🔄 SIGINT received, shutting down gracefully...');
    
    try {
        await pool.end();
        console.log('✅ Database connections closed');
    } catch (error) {
        console.error('❌ Error closing database:', error);
    }
    
    process.exit(0);
});

// Root route
app.get('/', (req, res) => {
    res.json({
        message: 'Casa Denis API is running! 🏠✨',
        version: '2.0.0',
        features: [
            '📧 Email notifications',
            '🗄️ MySQL database',
            '🖼️ Enhanced gallery management',
            '📊 Message statistics',
            '🔧 Admin dashboard',
            '💾 Automatic backups',
            '📈 Health monitoring'
        ],
        endpoints: {
            messages: '/api/messages',
            gallery: '/api/gallery',
            email_settings: '/api/email-settings',
            backup: '/api/backup',
            health: '/api/health'
        }
    });
});

// Start server
app.listen(port, () => {
    console.log('\n🚀 ================================');
    console.log(`🚀 Casa Denis Server STARTED!`);
    console.log(`🚀 ================================`);
    console.log(`🌐 Server URL: http://localhost:${port}`);
    console.log(`📧 Email notifications: ${emailTransporter ? '✅ ENABLED' : '❌ DISABLED'}`);
    console.log(`🗄️ MySQL database: ✅ CONNECTED`);
    console.log(`🖼️ Gallery management: ✅ ENABLED`);
    console.log(`📊 Statistics: ✅ ENABLED`);
    console.log(`💾 Backup system: ✅ ENABLED`);
    console.log(`🚀 ================================\n`);
    
    // Optional: Create initial backup on startup
    setTimeout(async () => {
        try {
            console.log('📦 Creating initial backup...');
            const response = await fetch(`http://localhost:${port}/api/backup`, {
                method: 'POST'
            });
            if (response.ok) {
                console.log('✅ Initial backup created successfully');
            }
        } catch (error) {
            console.log('⚠️ Could not create initial backup:', error.message);
        }
    }, 5000);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use!`);
        console.log(`💡 Solutions:`);
        console.log(`   1. Stop other processes: taskkill /F /IM node.exe`);
        console.log(`   2. Use different port: PORT=8081 node server.js`);
        console.log(`   3. Check running processes: netstat -ano | findstr :${port}`);
        process.exit(1);
    } else {
        console.error('❌ Server error:', err);
        process.exit(1);
    }
});

// === BACKUP FUNCTIONS ===

// Backup pentru Gallery
async function backupGallery() {
    try {
        const galleryPath = path.join(__dirname, 'data', 'gallery.json');
        const backupDir = path.join(__dirname, 'backups', 'gallery');
        
        // Creează directorul de backup dacă nu există
        await fs.mkdir(backupDir, { recursive: true });
        
        // Citește datele curente
        const galleryData = await fs.readFile(galleryPath, 'utf8');
        
        // Creează numele fișierului de backup cu timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `gallery_backup_${timestamp}.json`;
        const backupPath = path.join(backupDir, backupFileName);
        
        // Salvează backup-ul
        await fs.writeFile(backupPath, galleryData, 'utf8');
        
        // Păstrează doar ultimele 10 backup-uri
        await cleanOldBackups(backupDir, 10);
        
        console.log(`✅ Gallery backup created: ${backupFileName}`);
        return { success: true, file: backupFileName };
    } catch (error) {
        console.error('❌ Error creating gallery backup:', error);
        return { success: false, error: error.message };
    }
}

// Backup pentru Spaces
async function backupSpaces() {
    try {
        const spacesPath = path.join(__dirname, 'data', 'spaces.json');
        const backupDir = path.join(__dirname, 'backups', 'spaces');
        
        await fs.mkdir(backupDir, { recursive: true });
        
        const spacesData = await fs.readFile(spacesPath, 'utf8');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `spaces_backup_${timestamp}.json`;
        const backupPath = path.join(backupDir, backupFileName);
        
        await fs.writeFile(backupPath, spacesData, 'utf8');
        await cleanOldBackups(backupDir, 10);
        
        console.log(`✅ Spaces backup created: ${backupFileName}`);
        return { success: true, file: backupFileName };
    } catch (error) {
        console.error('❌ Error creating spaces backup:', error);
        return { success: false, error: error.message };
    }
}

// Backup pentru Testimonials
async function backupTestimonials() {
    try {
        const testimonialsPath = path.join(__dirname, 'data', 'testimonials.json');
        const backupDir = path.join(__dirname, 'backups', 'testimonials');
        
        await fs.mkdir(backupDir, { recursive: true });
        
        const testimonialsData = await fs.readFile(testimonialsPath, 'utf8');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `testimonials_backup_${timestamp}.json`;
        const backupPath = path.join(backupDir, backupFileName);
        
        await fs.writeFile(backupPath, testimonialsData, 'utf8');
        await cleanOldBackups(backupDir, 10);
        
        console.log(`✅ Testimonials backup created: ${backupFileName}`);
        return { success: true, file: backupFileName };
    } catch (error) {
        console.error('❌ Error creating testimonials backup:', error);
        return { success: false, error: error.message };
    }
}

// Backup complet pentru toate datele
async function backupAllData() {
    try {
        const backupDir = path.join(__dirname, 'backups', 'complete');
        await fs.mkdir(backupDir, { recursive: true });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `complete_backup_${timestamp}.json`;
        
        // Citește toate fișierele de date
        const [gallery, spaces, testimonials, programs, hero, about, contact] = await Promise.all([
            fs.readFile(path.join(__dirname, 'data', 'gallery.json'), 'utf8').catch(() => '[]'),
            fs.readFile(path.join(__dirname, 'data', 'spaces.json'), 'utf8').catch(() => '[]'),
            fs.readFile(path.join(__dirname, 'data', 'testimonials.json'), 'utf8').catch(() => '[]'),
            fs.readFile(path.join(__dirname, 'data', 'programs.json'), 'utf8').catch(() => '[]'),
            fs.readFile(path.join(__dirname, 'data', 'hero.json'), 'utf8').catch(() => '{}'),
            fs.readFile(path.join(__dirname, 'data', 'about.json'), 'utf8').catch(() => '{}'),
            fs.readFile(path.join(__dirname, 'data', 'contact.json'), 'utf8').catch(() => '{}')
        ]);
        
        // Creează obiectul de backup complet
        const completeBackup = {
            timestamp: new Date().toISOString(),
            version: "1.0",
            data: {
                gallery: JSON.parse(gallery),
                spaces: JSON.parse(spaces),
                testimonials: JSON.parse(testimonials),
                programs: JSON.parse(programs),
                hero: JSON.parse(hero),
                about: JSON.parse(about),
                contact: JSON.parse(contact)
            }
        };
        
        const backupPath = path.join(backupDir, backupFileName);
        await fs.writeFile(backupPath, JSON.stringify(completeBackup, null, 2), 'utf8');
        await cleanOldBackups(backupDir, 5);
        
        console.log(`✅ Complete backup created: ${backupFileName}`);
        return { success: true, file: backupFileName };
    } catch (error) {
        console.error('❌ Error creating complete backup:', error);
        return { success: false, error: error.message };
    }
}

// Funcție pentru a șterge backup-urile vechi
async function cleanOldBackups(backupDir, keepCount) {
    try {
        const files = await fs.readdir(backupDir);
        const backupFiles = files
            .filter(file => file.endsWith('.json'))
            .map(file => ({
                name: file,
                path: path.join(backupDir, file),
                time: fs.stat(path.join(backupDir, file)).then(stats => stats.mtime)
            }));
        
        // Așteaptă să obții timpii pentru toate fișierele
        for (let file of backupFiles) {
            file.time = await file.time;
        }
        
        // Sortează după timp (cel mai recent primul)
        backupFiles.sort((a, b) => b.time - a.time);
        
        // Șterge fișierele mai vechi decât keepCount
        if (backupFiles.length > keepCount) {
            const filesToDelete = backupFiles.slice(keepCount);
            for (let file of filesToDelete) {
                await fs.unlink(file.path);
                console.log(`🗑️ Deleted old backup: ${file.name}`);
            }
        }
    } catch (error) {
        console.error('❌ Error cleaning old backups:', error);
    }
}

// API Endpoints pentru backup-uri
app.post('/api/backup/gallery', async (req, res) => {
    try {
        const result = await backupGallery();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/backup/spaces', async (req, res) => {
    try {
        const result = await backupSpaces();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/backup/testimonials', async (req, res) => {
    try {
        const result = await backupTestimonials();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/backup/complete', async (req, res) => {
    try {
        const result = await backupAllData();
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint pentru a lista backup-urile
app.get('/api/backups', async (req, res) => {
    try {
        const backupsDir = path.join(__dirname, 'backups');
        const backupTypes = ['gallery', 'spaces', 'testimonials', 'complete'];
        const allBackups = {};
        
        for (let type of backupTypes) {
            try {
                const typeDir = path.join(backupsDir, type);
                const files = await fs.readdir(typeDir);
                const backupFiles = [];
                
                for (let file of files) {
                    if (file.endsWith('.json')) {
                        const filePath = path.join(typeDir, file);
                        const stats = await fs.stat(filePath);
                        backupFiles.push({
                            name: file,
                            size: stats.size,
                            created: stats.mtime,
                            type: type
                        });
                    }
                }
                
                allBackups[type] = backupFiles.sort((a, b) => b.created - a.created);
            } catch (error) {
                allBackups[type] = [];
            }
        }
        
        res.json(allBackups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Programează backup-uri automate
function scheduleAutomaticBackups() {
    // Backup zilnic la 2:00 AM
    const scheduleDaily = () => {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(2, 0, 0, 0);
        
        const msUntilBackup = tomorrow.getTime() - now.getTime();
        
        setTimeout(async () => {
            console.log('🕐 Running scheduled daily backup...');
            await backupAllData();
            scheduleDaily(); // Programează următorul backup
        }, msUntilBackup);
        
        console.log(`📅 Next automatic backup scheduled for: ${tomorrow.toLocaleString('ro-RO')}`);
    };
    
    scheduleDaily();
    
    // Backup la fiecare 6 ore pentru gallery (cea mai activă secțiune)
    setInterval(async () => {
        console.log('🕕 Running scheduled gallery backup...');
        await backupGallery();
    }, 6 * 60 * 60 * 1000); // 6 ore
}

// Pornește programarea backup-urilor automate
scheduleAutomaticBackups();

// Detailed Content Management
app.get('/api/admin/content/:section', authenticateAdmin, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM detailed_content WHERE section = ?',
            [req.params.section]
        );
        
        if (rows.length === 0) {
            return res.json({
                title: '',
                subtitle: '',
                content: '',
                icon: '',
                image: ''
            });
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('Content fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch content' });
    }
});

app.post('/api/admin/content/:section', authenticateAdmin, async (req, res) => {
    try {
        const { title, subtitle, content, icon } = req.body;
        const section = req.params.section;
        let imagePath = null;
        
        // Handle image upload if present
        if (req.files && req.files.image) {
            const image = req.files.image;
            const uploadPath = path.join(__dirname, 'casadenis-project/public/images/detailed');
            
            // Create directory if it doesn't exist
            if (!fs.existsSync(uploadPath)) {
                fs.mkdirSync(uploadPath, { recursive: true });
            }
            
            const fileName = `${section}-${Date.now()}${path.extname(image.name)}`;
            imagePath = `/images/detailed/${fileName}`;
            
            await image.mv(path.join(uploadPath, fileName));
        }
        
        // Check if content exists
        const [existing] = await pool.execute(
            'SELECT id FROM detailed_content WHERE section = ?',
            [section]
        );
        
        if (existing.length > 0) {
            // Update existing content
            await pool.execute(
                `UPDATE detailed_content 
                 SET title = ?, subtitle = ?, content = ?, icon = ?, 
                     image = COALESCE(?, image), updated_at = CURRENT_TIMESTAMP
                 WHERE section = ?`,
                [title, subtitle, content, icon, imagePath, section]
            );
        } else {
            // Insert new content
            await pool.execute(
                `INSERT INTO detailed_content 
                 (section, title, subtitle, content, icon, image)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [section, title, subtitle, content, icon, imagePath]
            );
        }
        
        // Get updated content
        const [updated] = await pool.execute(
            'SELECT * FROM detailed_content WHERE section = ?',
            [section]
        );
        
        res.json(updated[0]);
    } catch (error) {
        console.error('Content save error:', error);
        res.status(500).json({ error: 'Failed to save content' });
    }
});

// About Detailed endpoints
app.get('/api/about-detailed', async (req, res) => {
    try {
        const aboutDetailed = await readData(path.join(__dirname, 'data', 'about-detailed.json'));
        res.json(aboutDetailed || getDefaultAboutDetailed());
    } catch (error) {
        console.error('Error loading about detailed:', error);
        res.json(getDefaultAboutDetailed());
    }
});

app.post('/api/about-detailed', async (req, res) => {
    try {
        let aboutDetailed = await readData(path.join(__dirname, 'data', 'about-detailed.json')) || getDefaultAboutDetailed();
        const { section, ...data } = req.body;
        
        // Update specific section or entire object
        if (section) {
            aboutDetailed[section] = data[section] || data;
        } else {
            aboutDetailed = { ...aboutDetailed, ...data };
        }
        
        const success = await writeData(path.join(__dirname, 'data', 'about-detailed.json'), aboutDetailed);
        if (success) {
            res.json({ success: true, message: 'About detailed updated successfully' });
        } else {
            res.status(500).json({ success: false, message: 'Failed to update about detailed' });
        }
    } catch (error) {
        console.error('Error saving about detailed:', error);
        res.status(500).json({ success: false, message: 'Failed to update about detailed' });
    }
});

// Specific endpoints for about-detailed sections
app.get('/api/about-detailed/hero', async (req, res) => {
    try {
        const aboutDetailed = await readData(path.join(__dirname, 'data', 'about-detailed.json')) || getDefaultAboutDetailed();
        res.json(aboutDetailed.hero || {
            title: "Povestea Casa Denis",
            subtitle: "Un centru after-school creat cu dragoste pentru dezvoltarea armonioasă a copiilor"
        });
    } catch (error) {
        console.error('Error loading hero section:', error);
        res.json({ title: "", subtitle: "" });
    }
});

app.get('/api/about-detailed/mission', async (req, res) => {
    try {
        const aboutDetailed = await readData(path.join(__dirname, 'data', 'about-detailed.json')) || getDefaultAboutDetailed();
        res.json(aboutDetailed.mission || {
            content: "La Casa Denis, credem că fiecare copil merită să crească într-un mediu sigur, stimulativ și plin de dragoste."
        });
    } catch (error) {
        console.error('Error loading mission section:', error);
        res.json({ content: "" });
    }
});

app.get('/api/about-detailed/stats', async (req, res) => {
    try {
        const aboutDetailed = await readData(path.join(__dirname, 'data', 'about-detailed.json')) || getDefaultAboutDetailed();
        res.json(aboutDetailed.stats || {
            children: "50+",
            years: "3+",
            satisfaction: "100%",
            hours: "11h"
        });
    } catch (error) {
        console.error('Error loading stats section:', error);
        res.json({ children: "", years: "", satisfaction: "", hours: "" });
    }
});

app.get('/api/about-detailed/values', async (req, res) => {
    try {
        const aboutDetailed = await readData(path.join(__dirname, 'data', 'about-detailed.json')) || getDefaultAboutDetailed();
        res.json(aboutDetailed.values || {
            title: "Valorile Noastre",
            items: [
                {
                    icon: "fas fa-heart",
                    title: "Dragoste și Grijă",
                    description: "Fiecare copil este tratat cu dragoste și înțelegere"
                },
                {
                    icon: "fas fa-shield-alt",
                    title: "Siguranță",
                    description: "Mediu sigur și protejat pentru toți copiii"
                }
            ]
        });
    } catch (error) {
        console.error('Error loading values section:', error);
        res.json({ title: "Valorile Noastre", items: [] });
    }
});

app.get('/api/about-detailed/facilities', async (req, res) => {
    try {
        const aboutDetailed = await readData(path.join(__dirname, 'data', 'about-detailed.json')) || getDefaultAboutDetailed();
        res.json(aboutDetailed.facilities || {
            title: "Facilitățile Noastre",
            description: "Casa Denis dispune de spații moderne și bine echipate pentru diverse activități:",
            items: [
                "Săli de clasă luminoase și ventilate",
                "Zonă de joacă interioară și exterioară",
                "Bucătărie echipată pentru prepararea meselor"
            ]
        });
    } catch (error) {
        console.error('Error loading facilities section:', error);
        res.json({ title: "Facilitățile Noastre", description: "", items: [] });
    }
});

app.get('/api/about-detailed/services', async (req, res) => {
    try {
        const aboutDetailed = await readData(path.join(__dirname, 'data', 'about-detailed.json')) || getDefaultAboutDetailed();
        res.json(aboutDetailed.services || {
            title: "Serviciile Noastre",
            items: [
                {
                    title: "Spații de joacă interior",
                    description: "Zone sigure și moderne pentru activități recreative în interior",
                    icon: "fas fa-gamepad",
                    color: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                },
                {
                    title: "Spații de joacă exterior",
                    description: "Grădină amenajată cu echipamente de joacă în aer liber",
                    icon: "fas fa-tree",
                    color: "linear-gradient(135deg, #48bb78 0%, #38a169 100%)"
                }
            ]
        });
    } catch (error) {
        console.error('Error loading services section:', error);
        res.json({ title: "Serviciile Noastre", items: [] });
    }
});

app.get('/api/about-detailed/pricing', async (req, res) => {
    try {
        const aboutDetailed = await readData(path.join(__dirname, 'data', 'about-detailed.json')) || getDefaultAboutDetailed();
        res.json(aboutDetailed.pricing || {
            title: "Prețurile Noastre",
            plans: [
                {
                    name: "Program Complet",
                    price: "400 RON/lună",
                    description: "Program complet cu toate activitățile incluse",
                    features: ["Asistență teme", "Activități creative", "Mese incluse"]
                },
                {
                    name: "Program Parțial",
                    price: "250 RON/lună",
                    description: "Program adaptat nevoilor specifice",
                    features: ["Asistență teme", "Gustare inclusă"]
                }
            ]
        });
    } catch (error) {
        console.error('Error loading pricing section:', error);
        res.json({ title: "Prețurile Noastre", plans: [] });
    }
});

app.get('/api/about-detailed/history', async (req, res) => {
    try {
        const aboutDetailed = await readData(path.join(__dirname, 'data', 'about-detailed.json')) || getDefaultAboutDetailed();
        res.json(aboutDetailed.history || {
            title: "Povestea Noastră",
            content: "Casa Denis a fost înființată în 2022 cu scopul de a oferi un mediu sigur și stimulativ pentru copii.",
            timeline: [
                {
                    year: "2022",
                    title: "Înființarea Casa Denis",
                    description: "Am deschis primul nostru centru cu 20 de copii"
                },
                {
                    year: "2023",
                    title: "Extinderea serviciilor",
                    description: "Am adăugat noi programe și activități"
                }
            ]
        });
    } catch (error) {
        console.error('Error loading history section:', error);
        res.json({ title: "Povestea Noastră", content: "", timeline: [] });
    }
});

// PUT endpoints for updating about-detailed sections
app.put('/api/about-detailed/hero', async (req, res) => {
    try {
        const { title, subtitle } = req.body;
        const aboutDetailedPath = path.join(__dirname, 'data', 'about-detailed.json');
        let aboutDetailed = await readData(aboutDetailedPath) || getDefaultAboutDetailed();
        
        aboutDetailed.hero = { title, subtitle };
        await writeData(aboutDetailedPath, aboutDetailed);
        
        res.json({ success: true, message: 'Hero section updated successfully' });
    } catch (error) {
        console.error('Error updating hero section:', error);
        res.status(500).json({ success: false, error: 'Failed to update hero section' });
    }
});

app.put('/api/about-detailed/mission', async (req, res) => {
    try {
        const missionContent = req.body;
        const aboutDetailedPath = path.join(__dirname, 'data', 'about-detailed.json');
        let aboutDetailed = await readData(aboutDetailedPath) || getDefaultAboutDetailed();
        
        aboutDetailed.mission = missionContent;
        await writeData(aboutDetailedPath, aboutDetailed);
        
        res.json({ success: true, message: 'Mission section updated successfully' });
    } catch (error) {
        console.error('Error updating mission section:', error);
        res.status(500).json({ success: false, error: 'Failed to update mission section' });
    }
});

app.put('/api/about-detailed/stats', async (req, res) => {
    try {
        const stats = req.body;
        const aboutDetailedPath = path.join(__dirname, 'data', 'about-detailed.json');
        let aboutDetailed = await readData(aboutDetailedPath) || getDefaultAboutDetailed();
        
        aboutDetailed.stats = stats;
        await writeData(aboutDetailedPath, aboutDetailed);
        
        res.json({ success: true, message: 'Stats section updated successfully' });
    } catch (error) {
        console.error('Error updating stats section:', error);
        res.status(500).json({ success: false, error: 'Failed to update stats section' });
    }
});

app.put('/api/about-detailed/values', async (req, res) => {
    try {
        console.log('📝 PUT /api/about-detailed/values - Received data:', JSON.stringify(req.body, null, 2));
        const values = req.body;
        const aboutDetailedPath = path.join(__dirname, 'data', 'about-detailed.json');
        let aboutDetailed = await readData(aboutDetailedPath) || getDefaultAboutDetailed();
        
        aboutDetailed.values = values;
        const writeResult = await writeData(aboutDetailedPath, aboutDetailed);
        console.log('💾 Write result:', writeResult);
        
        res.json({ success: true, message: 'Values section updated successfully' });
    } catch (error) {
        console.error('❌ Error updating values section:', error);
        res.status(500).json({ success: false, error: 'Failed to update values section' });
    }
});

app.put('/api/about-detailed/facilities', async (req, res) => {
    try {
        const facilities = req.body;
        const aboutDetailedPath = path.join(__dirname, 'data', 'about-detailed.json');
        let aboutDetailed = await readData(aboutDetailedPath) || getDefaultAboutDetailed();
        
        aboutDetailed.facilities = facilities;
        await writeData(aboutDetailedPath, aboutDetailed);
        
        res.json({ success: true, message: 'Facilities section updated successfully' });
    } catch (error) {
        console.error('Error updating facilities section:', error);
        res.status(500).json({ success: false, error: 'Failed to update facilities section' });
    }
});

app.put('/api/about-detailed/services', async (req, res) => {
    try {
        console.log('📝 PUT /api/about-detailed/services - Received data:', JSON.stringify(req.body, null, 2));
        const services = req.body;
        
        // Safeguard: Don't save if data is empty or invalid
        if (!services.data || !Array.isArray(services.data) || services.data.length === 0) {
            console.log('⚠️ Rejecting empty services data - keeping existing services');
            return res.status(400).json({ 
                success: false, 
                error: 'Cannot save empty services. Please add at least one service.' 
            });
        }
        
        const aboutDetailedPath = path.join(__dirname, 'data', 'about-detailed.json');
        let aboutDetailed = await readData(aboutDetailedPath) || getDefaultAboutDetailed();
        
        aboutDetailed.services = services;
        const writeResult = await writeData(aboutDetailedPath, aboutDetailed);
        console.log('💾 Write result:', writeResult);
        
        res.json({ success: true, message: 'Services section updated successfully' });
    } catch (error) {
        console.error('❌ Error updating services section:', error);
        res.status(500).json({ success: false, error: 'Failed to update services section' });
    }
});

app.put('/api/about-detailed/pricing', async (req, res) => {
    try {
        const pricing = req.body;
        const aboutDetailedPath = path.join(__dirname, 'data', 'about-detailed.json');
        let aboutDetailed = await readData(aboutDetailedPath) || getDefaultAboutDetailed();
        
        aboutDetailed.pricing = pricing;
        await writeData(aboutDetailedPath, aboutDetailed);
        
        res.json({ success: true, message: 'Pricing section updated successfully' });
    } catch (error) {
        console.error('Error updating pricing section:', error);
        res.status(500).json({ success: false, error: 'Failed to update pricing section' });
    }
});

app.put('/api/about-detailed/history', async (req, res) => {
    try {
        const history = req.body;
        const aboutDetailedPath = path.join(__dirname, 'data', 'about-detailed.json');
        let aboutDetailed = await readData(aboutDetailedPath) || getDefaultAboutDetailed();
        
        aboutDetailed.history = history;
        await writeData(aboutDetailedPath, aboutDetailed);
        
        res.json({ success: true, message: 'History section updated successfully' });
    } catch (error) {
        console.error('Error updating history section:', error);
        res.status(500).json({ success: false, error: 'Failed to update history section' });
    }
});

// Funcție pentru date implicite about-detailed
function getDefaultAboutDetailed() {
    return {
        introduction: {
            title: "Despre Casa Denis",
            subtitle: "Centrul de zi pentru copii",
            description: "Casa Denis este un centru de zi dedicat îngrijirii și dezvoltării copiilor cu vârste între 3 și 14 ani. Oferim un mediu sigur, stimulativ și plin de dragoste, unde fiecare copil poate să crească, să învețe și să se dezvolte în mod armonios."
        },
        mission: {
            title: "Misiunea Noastră",
            content: [
                "Să oferim un spațiu sigur și prietenos pentru dezvoltarea copiilor",
                "Să sprijinim familiile prin servicii de calitate în îngrijirea copiilor",
                "Să promovăm învățarea prin joacă și activități creative",
                "Să dezvoltăm abilitățile sociale și emoționale ale copiilor"
            ]
        },
        team: {
            title: "Echipa Noastră",
            description: "Echipa Casa Denis este formată din educatori qualificați, cu experiență în lucrul cu copiii. Suntem pasionați de ceea ce facem și ne dedicăm să oferim cea mai bună îngrijire pentru copiii dumneavoastră.",
            members: [
                {
                    name: "Ana Popescu",
                    role: "Director și Educator Principal",
                    description: "Cu peste 10 ani de experiență în educația timpurie"
                },
                {
                    name: "Maria Ionescu",
                    role: "Educator",
                    description: "Specializată în activități creative și artistice"
                },
                {
                    name: "Elena Georgescu",
                    role: "Educator",
                    description: "Expert în dezvoltarea limbajului și comunicării"
                }
            ]
        },
        values: {
            title: "Valorile Noastre",
            items: [
                {
                    icon: "fas fa-heart",
                    title: "Dragoste și Grijă",
                    description: "Fiecare copil este tratat cu dragoste și înțelegere"
                },
                {
                    icon: "fas fa-shield-alt",
                    title: "Siguranță",
                    description: "Mediu sigur și protejat pentru toți copiii"
                },
                {
                    icon: "fas fa-graduation-cap",
                    title: "Educație de Calitate",
                    description: "Programe educaționale adaptate vârstei și nevoilor"
                },
                {
                    icon: "fas fa-users",
                    title: "Comunitate",
                    description: "Construim o comunitate unită și susținătoare"
                }
            ]
        },
        facilities: {
            title: "Facilitățile Noastre",
            description: "Casa Denis dispune de spații moderne și bine echipate pentru diverse activități:",
            items: [
                "Săli de clasă luminoase și ventilate",
                "Zonă de joacă interioară și exterioară",
                "Bucătărie echipată pentru prepararea meselor",
                "Spațiu pentru activități artistice",
                "Bibliotecă pentru copii",
                "Zonă de odihnă"
            ]
        }
    };
}

// Ensure required directories exist
async function ensureDirectories() {
    const directories = [
        path.join(__dirname, 'data'),
        path.join(__dirname, 'casadenis-project', 'public', 'images'),
        path.join(__dirname, 'backups')
    ];
    
    for (const dir of directories) {
        try {
            await fs.mkdir(dir, { recursive: true });
            console.log(`📁 Directory ensured: ${dir}`);
        } catch (error) {
            console.warn(`⚠️ Could not create directory ${dir}:`, error.message);
        }
    }
}

// Initialize the application
async function initializeApp() {
    console.log('🚀 Initializing Casa Denis Server...');
    await ensureDirectories();
    await setupDatabase();
    await setupEmailTransporter();
    console.log('✅ Initialization complete!');
}

// Start initialization
initializeApp().then(() => {
    console.log('🚀 Ready to start server...');
}).catch(error => {
    console.error('❌ Initialization failed:', error);
    process.exit(1);
});

// 404 handler

// Update existing gallery images with dimension data (one-time migration)
app.post('/api/gallery/analyze-dimensions', async (req, res) => {
    try {
        const gallery = await readData(dataPath.gallery);
        const sharp = require('sharp');
        let updatedCount = 0;
        
        for (let i = 0; i < gallery.length; i++) {
            const image = gallery[i];
            
            // Skip if already has dimension data
            if (image.width && image.height && image.imageType) {
                continue;
            }
            
            try {
                const imagePath = path.join(__dirname, 'casadenis-project', 'public', image.src);
                const metadata = await sharp(imagePath).metadata();
                
                const width = metadata.width || 0;
                const height = metadata.height || 0;
                const aspectRatio = width > 0 && height > 0 ? width / height : 1;
                
                // Determine image type
                let imageType = 'square';
                if (aspectRatio > 1.3) {
                    imageType = 'wide';
                } else if (aspectRatio < 0.8) {
                    imageType = 'tall';
                }
                
                // Update the image object
                gallery[i] = {
                    ...image,
                    width,
                    height,
                    aspectRatio,
                    imageType
                };
                
                updatedCount++;
                console.log(`📏 Updated dimensions for ${image.filename}: ${width}x${height} (${imageType})`);
                
            } catch (dimensionError) {
                console.warn(`Could not analyze ${image.filename}:`, dimensionError.message);
            }
        }
        
        // Save updated gallery
        if (updatedCount > 0) {
            await writeData(dataPath.gallery, gallery);
        }
        
        res.json({
            success: true,
            message: `${updatedCount} imagini au fost actualizate cu date de dimensiuni`,
            updatedCount,
            totalImages: gallery.length
        });
        
    } catch (error) {
        console.error('Error analyzing gallery dimensions:', error);
        res.status(500).json({
            success: false,
            error: 'Eroare la analizarea dimensiunilor imaginilor'
        });
    }
});

// Bulk operations for gallery
// Bulk Upload Functions for Admin Panel

// Bulk upload functions moved to admin.html

