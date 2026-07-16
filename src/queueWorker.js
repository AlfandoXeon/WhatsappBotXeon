const async = require('async');
const { downloadMedia } = require('./downloader');
const { deleteFile } = require('./utils/fileManager');
const { logTable } = require('./utils/logger');
const fs = require('fs');
const path = require('path');
const config = require('../config');

const downloadQueue = async.queue(async (task) => {
    const { url, type, resolution, sendAsDocument, sock, remoteJid, msg, title, info } = task;
    let downloadedPaths = [];
    
    try {
        await sock.sendMessage(remoteJid, { text: config.messages.downloading }, { quoted: msg.fakeReply || msg });
        
        logTable('DOWNLOAD', remoteJid, `Mulai mengunduh media dari url: ${url}`);
        downloadedPaths = await downloadMedia(url, type, resolution, info);
        
        const isAudio = type === 'audio';
        const safeTitle = title ? title.replace(/[/\\?%*:|"<>]/g, '-') : 'media';

        for (let i = 0; i < downloadedPaths.length; i++) {
            const downloadedPath = downloadedPaths[i];
            const actualExt = path.extname(downloadedPath).toLowerCase() || (isAudio ? '.mp3' : '.mp4');
            const fileName = downloadedPaths.length > 1 ? `${safeTitle}_${i+1}${actualExt}` : `${safeTitle}${actualExt}`;

            // Cek jika gambar
            const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(actualExt);
            
            // Caption hanya untuk media pertama (index 0)
            const finalCaption = i === 0 ? (title ? `*${title}*\n\n${config.messages.success}` : config.messages.success) : undefined;
            const quotedOpt = i === 0 ? { quoted: msg.fakeReply || msg } : undefined;

            if (isImage) {
                await sock.sendMessage(remoteJid, {
                    image: fs.readFileSync(downloadedPath),
                    caption: finalCaption
                }, quotedOpt);
            } else if (type === 'video' && sendAsDocument === false) {
                await sock.sendMessage(remoteJid, {
                    video: fs.readFileSync(downloadedPath),
                    mimetype: 'video/mp4',
                    caption: finalCaption
                }, quotedOpt);
            } else if (isAudio && sendAsDocument === false) {
                await sock.sendMessage(remoteJid, {
                    audio: fs.readFileSync(downloadedPath),
                    mimetype: 'audio/mpeg',
                    ptt: false
                }, quotedOpt);
            } else {
                let dynamicMimetype = isAudio ? 'audio/mpeg' : 'video/mp4';
                if (actualExt === '.webm') dynamicMimetype = 'video/webm';
                else if (actualExt === '.mkv') dynamicMimetype = 'video/x-matroska';
                else if (actualExt === '.ogg') dynamicMimetype = 'audio/ogg';
                else if (actualExt === '.m4a') dynamicMimetype = 'audio/mp4';

                await sock.sendMessage(remoteJid, {
                    document: fs.readFileSync(downloadedPath),
                    mimetype: dynamicMimetype,
                    fileName: fileName,
                    caption: finalCaption
                }, quotedOpt);
            }
            
            logTable('SUCCESS', remoteJid, `Media ${fileName} terkirim`);

            // Jeda 1 detik jika ini carousel (menghindari rate limit WA)
            if (downloadedPaths.length > 1 && i < downloadedPaths.length - 1) {
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    } catch (err) {
        logTable('ERROR', remoteJid, `Task failed: ${err.message}`);
        await sock.sendMessage(remoteJid, { text: `${config.messages.errSystem} ${err.message}` }, { quoted: msg.fakeReply || msg });
        
        // Report error to Admin/Owner
        try {
            const ownerJid = `${config.ownerNumber}@s.whatsapp.net`;
            const errorMsgToAdmin = `🚨 *QUEUE ERROR ALERT* 🚨\n\n` +
                                    `*URL:* ${url}\n` +
                                    `*Sender:* ${remoteJid}\n` +
                                    `*Error Code:*\n\`\`\`${err.message}\`\`\`\n\n` +
                                    `*Stack Trace:*\n\`\`\`${err.stack || 'No Stack Trace'}\`\`\``;
            await sock.sendMessage(ownerJid, { text: errorMsgToAdmin });
        } catch (adminErr) {
            logTable('ERROR', 'System', `Gagal mengirim error ke admin: ${adminErr.message}`);
        }
    } finally {
        for (const p of downloadedPaths) {
            if (p) deleteFile(p);
        }
    }
}, 2); // Maksimal 2 proses download bersamaan

downloadQueue.error((err, task) => {
    logTable('ERROR', task.remoteJid || 'System', `Task experienced an error: ${err.message}`);
});

function getQueuePosition() {
    return downloadQueue.length();
}

function addToQueue(task) {
    // async push without callback since worker returns Promise
    downloadQueue.push(task).catch(err => {
        logTable('ERROR', task.remoteJid || 'System', `Error in queue push: ${err.message}`);
    });
}

module.exports = {
    addToQueue,
    getQueuePosition
};
