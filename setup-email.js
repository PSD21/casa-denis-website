const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

console.log('📧 Casa Denis Email Setup Helper\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
    console.log('❌ .env file not found!');
    console.log('📝 Creating .env template...\n');
    
    const envTemplate = `# Gmail Configuration for Casa Denis
# Get your App Password from: https://myaccount.google.com/apppasswords
EMAIL_PASS=your_16_character_app_password_here

# Database Configuration
DB_HOST=localhost 
DB_USER=root
DB_PASSWORD=password
DB_NAME=casa_denis_db

# Server Configuration
PORT=3002`;

    fs.writeFileSync(envPath, envTemplate);
    console.log('✅ Created .env template file');
    console.log('📋 Next steps:');
    console.log('   1. Go to https://myaccount.google.com/apppasswords');
    console.log('   2. Generate an App Password for Casa Denis');
    console.log('   3. Edit .env file and replace "your_16_character_app_password_here"');
    console.log('   4. Run this script again to test: node setup-email.js');
    process.exit(0);
}

// Check if App Password is configured
const emailPass = process.env.EMAIL_PASS;
if (!emailPass || emailPass === 'your_16_character_app_password_here') {
    console.log('⚠️ Gmail App Password not configured!');
    console.log('📧 Steps to fix:');
    console.log('   1. Go to https://myaccount.google.com/apppasswords');
    console.log('   2. Generate an App Password for "Casa Denis Server"');
    console.log('   3. Edit .env file and set EMAIL_PASS=your_app_password');
    console.log('   4. Remove any spaces from the App Password');
    process.exit(1);
}

// Test email configuration
async function testEmailSetup() {
    console.log('🔧 Testing email configuration...\n');
    
    try {
        console.log('📨 Email address: casa.denis2025@gmail.com');
        console.log('🔑 App Password: ' + '*'.repeat(emailPass.length) + ' (hidden)');
        console.log('🏷️ Length:', emailPass.length, 'characters');
        
        if (emailPass.length !== 16) {
            console.log('⚠️ Warning: App Password should be exactly 16 characters');
            console.log('💡 Tip: Remove any spaces from the App Password');
        }
        
        console.log('\n🔗 Creating email transporter...');
        
        const transporter = nodemailer.createTransport({
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
        
        console.log('✅ Transporter created');
        console.log('🔍 Verifying connection...');
        
        await transporter.verify();
        
        console.log('\n🎉 SUCCESS! Email configuration is working!');
        console.log('✅ Gmail authentication successful');
        console.log('✅ SMTP connection verified');
        console.log('\n📋 What this means:');
        console.log('   ✅ Contact form notifications will work');
        console.log('   ✅ Confirmation emails will be sent');
        console.log('   ✅ Admin notifications enabled');
        
        console.log('\n🚀 Ready to start server with: node server.js');
        
    } catch (error) {
        console.log('\n❌ Email setup failed!');
        console.log('🔍 Error details:', error.message);
        
        if (error.message.includes('Invalid login')) {
            console.log('\n💡 Solutions:');
            console.log('   1. Double-check the App Password (should be 16 chars)');
            console.log('   2. Make sure 2-Step Verification is enabled');
            console.log('   3. Generate a new App Password if needed');
            console.log('   4. Remove any spaces from the password');
        } else if (error.message.includes('connect')) {
            console.log('\n💡 Network issue - check your internet connection');
        } else {
            console.log('\n💡 Try generating a new App Password from:');
            console.log('   https://myaccount.google.com/apppasswords');
        }
        
        process.exit(1);
    }
}

// Optional: Send test email
async function sendTestEmail() {
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    rl.question('\n📧 Send test email? (y/N): ', async (answer) => {
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            rl.question('📮 Enter test email address: ', async (testEmail) => {
                try {
                    const transporter = nodemailer.createTransport({
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
                    
                    await transporter.sendMail({
                        from: '"Casa Denis" <casa.denis2025@gmail.com>',
                        to: testEmail,
                        subject: '🧪 Test Email - Casa Denis Setup',
                        html: `
                            <div style="font-family: Arial, sans-serif; padding: 20px;">
                                <h2 style="color: #8b5cf6;">🏠 Casa Denis Email Test</h2>
                                <p>Congratulations! Your email configuration is working perfectly.</p>
                                <p><strong>✅ Test sent at:</strong> ${new Date().toLocaleString()}</p>
                                <p><strong>📧 From:</strong> casa.denis2025@gmail.com</p>
                                <p><strong>🎯 To:</strong> ${testEmail}</p>
                                <hr>
                                <p style="color: #666; font-size: 14px;">
                                    This is an automated test email from Casa Denis server setup.
                                </p>
                            </div>
                        `
                    });
                    
                    console.log('🎉 Test email sent successfully!');
                    console.log('📬 Check', testEmail, 'for the test message');
                    
                } catch (error) {
                    console.log('❌ Failed to send test email:', error.message);
                }
                
                rl.close();
            });
        } else {
            rl.close();
        }
    });
}

// Run the test
testEmailSetup().then(() => {
    // Uncomment to enable test email feature
    // sendTestEmail();
}).catch(console.error); 
