const config = require('../config');
const { logTable } = require('./utils/logger');

// --- Helper: Mengecek Status Admin ---
async function checkAdmin(sock, remoteJid, senderJid) {
    if (!remoteJid.endsWith('@g.us')) return { isGroup: false };

    try {
        const groupMetadata = await sock.groupMetadata(remoteJid);
        const participants = groupMetadata.participants;
        
        // Cek pengirim
        const senderData = participants.find(p => p.id === senderJid);
        const isSenderAdmin = senderData?.admin === 'admin' || senderData?.admin === 'superadmin';
        
        // Cek bot
        const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net';
        const botData = participants.find(p => p.id === botJid);
        const isBotAdmin = botData?.admin === 'admin' || botData?.admin === 'superadmin';

        return {
            isGroup: true,
            isSenderAdmin,
            isBotAdmin,
            participants,
            groupMetadata
        };
    } catch (err) {
        return { isGroup: false };
    }
}

// --- Handler: Add ---
async function handleAdd(sock, msg, remoteJid, sender, pushName, args) {
    const adminCheck = await checkAdmin(sock, remoteJid, sender);
    if (!adminCheck.isGroup) return await sock.sendMessage(remoteJid, { text: config.messages.errNotGroup }, { quoted: msg });
    if (!adminCheck.isSenderAdmin && !sender.includes(config.ownerNumber)) return await sock.sendMessage(remoteJid, { text: config.messages.errNotAdmin }, { quoted: msg });
    if (!adminCheck.isBotAdmin) return await sock.sendMessage(remoteJid, { text: config.messages.errBotNotAdmin }, { quoted: msg });

    const num = args.join('').replace(/[^0-9]/g, '');
    if (!num) return await sock.sendMessage(remoteJid, { text: "❌ Masukkan nomor yang valid. Contoh: `#add 628xxx`" }, { quoted: msg });
    
    const targetJid = `${num}@s.whatsapp.net`;
    try {
        await sock.groupParticipantsUpdate(remoteJid, [targetJid], "add");
        await sock.sendMessage(remoteJid, { text: `✅ Berhasil menambahkan @${num}`, mentions: [targetJid] }, { quoted: msg });
        logTable('GROUP', pushName, `Menambahkan ${num} ke grup`);
    } catch (err) {
        await sock.sendMessage(remoteJid, { text: `❌ Gagal menambahkan: ${err.message}` }, { quoted: msg });
    }
}

// --- Handler: Kick ---
async function handleKick(sock, msg, remoteJid, sender, pushName, mentionedJidList) {
    const adminCheck = await checkAdmin(sock, remoteJid, sender);
    if (!adminCheck.isGroup) return await sock.sendMessage(remoteJid, { text: config.messages.errNotGroup }, { quoted: msg });
    if (!adminCheck.isSenderAdmin && !sender.includes(config.ownerNumber)) return await sock.sendMessage(remoteJid, { text: config.messages.errNotAdmin }, { quoted: msg });
    if (!adminCheck.isBotAdmin) return await sock.sendMessage(remoteJid, { text: config.messages.errBotNotAdmin }, { quoted: msg });

    if (!mentionedJidList || mentionedJidList.length === 0) {
        return await sock.sendMessage(remoteJid, { text: "❌ Tag/Mention orang yang ingin dikeluarkan. Contoh: `#kick @user`" }, { quoted: msg });
    }

    try {
        await sock.groupParticipantsUpdate(remoteJid, mentionedJidList, "remove");
        await sock.sendMessage(remoteJid, { text: `✅ Berhasil mengeluarkan anggota.` }, { quoted: msg });
        logTable('GROUP', pushName, `Mengeluarkan ${mentionedJidList.length} orang dari grup`);
    } catch (err) {
        await sock.sendMessage(remoteJid, { text: `❌ Gagal mengeluarkan: ${err.message}` }, { quoted: msg });
    }
}

// --- Handler: Tag All ---
async function handleTagAll(sock, msg, remoteJid, sender, pushName, args) {
    const adminCheck = await checkAdmin(sock, remoteJid, sender);
    if (!adminCheck.isGroup) return await sock.sendMessage(remoteJid, { text: config.messages.errNotGroup }, { quoted: msg });
    if (!adminCheck.isSenderAdmin && !sender.includes(config.ownerNumber)) return await sock.sendMessage(remoteJid, { text: config.messages.errNotAdmin }, { quoted: msg });

    const participants = adminCheck.participants;
    const jids = participants.map(p => p.id);
    
    let text = `📢 *TAG ALL* 📢\n\n`;
    const userMsg = args.join(' ');
    if (userMsg) text += `*Pesan:* ${userMsg}\n\n`;
    
    text += `*Anggota:*\n`;
    for (const jid of jids) {
        text += `• @${jid.split('@')[0]}\n`;
    }

    await sock.sendMessage(remoteJid, { text, mentions: jids }, { quoted: msg });
    logTable('GROUP', pushName, `Melakukan TagAll di grup`);
}

// --- Handler: Hide Tag ---
async function handleHideTag(sock, msg, remoteJid, sender, pushName, args) {
    const adminCheck = await checkAdmin(sock, remoteJid, sender);
    if (!adminCheck.isGroup) return await sock.sendMessage(remoteJid, { text: config.messages.errNotGroup }, { quoted: msg });
    if (!adminCheck.isSenderAdmin && !sender.includes(config.ownerNumber)) return await sock.sendMessage(remoteJid, { text: config.messages.errNotAdmin }, { quoted: msg });

    const participants = adminCheck.participants;
    const jids = participants.map(p => p.id);
    const userMsg = args.join(' ') || "Perhatian!";

    await sock.sendMessage(remoteJid, { text: userMsg, mentions: jids });
    logTable('GROUP', pushName, `Melakukan HideTag di grup`);
}

// --- Handler: Jadian ---
async function handleJadian(sock, msg, remoteJid, sender, pushName) {
    const adminCheck = await checkAdmin(sock, remoteJid, sender);
    if (!adminCheck.isGroup) return await sock.sendMessage(remoteJid, { text: config.messages.errNotGroup }, { quoted: msg });

    const participants = adminCheck.participants;
    if (participants.length < 2) return await sock.sendMessage(remoteJid, { text: "❌ Anggota grup kurang!" }, { quoted: msg });

    const random1 = participants[Math.floor(Math.random() * participants.length)].id;
    let random2 = participants[Math.floor(Math.random() * participants.length)].id;
    while (random1 === random2) {
        random2 = participants[Math.floor(Math.random() * participants.length)].id;
    }

    const text = `Ciee.. 💕\nSepertinya @${random1.split('@')[0]} cocok nih sama @${random2.split('@')[0]}!\nPJ nya dong!! 🥳`;
    await sock.sendMessage(remoteJid, { text, mentions: [random1, random2] }, { quoted: msg });
    logTable('GAME', pushName, `Jadian terpicu di grup`);
}

// --- Handler: Suit ---
async function handleSuit(sock, msg, remoteJid, sender, pushName, mentionedJidList) {
    const adminCheck = await checkAdmin(sock, remoteJid, sender);
    if (!adminCheck.isGroup) return await sock.sendMessage(remoteJid, { text: config.messages.errNotGroup }, { quoted: msg });

    if (!mentionedJidList || mentionedJidList.length === 0) {
        return await sock.sendMessage(remoteJid, { text: "❌ Tag/Mention orang yang ingin ditantang. Contoh: `#suit @user`" }, { quoted: msg });
    }

    const target = mentionedJidList[0];
    if (target === sender) return await sock.sendMessage(remoteJid, { text: "❌ Anda tidak bisa menantang diri sendiri!" }, { quoted: msg });
    
    // Cek jika sudah ada game
    if (global.gameStates[remoteJid]) {
        return await sock.sendMessage(remoteJid, { text: "❌ Masih ada sesi suit yang berlangsung di grup ini!" }, { quoted: msg });
    }

    // Buat State
    global.gameStates[remoteJid] = {
        type: 'suit',
        player1: sender,
        player2: target,
        choice1: null,
        choice2: null,
        timer: setTimeout(async () => {
            if (global.gameStates[remoteJid]) {
                await sock.sendMessage(remoteJid, { text: "⏳ *SUIT DIBATALKAN* karena waktu habis (3 menit)!" });
                delete global.gameStates[remoteJid];
            }
        }, 3 * 60 * 1000)
    };

    const text = `🎮 *SUIT MATCH* 🎮\n\n@${sender.split('@')[0]} menantang @${target.split('@')[0]}!\n\nKalian berdua silakan *PC / Private Chat* ke Bot dengan mengetik pilihan kalian:\n- \`#batu\`\n- \`#gunting\`\n- \`#kertas\`\n\nWaktu: 3 Menit!`;
    await sock.sendMessage(remoteJid, { text, mentions: [sender, target] }, { quoted: msg });
    logTable('GAME', pushName, `Memulai suit dengan target ${target}`);
}

// --- Handler: Menjawab Suit (Private Chat) ---
async function handleSuitAnswer(sock, msg, sender, choice) {
    // Cari di grup mana dia bermain
    let foundGroupId = null;
    let playerKey = null;

    for (const groupId in global.gameStates) {
        const game = global.gameStates[groupId];
        if (game.type === 'suit') {
            if (game.player1 === sender && !game.choice1) {
                foundGroupId = groupId;
                playerKey = 'choice1';
                break;
            }
            if (game.player2 === sender && !game.choice2) {
                foundGroupId = groupId;
                playerKey = 'choice2';
                break;
            }
        }
    }

    if (!foundGroupId) {
        return await sock.sendMessage(sender, { text: "❌ Anda sedang tidak berada dalam sesi suit yang menunggu jawaban Anda." }, { quoted: msg });
    }

    const game = global.gameStates[foundGroupId];
    game[playerKey] = choice;

    await sock.sendMessage(sender, { text: `✅ Anda telah memilih: *${choice.toUpperCase()}*` }, { quoted: msg });

    if (game.choice1 && game.choice2) {
        clearTimeout(game.timer);
        
        let winner = "Seri";
        if (game.choice1 === game.choice2) {
            winner = "SERI";
        } else if (
            (game.choice1 === 'batu' && game.choice2 === 'gunting') ||
            (game.choice1 === 'gunting' && game.choice2 === 'kertas') ||
            (game.choice1 === 'kertas' && game.choice2 === 'batu')
        ) {
            winner = `🏆 @${game.player1.split('@')[0]} MENANG!`;
        } else {
            winner = `🏆 @${game.player2.split('@')[0]} MENANG!`;
        }

        const resultMsg = `🎮 *HASIL SUIT* 🎮\n\n@${game.player1.split('@')[0]} memilih *${game.choice1}*\n@${game.player2.split('@')[0]} memilih *${game.choice2}*\n\nHasil:\n${winner}`;
        await sock.sendMessage(foundGroupId, { text: resultMsg, mentions: [game.player1, game.player2] });
        
        delete global.gameStates[foundGroupId];
    } else {
        await sock.sendMessage(foundGroupId, { text: `Tunggu ya, ada yang sudah memilih! Ayo @${game.choice1 ? game.player2.split('@')[0] : game.player1.split('@')[0]} buruan pilih!`, mentions: [game.player1, game.player2] });
    }
}


module.exports = {
    handleAdd,
    handleKick,
    handleTagAll,
    handleHideTag,
    handleJadian,
    handleSuit,
    handleSuitAnswer
};
