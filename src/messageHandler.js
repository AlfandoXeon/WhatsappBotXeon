const { getQueuePosition, addToQueue } = require('./queueWorker');
const config = require('../config');
const { logTable } = require('./utils/logger');
const { activePolls } = require('./utils/sessionManager');
const { commandRouter } = require('../xeon');
const { handleSuitAnswer } = require('./groupHandler');

async function handleMessage(sock, m) {
    const msg = m.messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const remoteJid = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;
    const pushName = msg.pushName || 'User';

    // DEBUG LOG: Cek apakah ada message type yang masuk dan seperti apa bentuknya
    const messageType = Object.keys(msg.message || {})[0];
    if (messageType === 'pollUpdateMessage') {
        logTable('INFO', pushName, `Menerima pollUpdateMessage! ID Asal: ${msg.message.pollUpdateMessage.pollCreationMessageKey.id}`);
    }

    // Cek Pengecekan Mode Public / Private
    const isOwner = sender.includes(config.ownerNumber);
    if (!config.public && !isOwner) {
        return;
    }

    // Auto Read
    if (config.autoRead) {
        await sock.readMessages([msg.key]);
    }
    
    const text = msg.message.conversation || 
                 msg.message.extendedTextMessage?.text || 
                 msg.message.imageMessage?.caption || 
                 msg.message.videoMessage?.caption || "";

    const textTrimmed = text.trim();

    // Jika pesan tidak memiliki teks/caption, abaikan
    if (!textTrimmed) {
        return;
    }

    // Deteksi Prefix multi-karakter (!, #, ., /)
    const prefixMatch = textTrimmed.match(/^[!#.\/]/);
    
    // Harus menggunakan prefix
    if (!prefixMatch) return; 

    const prefix = prefixMatch[0];
    
    // Pisahkan command dan argumen
    const body = textTrimmed.slice(prefix.length).trim();
    const args = body.split(/ +/);
    const command = args.shift().toLowerCase(); // Ambil kata pertama dan jadikan huruf kecil

    // Deteksi Suit Answer (Khusus PC)
    if (!remoteJid.endsWith('@g.us') && ['batu', 'gunting', 'kertas'].includes(command)) {
        await handleSuitAnswer(sock, msg, sender, command);
        return;
    }

    // Teruskan eksekusi ke router di xeon.js
    await commandRouter(sock, msg, command, args, text, sender, remoteJid, pushName, isOwner);
}

module.exports = {
    handleMessage
};
