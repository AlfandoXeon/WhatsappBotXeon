const { extractUrl, getPlatform } = require('./src/utils/regex');
const { getVideoInfo } = require('./src/downloader');
const { addToQueue, getQueuePosition } = require('./src/queueWorker');
const { logTable } = require('./src/utils/logger');
const { downloadMediaMessage, handleCreateSticker, handleStickerToMedia } = require('./src/stickerHandler');
const { handleAdd, handleKick, handleTagAll, handleHideTag, handleJadian, handleSuit } = require('./src/groupHandler');
const config = require('./config');
const ytSearch = require('yt-search');

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat Pagi ';
    if (hour < 15) return 'Selamat Siang ';
    if (hour < 18) return 'Selamat Sore ';
    return 'Selamat Malam 🌙';
}

/**
 * Router utama untuk semua perintah bot (Switch Case).
 */
async function commandRouter(sock, msg, command, args, text, sender, remoteJid, pushName, isOwner) {
    switch (command) {
        case 'menu': {
            logTable('COMMAND', pushName, `[menu] executed`);
            const greeting = getGreeting();
            let menuList = config.features.map(f => ` ✦ *#${f.cmd}*\n > --${f.desc}\n`).join('\n');
            const menuMsg = `${greeting}, *${pushName}*!\n\n` +
                `*Bot Name:* ${config.botName}\n` +
                `*Owner:* ${config.ownerName}\n\n` +
                `*╭───「 DAFTAR MENU 」* ──\n` +
                `${menuList}\n\n` +
                `*╰──────────────────────*\n\n` +
                `> _AlfandoXeon2026_`;
            await sock.sendMessage(remoteJid, { text: menuMsg }, { quoted: msg });
            break;
        }

        case 'ping':
            logTable('COMMAND', pushName, `[${command}] executed`);
            await sock.sendMessage(remoteJid, { text: 'Pong! 🏓 XeonBot online.' }, { quoted: msg });
            break;

        case 'status':
            logTable('COMMAND', pushName, `[${command}] executed`);
            const queuePos = getQueuePosition();
            await sock.sendMessage(remoteJid, { text: `📊 Status Antrean: ${queuePos} tugas sedang menunggu.` }, { quoted: msg });
            break;

        case 'dl':
        case 'download':
        case 'downloadaudio':
        case 'getinfo': {
            const type = command === 'downloadaudio' ? 'audio' : command === 'getinfo' ? 'info' : 'video';
            const cmdString = `[${command}]`;

            const urlText = args.join(' ').trim();
            logTable('COMMAND', pushName, `${cmdString} ${urlText.substring(0, 30)}...`);

            const url = extractUrl(urlText);
            if (!url) {
                return await sock.sendMessage(remoteJid, { text: config.messages.errLink }, { quoted: msg });
            }

            const platform = getPlatform(url);
            if (!platform) {
                return await sock.sendMessage(remoteJid, { text: config.messages.errPlatform }, { quoted: msg });
            }

            try {
                logTable('INFO', pushName, `Mengambil info media: ${url}`);
                await sock.sendMessage(remoteJid, { text: config.messages.waitInfo }, { quoted: msg });
                const info = await getVideoInfo(url);

                const duration = info.duration || 0;
                if (duration > 900) {
                    return await sock.sendMessage(remoteJid, { text: config.messages.errDuration }, { quoted: msg });
                }

                const infoText = `📋 *INFO MEDIA* 📋\n\n` +
                    `*Judul:* ${info.title || '-'}\n` +
                    `*Durasi:* ${duration} detik\n` +
                    `*Uploader:* ${info.uploader || '-'}\n` +
                    `*Platform:* ${platform}\n\n` +
                    (type === 'info' ? `Gunakan #dl atau #downloadaudio untuk mengunduh.` : `Mengunduh format terbaik...`);

                if (info.thumbnail) {
                    await sock.sendMessage(remoteJid, { image: { url: info.thumbnail }, caption: infoText }, { quoted: msg });
                } else {
                    await sock.sendMessage(remoteJid, { text: infoText }, { quoted: msg });
                }

                if (type === 'info') return;

                // Masuk antrean langsung
                const currentQueuePos = getQueuePosition();
                let queueMsg = config.messages.waitQueue;
                if (currentQueuePos > 0) {
                    queueMsg += `\nUrutan Anda: ${currentQueuePos + 1}`;
                }
                await sock.sendMessage(remoteJid, { text: queueMsg }, { quoted: msg });

                logTable('QUEUE', pushName, `Tugas ditambahkan ke antrean. Posisi: ${currentQueuePos + 1}`);

                addToQueue({
                    url: url,
                    type: type,
                    resolution: '1080', // Asumsi ambil yang tertinggi
                    sendAsDocument: true, // Kirim sebagai dokumen
                    sock: sock,
                    remoteJid: remoteJid,
                    msg: msg,
                    title: info.title || 'Media_XeonBot',
                    info: info // Pass the full JSON metadata
                });

            } catch (err) {
                logTable('ERROR', pushName, `Gagal memproses pesan: ${err.message}`);
                await sock.sendMessage(remoteJid, { text: `❌ Terjadi kesalahan: ${err.message}` }, { quoted: msg });
            }
            break;
        }

        case 'play':
        case 'playaudio':
        case 'playmusic': {
            const query = args.join(' ').trim();
            const cmdString = `[${command}]`;
            logTable('COMMAND', pushName, `${cmdString} ${query}`);

            if (!query) {
                return await sock.sendMessage(remoteJid, { text: '❌ Harap masukkan kata kunci pencarian. Contoh: `#play orange 7`' }, { quoted: msg });
            }

            try {
                await sock.sendMessage(remoteJid, { text: `${config.messages.search} ${query}...` }, { quoted: msg });

                const searchResult = await ytSearch(query);
                const topVideo = searchResult.videos[0];

                if (!topVideo) {
                    return await sock.sendMessage(remoteJid, { text: config.messages.errNotFound }, { quoted: msg });
                }

                const url = topVideo.url;
                const isAudio = (command === 'playaudio' || command === 'playmusic');
                const type = isAudio ? 'audio' : 'video';

                const infoText = `📋 *HASIL PENCARIAN* 📋\n\n` +
                    `*Judul:* ${topVideo.title}\n` +
                    `*Durasi:* ${topVideo.timestamp}\n` +
                    `*Uploader:* ${topVideo.author.name}\n` +
                    `*Views:* ${topVideo.views}\n\n` +
                    `Mengunduh media...`;

                if (topVideo.thumbnail) {
                    await sock.sendMessage(remoteJid, { image: { url: topVideo.thumbnail }, caption: infoText }, { quoted: msg });
                } else {
                    await sock.sendMessage(remoteJid, { text: infoText }, { quoted: msg });
                }

                const currentQueuePos = getQueuePosition();
                let queueMsg = config.messages.waitQueue;
                if (currentQueuePos > 0) {
                    queueMsg += `\nUrutan Anda: ${currentQueuePos + 1}`;
                }
                await sock.sendMessage(remoteJid, { text: queueMsg }, { quoted: msg });

                logTable('QUEUE', pushName, `Tugas play ditambahkan ke antrean. Posisi: ${currentQueuePos + 1}`);

                addToQueue({
                    url: url,
                    type: type,
                    resolution: '360', // Native video WhatsApp
                    sendAsDocument: false, // Tampil di galeri
                    sock: sock,
                    remoteJid: remoteJid,
                    msg: msg,
                    title: topVideo.title
                });

            } catch (err) {
                logTable('ERROR', pushName, `Gagal memproses pencarian: ${err.message}`);
                await sock.sendMessage(remoteJid, { text: `❌ Terjadi kesalahan saat mencari: ${err.message}` }, { quoted: msg });
            }
            break;
        }

        case 's':
        case 'sticker': {
            logTable('COMMAND', pushName, `[sticker] executed`);

            const isQuotedImage = msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
            const isQuotedVideo = msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.videoMessage;
            const isImage = msg.message.imageMessage;
            const isVideo = msg.message.videoMessage;

            const hasMedia = isImage || isVideo || isQuotedImage || isQuotedVideo;

            if (!hasMedia) {
                return await sock.sendMessage(remoteJid, { text: "❌ Kirim/reply gambar atau video (max 6s) dengan caption #sticker" }, { quoted: msg });
            }

            const mediaType = (isImage || isQuotedImage) ? 'image' : 'video';

            // Cek durasi video
            const videoData = isVideo || isQuotedVideo;
            if (mediaType === 'video' && videoData.seconds > 6) {
                return await sock.sendMessage(remoteJid, { text: "❌ Durasi video maksimal 6 detik untuk stiker." }, { quoted: msg });
            }

            // Parsing Pack & Author name dari arguments "PackName | AuthorName"
            const textArgs = args.join(' ');
            let packName = '';
            let authorName = '';
            if (textArgs.includes('|')) {
                const parts = textArgs.split('|');
                packName = parts[0].trim();
                authorName = parts[1].trim();
            } else if (textArgs.length > 0) {
                packName = textArgs;
            }

            const buffer = await downloadMediaMessage(msg, mediaType);
            if (!buffer) {
                return await sock.sendMessage(remoteJid, { text: "❌ Gagal mengunduh media." }, { quoted: msg });
            }

            await handleCreateSticker(sock, msg, buffer, packName, authorName, sender);
            break;
        }

        case 'toimg': {
            logTable('COMMAND', pushName, `[toimg] executed`);

            const isQuotedSticker = msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
            const isSticker = msg.message.stickerMessage;

            if (!isQuotedSticker && !isSticker) {
                return await sock.sendMessage(remoteJid, { text: "❌ Reply stiker dengan command #toimg" }, { quoted: msg });
            }

            const stickerData = isSticker || isQuotedSticker;
            const isAnimated = stickerData.isAnimated;

            const buffer = await downloadMediaMessage(msg, 'sticker');
            if (!buffer) {
                return await sock.sendMessage(remoteJid, { text: "❌ Gagal mengunduh stiker." }, { quoted: msg });
            }

            await handleStickerToMedia(sock, msg, buffer, isAnimated, sender);
            break;
        }

        case 'add': {
            await handleAdd(sock, msg, remoteJid, sender, pushName, args);
            break;
        }

        case 'kick': {
            const mentionedJidList = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            await handleKick(sock, msg, remoteJid, sender, pushName, mentionedJidList);
            break;
        }

        case 'tagall': {
            await handleTagAll(sock, msg, remoteJid, sender, pushName, args);
            break;
        }

        case 'hidetag': {
            await handleHideTag(sock, msg, remoteJid, sender, pushName, args);
            break;
        }

        case 'jadian': {
            await handleJadian(sock, msg, remoteJid, sender, pushName);
            break;
        }

        case 'suit': {
            const mentionedJidList = msg.message.extendedTextMessage?.contextInfo?.mentionedJid || [];
            await handleSuit(sock, msg, remoteJid, sender, pushName, mentionedJidList);
            break;
        }

        default:
            // Jika command tidak ditemukan, biarkan saja
            break;
    }
}

module.exports = {
    commandRouter
};
