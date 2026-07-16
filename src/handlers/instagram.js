const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { getVideoInfo } = require('../downloader');
const { extractUrl } = require('../utils/regex');
const { logTable } = require('../utils/logger');
const { getQueuePosition, addToQueue } = require('../queueWorker');

async function handleInstagram(sock, msg, remoteJid, sender, pushName, args) {
    const urlText = args.join(' ').trim();
    const url = extractUrl(urlText);
    
    if (!url || !url.includes('instagram.com')) {
        return await sock.sendMessage(remoteJid, { text: "❌ Tautan Instagram tidak valid! Contoh: `#ig https://instagram.com/p/...`" }, { quoted: msg.fakeReply || msg });
    }

    try {
        await sock.sendMessage(remoteJid, { text: "🔍 Mengekstrak media Instagram..." }, { quoted: msg.fakeReply || msg });
        logTable('INFO', pushName, `Mengambil info Instagram: ${url}`);
        
        let info;
        try {
            info = await getVideoInfo(url);
        } catch (infoErr) {
            // Deteksi proteksi Instagram (403 atau Sign in)
            const errStr = infoErr.message || '';
            if (errStr.includes('Sign in to confirm your age') || errStr.includes('403') || errStr.includes('login')) {
                return await sock.sendMessage(remoteJid, { 
                    text: "🔒 *PROTEKSI INSTAGRAM DETECTED*\n\nInstagram menolak permintaan ini (403 Forbidden / Butuh Login).\nMohon pastikan file `cookies.txt` bot diperbarui, atau coba beberapa saat lagi." 
                }, { quoted: msg.fakeReply || msg });
            }
            throw infoErr;
        }
        
        // Tentukan jika ini carousel (memiliki banyak gambar)
        // Instagram Carousel dari yt-dlp biasanya berbentuk info.entries
        const isCarousel = info.entries && info.entries.length > 0;
        
        const infoText = `📋 *INSTAGRAM DOWNLOAD* 📋\n\n` +
            `*Judul:* ${info.title || 'Instagram Post'}\n` +
            `*Uploader:* ${info.uploader || '-'}\n` +
            `*Tipe:* ${isCarousel ? `Carousel Foto (${info.entries.length} item)` : 'Video/Foto HD'}\n\n` +
            `Mengunduh media berkualitas HD...`;

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
            type: 'video', // Di antrean dinilai sebagai video, nanti di queueWorker didekode jadi image jika gambar
            resolution: '1080',
            sendAsDocument: false, // Output media biasa (HD) langsung terbuka
            sock: sock,
            remoteJid: remoteJid,
            msg: msg.fakeReply || msg,
            title: info.title || 'Instagram_XeonBot',
            info: info
        });

    } catch (err) {
        logTable('ERROR', pushName, `Instagram Handler error: ${err.message}`);
        await sock.sendMessage(remoteJid, { text: `❌ Terjadi kesalahan: ${err.message}` }, { quoted: msg.fakeReply || msg });
    }
}

module.exports = { handleInstagram };
