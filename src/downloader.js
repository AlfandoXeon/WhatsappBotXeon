const youtubedl = require('yt-dlp-exec');
const path = require('path');
const fs = require('fs');
const { TEMP_DIR } = require('./utils/fileManager');
const { logTable } = require('./utils/logger');

// File cookies.txt di root folder proyek
const COOKIES_PATH = path.join(__dirname, '../cookies.txt');

// Global flag untuk mencegah update berulang-ulang dalam satu runtime jika terjadi eror terus menerus
global.hasUpdatedYtDlp = false;

async function updateYtDlpBinary() {
    try {
        logTable('INFO', 'System', 'Mengunduh biner yt-dlp terbaru secara otomatis dari GitHub...');
        const isWindows = process.platform === 'win32';
        const binaryName = isWindows ? 'yt-dlp.exe' : 'yt-dlp';
        const binaryPath = path.join(__dirname, '../node_modules/yt-dlp-exec/bin', binaryName);
        
        // Buat folder bin jika belum ada
        const binDir = path.dirname(binaryPath);
        if (!fs.existsSync(binDir)) {
            fs.mkdirSync(binDir, { recursive: true });
        }

        const url = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${binaryName}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        
        const buffer = await res.arrayBuffer();
        fs.writeFileSync(binaryPath, Buffer.from(buffer));
        
        if (!isWindows) {
            fs.chmodSync(binaryPath, '755'); // Beri izin eksekusi di Linux/VPS/Colab
        }
        logTable('SUCCESS', 'System', 'Biner yt-dlp berhasil diperbarui!');
        return true;
    } catch (e) {
        logTable('ERROR', 'System', `Gagal memperbarui biner yt-dlp otomatis: ${e.message}`);
        return false;
    }
}

async function getVideoInfo(url) {
    try {
        const options = {
            dumpSingleJson: true,
            noWarnings: true,
            noCheckCertificate: true,
            ignoreNoFormatsError: true // Penting untuk IG Slide Foto
        };
        
        // Gunakan cookies jika tersedia (sangat direkomendasikan untuk bypass blokir IP YouTube/Instagram di VPS)
        if (fs.existsSync(COOKIES_PATH) && (url.includes('instagram.com') || url.includes('youtube.com') || url.includes('youtu.be'))) {
            options.cookies = COOKIES_PATH;
        }

        // Bypass blokir IP YouTube dengan memicu fallback ke ios dan web player client
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            options.extractorArgs = 'youtube:player_client=ios,web,default';
        }

        // TIKTOK BYPASS MENGGUNAKAN TIKWM API
        if (url.includes('tiktok.com')) {
            try {
                const res = await fetch(`https://www.tikwm.com/api/?url=${url}`);
                const json = await res.json();
                if (json.code === 0) {
                    return {
                        title: json.data.title,
                        duration: json.data.duration,
                        uploader: json.data.author?.nickname,
                        thumbnail: json.data.cover,
                        _is_tikwm: true,
                        _video_url: json.data.play,
                        _audio_url: json.data.music,
                        _images: json.data.images // akan ada jika ini carousel foto
                    };
                }
            } catch (e) {
                logTable('WARN', 'System', 'TikWM API gagal, mencoba fallback ke yt-dlp');
            }
        }

        const info = await youtubedl(url, options);
        return info;
    } catch (err) {
        // Cek jika error format dan belum pernah update biner
        if (err.message.includes('No video formats found') && !global.hasUpdatedYtDlp) {
            global.hasUpdatedYtDlp = true;
            const updated = await updateYtDlpBinary();
            if (updated) {
                logTable('INFO', 'System', 'Mencoba kembali mengambil info video dengan biner baru...');
                return await getVideoInfo(url); // Coba ulang sekali lagi
            }
        }
        logTable('ERROR', 'System', `Error getting info for ${url}: ${err.message}`);
        throw err;
    }
}

async function downloadMedia(url, type = 'video', resolution = '720', info = null) {
    const isAudio = type === 'audio';
    const timestamp = Date.now();
    const outputPath = path.join(TEMP_DIR, `media_${timestamp}_%(autonumber)s.%(ext)s`);

    // JALUR CEPAT TIKTOK (Menggunakan Direct Link TikWM)
    if (info && info._is_tikwm) {
        logTable('DOWNLOAD', 'System', `Mendownload dari direct link TikWM untuk: ${url}`);
        const downloadedFiles = [];
        
        if (info._images && info._images.length > 0) {
            // Jika Carousel Foto
            const limit = Math.min(info._images.length, 10);
            for (let i = 0; i < limit; i++) {
                const imgUrl = info._images[i];
                const dest = path.join(TEMP_DIR, `media_${timestamp}_${i+1}.webp`);
                const res = await fetch(imgUrl);
                const buffer = await res.arrayBuffer();
                fs.writeFileSync(dest, Buffer.from(buffer));
                downloadedFiles.push(dest);
            }
        } else {
            // Jika Video / Audio
            const targetUrl = isAudio ? info._audio_url : info._video_url;
            const ext = isAudio ? '.mp3' : '.mp4';
            const dest = path.join(TEMP_DIR, `media_${timestamp}_1${ext}`);
            const res = await fetch(targetUrl);
            const buffer = await res.arrayBuffer();
            fs.writeFileSync(dest, Buffer.from(buffer));
            downloadedFiles.push(dest);
        }
        
    }

    // JALUR CEPAT INSTAGRAM (Jika isi postingan hanya foto / carousel foto)
    if (url.includes('instagram.com') && info) {
        const isImageOnly = !info.formats || info.formats.length === 0;
        
        if (info.entries && info.entries.length > 0) {
            const firstEntry = info.entries[0];
            const isEntryImageOnly = !firstEntry.formats || firstEntry.formats.length === 0;
            
            if (isEntryImageOnly) {
                logTable('DOWNLOAD', 'System', `Mendownload Instagram Carousel Foto menggunakan Fetch...`);
                const downloadedFiles = [];
                const limit = Math.min(info.entries.length, 10);
                for (let i = 0; i < limit; i++) {
                    const entry = info.entries[i];
                    const thumbnailUrl = entry.thumbnails && entry.thumbnails.length > 0
                        ? entry.thumbnails[entry.thumbnails.length - 1].url
                        : entry.thumbnail;
                    
                    if (thumbnailUrl) {
                        const dest = path.join(TEMP_DIR, `media_${timestamp}_${i+1}.jpg`);
                        const res = await fetch(thumbnailUrl);
                        const buffer = await res.arrayBuffer();
                        fs.writeFileSync(dest, Buffer.from(buffer));
                        downloadedFiles.push(dest);
                    }
                }
                if (downloadedFiles.length > 0) return downloadedFiles;
            }
        } else if (isImageOnly) {
            logTable('DOWNLOAD', 'System', `Mendownload Instagram Foto Tunggal menggunakan Fetch...`);
            const thumbnailUrl = info.thumbnails && info.thumbnails.length > 0
                ? info.thumbnails[info.thumbnails.length - 1].url
                : info.thumbnail;
                
            if (thumbnailUrl) {
                const dest = path.join(TEMP_DIR, `media_${timestamp}_1.jpg`);
                const res = await fetch(thumbnailUrl);
                const buffer = await res.arrayBuffer();
                fs.writeFileSync(dest, Buffer.from(buffer));
                return [dest];
            }
        }
    }

    const options = {
        output: outputPath,
        noWarnings: true,
        noCheckCertificate: true,
        ignoreNoFormatsError: true, // Lanjut walau tak ada format video
        playlistEnd: 10
    };

    // Bypass blokir IP YouTube (terutama di VPS/Colab) dengan memicu fallback ke ios dan web player client
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        options.extractorArgs = 'youtube:player_client=ios,web,default';
    }
 
    // Gunakan cookies jika tersedia (direkomendasikan untuk bypass blokir IP YouTube/Instagram di VPS)
    if (fs.existsSync(COOKIES_PATH) && (url.includes('instagram.com') || url.includes('youtube.com') || url.includes('youtu.be'))) {
        options.cookies = COOKIES_PATH;
    }

    if (isAudio) {
        options.extractAudio = true;
        options.audioFormat = 'mp3';
        options.audioQuality = 0;
    } else {
        const res = resolution || '720';
        options.format = `bestvideo[height<=${res}][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best`;
        options.mergeOutputFormat = 'mp4';
    }

    try {
        logTable('DOWNLOAD', 'System', `Menjalankan yt-dlp untuk: ${url}`);
        await youtubedl(url, options);
        
        // Cari semua file yang baru saja diunduh dengan timestamp yang sama
        const files = fs.readdirSync(TEMP_DIR);
        const downloadedFiles = files
            .filter(f => f.startsWith(`media_${timestamp}_`))
            .map(f => path.join(TEMP_DIR, f));
        
        if (downloadedFiles.length > 0) {
            return downloadedFiles;
        } else {
            throw new Error("Downloaded file not found at expected path.");
        }
    } catch (err) {
        // Karena yt-dlp terkadang melempar exit code 1 jika tidak menemukan format video,
        // kita tetap harus mengecek apakah file sebenarnya sudah berhasil diunduh.
        const files = fs.readdirSync(TEMP_DIR);
        const downloadedFiles = files
            .filter(f => f.startsWith(`media_${timestamp}_`))
            .map(f => path.join(TEMP_DIR, f));
        
        if (downloadedFiles.length > 0) {
            logTable('DOWNLOAD', 'System', `yt-dlp melempar error, namun ${downloadedFiles.length} file berhasil diselamatkan.`);
            return downloadedFiles; // Selamatkan file yang berhasil diunduh
        }

        // Cek jika error format dan belum pernah update biner
        if (err.message.includes('No video formats found') && !global.hasUpdatedYtDlp) {
            global.hasUpdatedYtDlp = true;
            const updated = await updateYtDlpBinary();
            if (updated) {
                logTable('INFO', 'System', 'Mencoba kembali mengunduh dengan biner baru...');
                return await downloadMedia(url, type, resolution, info); // Coba ulang sekali lagi
            }
        }

        logTable('ERROR', 'System', `Error downloading media for ${url}: ${err.message}`);
        throw err;
    }
}

module.exports = {
    getVideoInfo,
    downloadMedia
};
