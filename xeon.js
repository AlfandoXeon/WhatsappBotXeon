const { extractUrl, getPlatform } = require('./src/utils/regex');
const { getVideoInfo } = require('./src/downloader');
const { addToQueue, getQueuePosition } = require('./src/queueWorker');
const { logTable } = require('./src/utils/logger');
const { downloadMediaMessage, handleCreateSticker, handleStickerToMedia } = require('./src/stickerHandler');
const { handleAdd, handleKick, handleTagAll, handleHideTag, handleJadian, handleSuit } = require('./src/groupHandler');
const { handleYouTube } = require('./src/handlers/youtube');
const { handleTikTok } = require('./src/handlers/tiktok');
const { handleInstagram } = require('./src/handlers/instagram');
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
    // 1. Membuat Global Fake Reply (kutipan seolah berasal dari pengirim perintah)
    const fakeReplyText = {
        menu: 'daftar menu XeonBot',
        ping: 'Mengecek responsivitas bot ',
        status: 'Mengecek status antrean bot ',
        ytdl: 'unduhan YouTube ',
        tt: 'unduhan TikTok 📥',
        ig: 'unduhan Instagram 📸',
        add: ' penambahan anggota grup ➕',
        kick: 'pengeluaran anggota grup ➖',
        tagall: 'seluruh anggota grup ',
        hidetag: 'pengumuman tersembunyi ',
        jadian: 'mencari jodoh acak di grup',
        suit: 'menantang permainan batu-gunting-kertas ',
        play: 'mencari dan memutar video YouTube ',
        playmusic: 'mencari dan memutar lagu YouTube ',
        playaudio: 'mencari dan memutar lagu YouTube ',
        s: 'membuat stiker baru ',
        sticker: 'Membuat stiker baru ',
        toimg: 'mengubah stiker menjadi media '
    }[command] || `menjalankan perintah #${command} `;

    const fakeReply = {
        key: {
            remoteJid: remoteJid,
            fromMe: false,
            id: 'XEONFAKE_' + Date.now().toString(36).toUpperCase()
        },
        message: {
            conversation: fakeReplyText
        }
    };

    // Hanya sertakan participant jika berada di dalam grup (@g.us)
    if (remoteJid.endsWith('@g.us')) {
        fakeReply.key.participant = sender;
    }

    // Tempelkan ke msg asli agar bisa digunakan oleh sub-handler lain
    msg.fakeReply = fakeReply;

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

            const fs = require('fs');
            const path = require('path');

            const thumbPath = path.join(__dirname, config.menuThumbnail || 'thumbnail/thumbv3.png');

            if (fs.existsSync(thumbPath)) {
                await sock.sendMessage(remoteJid, {
                    image: fs.readFileSync(thumbPath),
                    caption: menuMsg
                }, { quoted: fakeReply });
            } else {
                await sock.sendMessage(remoteJid, { text: menuMsg }, { quoted: fakeReply });
            }
            break;
        }

        case 'ping':
            logTable('COMMAND', pushName, `[${command}] executed`);
            await sock.sendMessage(remoteJid, { text: 'Pong! 🏓 XeonBot online.' }, { quoted: fakeReply });
            break;

        case 'status':
            logTable('COMMAND', pushName, `[${command}] executed`);
            const queuePos = getQueuePosition();
            await sock.sendMessage(remoteJid, { text: `📊 Status Antrean: ${queuePos} tugas sedang menunggu.` }, { quoted: fakeReply });
            break;

        case 'ytdl': {
            await handleYouTube(sock, msg, remoteJid, sender, pushName, args);
            break;
        }

        case 'tt': {
            await handleTikTok(sock, msg, remoteJid, sender, pushName, args);
            break;
        }

        case 'ig': {
            await handleInstagram(sock, msg, remoteJid, sender, pushName, args);
            break;
        }

        case 'play':
        case 'playaudio':
        case 'playmusic': {
            const query = args.join(' ').trim();
            const cmdString = `[${command}]`;
            logTable('COMMAND', pushName, `${cmdString} ${query}`);

            if (!query) {
                return await sock.sendMessage(remoteJid, { text: '❌ Harap masukkan kata kunci pencarian. Contoh: `#play orange 7`' }, { quoted: fakeReply });
            }

            try {
                await sock.sendMessage(remoteJid, { text: `${config.messages.search} ${query}...` }, { quoted: fakeReply });

                const searchResult = await ytSearch(query);
                const topVideo = searchResult.videos[0];

                if (!topVideo) {
                    return await sock.sendMessage(remoteJid, { text: config.messages.errNotFound }, { quoted: fakeReply });
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
                    await sock.sendMessage(remoteJid, { image: { url: topVideo.thumbnail }, caption: infoText }, { quoted: fakeReply });
                } else {
                    await sock.sendMessage(remoteJid, { text: infoText }, { quoted: fakeReply });
                }

                const currentQueuePos = getQueuePosition();
                let queueMsg = config.messages.waitQueue;
                if (currentQueuePos > 0) {
                    queueMsg += `\nUrutan Anda: ${currentQueuePos + 1}`;
                }
                await sock.sendMessage(remoteJid, { text: queueMsg }, { quoted: fakeReply });

                logTable('QUEUE', pushName, `Tugas play ditambahkan ke antrean. Posisi: ${currentQueuePos + 1}`);

                addToQueue({
                    url: url,
                    type: type,
                    resolution: '360', // Native video WhatsApp
                    sendAsDocument: false, // Tampil di galeri
                    sock: sock,
                    remoteJid: remoteJid,
                    msg: fakeReply,
                    title: topVideo.title
                });

            } catch (err) {
                logTable('ERROR', pushName, `Gagal memproses pencarian: ${err.message}`);
                await sock.sendMessage(remoteJid, { text: `❌ Terjadi kesalahan saat mencari: ${err.message}` }, { quoted: fakeReply });
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
                return await sock.sendMessage(remoteJid, { text: "❌ Kirim/reply gambar atau video (max 6s) dengan caption #sticker" }, { quoted: fakeReply });
            }

            const mediaType = (isImage || isQuotedImage) ? 'image' : 'video';

            // Cek durasi video
            const videoData = isVideo || isQuotedVideo;
            if (mediaType === 'video' && videoData.seconds > 6) {
                return await sock.sendMessage(remoteJid, { text: "❌ Durasi video maksimal 6 detik untuk stiker." }, { quoted: fakeReply });
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
                return await sock.sendMessage(remoteJid, { text: "❌ Gagal mengunduh media." }, { quoted: fakeReply });
            }

            await handleCreateSticker(sock, msg, buffer, packName, authorName, sender);
            break;
        }

        case 'toimg': {
            logTable('COMMAND', pushName, `[toimg] executed`);

            const isQuotedSticker = msg.message.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
            const isSticker = msg.message.stickerMessage;

            if (!isQuotedSticker && !isSticker) {
                return await sock.sendMessage(remoteJid, { text: "❌ Reply stiker dengan command #toimg" }, { quoted: fakeReply });
            }

            const stickerData = isSticker || isQuotedSticker;
            const isAnimated = stickerData.isAnimated;

            const buffer = await downloadMediaMessage(msg, 'sticker');
            if (!buffer) {
                return await sock.sendMessage(remoteJid, { text: "❌ Gagal mengunduh stiker." }, { quoted: fakeReply });
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
