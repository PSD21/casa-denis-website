#!/usr/bin/env node

// Script automat de backup pentru Casa Denis
const { exec } = require('child_process');
const path = require('path');
require('dotenv').config();
 
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFile = `backup_casa_denis_${timestamp}.sql`;
const backupPath = path.join(__dirname, 'backups');

// Creează directorul de backup
require('fs').mkdirSync(backupPath, { recursive: true });

const command = `mysqldump -h ${process.env.DB_HOST} -u ${process.env.DB_USER} -p${process.env.DB_PASSWORD} ${process.env.DB_NAME} > ${path.join(backupPath, backupFile)}`;

exec(command, (error, stdout, stderr) => {
    if (error) {
        console.error('❌ Backup eșuat:', error.message);
        return;
    }
    console.log(`✅ Backup creat cu succes: ${backupFile}`);
});
