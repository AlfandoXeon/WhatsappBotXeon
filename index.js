const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const chalk = require('chalk');
const figlet = require('figlet');

const { handleMessage } = require('./src/messageHandler');
const { startGarbageCollector } = require('./src/utils/fileManager');
const { logTable } = require('./src/utils/logger');
const config = require('./config');

// Inisialisasi State Memori Global untuk Game
global.gameStates = {};

const logger = pino({ level: 'info' });

async function connectToWhatsApp() {
    // Tampilan Terminal Estetik
    console.clear();
    console.log(chalk.blue(figlet.textSync(config.botName, { horizontalLayout: 'full' })));
    console.log(chalk.green('=================================================='));
    console.log(chalk.yellow(`  => Bot Name    : ${config.botName}`));
    console.log(chalk.yellow(`  => Owner       : ${config.ownerName} (${config.ownerNumber})`));
    console.log(chalk.yellow(`  => Mode Public : ${config.public ? 'Aktif' : 'Non-aktif'}`));
    console.log(chalk.yellow(`  => Auto Read   : ${config.autoRead ? 'Aktif' : 'Non-aktif'}`));
    console.log(chalk.green('==================================================\n'));

    const authFolder = path.join(__dirname, 'auth_info_baileys');
    const { state, saveCreds } = await useMultiFileAuthState(authFolder);
    
    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }) // Membisukan log bawaan Baileys
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log(chalk.cyan('\n[!] Scan QR Code di bawah ini untuk menghubungkan bot:\n'));
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            logTable('ERROR', 'System', `Connection closed. Reconnecting: ${shouldReconnect}`);
            
            if (!shouldReconnect) {
                logTable('ERROR', 'System', 'Logged out. Menghapus auth session...');
                if (fs.existsSync(authFolder)) {
                    fs.rmSync(authFolder, { recursive: true, force: true });
                }
            }
            
            setTimeout(() => connectToWhatsApp(), 3000);
        } else if (connection === 'open') {
            logTable('SUCCESS', 'System', 'Berhasil terhubung ke WhatsApp!');
            
            // Notifikasi ke owner
            try {
                const ownerJid = `${config.ownerNumber}@s.whatsapp.net`;
                
                const featureList = config.features.map(f => `- \`#${f.cmd}\` : ${f.desc}`).join('\n');
                
                const startupMsg = `✅ *${config.botName} Berhasil Dinyalakan!*\n\n` +
                                   `👤 *Owner:* ${config.ownerName}\n` +
                                   `🌐 *Mode Public:* ${config.public ? 'Aktif' : 'Non-aktif'}\n\n` +
                                   `*🛠 Fitur Tersedia:*\n` +
                                   `${featureList}\n\n` +
                                   `_Bot siap melayani!_ 🚀`;
                                   
                await sock.sendMessage(ownerJid, { text: startupMsg });
                logTable('INFO', 'System', 'Notifikasi startup terkirim ke owner');
            } catch (err) {
                logTable('ERROR', 'System', `Gagal mengirim notifikasi owner: ${err.message}`);
            }
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        if (m.type === 'notify') {
            await handleMessage(sock, m);
        }
    });
}

startGarbageCollector();
connectToWhatsApp();
