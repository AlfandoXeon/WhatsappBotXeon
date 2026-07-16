const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { getVideoInfo, downloadMedia } = require('../downloader');
const { extractUrl } = require('../utils/regex');
const { logTable } = require('../utils/logger');
const { getQueuePosition, addToQueue } = require('../queueWorker');

async function handleYouTube(sock, msg, remoteJid, sender, pushName, args) {
    const urlText = args.join(' ').trim();
    const url = extractUrl(urlText);
    
    if (!url || (!url.includes('youtube.com') && !url.includes('youtu.be'))) {
        return await sock.sendMessage(remoteJid, { text: "❌ Tautan YouTube tidak valid! Contoh: `#ytdl https://youtube.com/...`" }, { quoted: msg.fakeReply || msg });
    }

    try {
        await sock.sendMessage(remoteJid, { text: config.messages.waitInfo }, { quoted: msg.fakeReply || msg });
        logTable('INFO', pushName, `Mengambil info YouTube: ${url}`);
        
        const info = await getVideoInfo(url);
        const duration = info.duration || 0;
        
        if (duration > 900) {
            return await sock.sendMessage(remoteJid, { text: config.messages.errDuration }, { quoted: msg.fakeReply || msg });
        }

        // Tampilkan info singkat sebelum masuk antrean
        const infoText = `📋 *YOUTUBE DOWNLOAD* 📋\n\n` +
            `*Judul:* ${info.title || '-'}\n` +
            `*Durasi:* ${duration} detik\n` +
            `*Uploader:* ${info.uploader || '-'}\n\n` +
            `Mengunduh video kualitas terbaik sebagai Dokumen...`;

        if (info.thumbnail) {
            await sock.sendMessage(remoteJid, { image: { url: info.thumbnail }, caption: infoText }, { quoted: msg.fakeReply || msg });
        } else {
            await sock.sendMessage(remoteJid, { text: infoText }, { quoted: msg.fakeReply || msg });
        }

        // Masuk antrean langsung
        const currentQueuePos = getQueuePosition();
        let queueMsg = config.messages.waitQueue;
        if (currentQueuePos > 0) {
            queueMsg += `\nUrutan Anda: ${currentQueuePos + 1}`;
        }
        await sock.sendMessage(remoteJid, { text: queueMsg }, { quoted: msg.fakeReply || msg });

        addToQueue({
            url: url,
            type: 'video',
            resolution: '1080', // kualitas terbaik
            sendAsDocument: true, // selalu sebagai dokumen
            sock: sock,
            remoteJid: remoteJid,
            msg: msg.fakeReply || msg,
            title: info.title || 'YouTube_XeonBot',
            info: info
        });

    } catch (err) {
        logTable('ERROR', pushName, `YouTube Handler error: ${err.message}`);
        await sock.sendMessage(remoteJid, { text: `❌ Terjadi kesalahan: ${err.message}` }, { quoted: msg.fakeReply || msg });
    }
}

module.exports = { handleYouTube };
