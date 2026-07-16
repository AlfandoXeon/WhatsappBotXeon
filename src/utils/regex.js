const urlRegex = /(https?:\/\/[^\s]+)/g;
const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
const instagramRegex = /^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|tv)\/.+$/;
const tiktokRegex = /^(https?:\/\/)?([a-z]{2,3}\.)?tiktok\.com\/.+$/;
const tiktokShortRegex = /^(https?:\/\/)?(vt\.tiktok\.com|vm\.tiktok\.com)\/.+$/;

function extractUrl(text) {
    const match = text.match(urlRegex);
    return match ? match[0] : null;
}

function getPlatform(url) {
    if (youtubeRegex.test(url)) return 'youtube';
    if (instagramRegex.test(url)) return 'instagram';
    if (tiktokRegex.test(url) || tiktokShortRegex.test(url)) return 'tiktok';
    return null;
}

module.exports = {
    extractUrl,
    getPlatform
};
