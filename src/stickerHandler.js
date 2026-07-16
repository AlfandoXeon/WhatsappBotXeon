const { Sticker, StickerTypes } = require('wa-sticker-formatter');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');
const { logTable } = require('./utils/logger');

/**
 * Mendownload media dari pesan WhatsApp menjadi Buffer
 */
async function downloadMediaMessage(msg, type) {
    let message = msg.message;
    if (!message) return null;

    if (message.ephemeralMessage) {
        message = message.ephemeralMessage.message;
    }
    if (message.viewOnceMessageV2) {
        message = message.viewOnceMessageV2.message;
    }

    let mediaMessage = null;
    let actualType = type;

    // Cek media di pesan asli
    if (type === 'image' && message.imageMessage) mediaMessage = message.imageMessage;
    else if (type === 'video' && message.videoMessage) mediaMessage = message.videoMessage;
    else if (type === 'sticker' && message.stickerMessage) mediaMessage = message.stickerMessage;
    
    // Cek media di quoted message
    if (!mediaMessage && message.extendedTextMessage?.contextInfo?.quotedMessage) {
        const quoted = message.extendedTextMessage.contextInfo.quotedMessage;
        if (type === 'image' && quoted.imageMessage) mediaMessage = quoted.imageMessage;
        else if (type === 'video' && quoted.videoMessage) mediaMessage = quoted.videoMessage;
        else if (type === 'sticker' && quoted.stickerMessage) mediaMessage = quoted.stickerMessage;
    }

    if (!mediaMessage) return null;

    const stream = await downloadContentFromMessage(mediaMessage, type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

/**
 * Membuat stiker dari Buffer gambar/video
 */
async function handleCreateSticker(sock, msg, buffer, packName, authorName, sender) {
    try {
        const pName = packName || config.stickerPack;
        const aName = authorName || config.stickerAuthor;

        const sticker = new Sticker(buffer, {
            pack: pName, // The pack name
            author: aName, // The author name
            type: StickerTypes.FULL, // The sticker type (FULL means fit with padding)
            quality: 30, // Kualitas
            background: 'transparent' // Background untuk padding
        });

        const webpBuffer = await sticker.toBuffer();
        
        await sock.sendMessage(msg.key.remoteJid, { sticker: webpBuffer }, { quoted: msg });
        logTable('SUCCESS', sender, `Stiker berhasil dibuat (${pName} | ${aName})`);
    } catch (err) {
        logTable('ERROR', sender, `Gagal membuat stiker: ${err.message}`);
        // Fallback or silent fail for auto-trigger
    }
}

/**
 * Mengubah stiker menjadi gambar atau video
 */
async function handleStickerToMedia(sock, msg, buffer, isAnimated, sender) {
    const tempId = crypto.randomBytes(6).toString('hex');
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const inputPath = path.join(tempDir, `${tempId}.webp`);
    const outputPath = path.join(tempDir, `${tempId}.${isAnimated ? 'mp4' : 'jpg'}`);
    
    fs.writeFileSync(inputPath, buffer);
    
    try {
        if (isAnimated) {
            // Animasi WebP -> MP4
            execSync(`ffmpeg -i "${inputPath}" -pix_fmt yuv420p -c:v libx264 -movflags +faststart -filter:v "scale=trunc(iw/2)*2:trunc(ih/2)*2" "${outputPath}"`);
            const mp4Buf = fs.readFileSync(outputPath);
            await sock.sendMessage(msg.key.remoteJid, { video: mp4Buf, caption: "Ini videonya kak! :)" }, { quoted: msg });
        } else {
            // Statis WebP -> JPG
            execSync(`ffmpeg -i "${inputPath}" "${outputPath}"`);
            const jpgBuf = fs.readFileSync(outputPath);
            await sock.sendMessage(msg.key.remoteJid, { image: jpgBuf, caption: "Ini gambarnya kak! :)" }, { quoted: msg });
        }
        logTable('SUCCESS', sender, `StickerToMedia berhasil`);
    } catch (err) {
        logTable('ERROR', sender, `Gagal convert stiker: ${err.message}`);
    } finally {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
}

module.exports = {
    downloadMediaMessage,
    handleCreateSticker,
    handleStickerToMedia
};
