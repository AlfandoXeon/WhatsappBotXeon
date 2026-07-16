const youtubedl = require('yt-dlp-exec');
const path = require('path');
const fs = require('fs');
const querystring = require('querystring');
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

function writeErrorLog(url, action, err, options) {
    try {
        const logPath = path.join(__dirname, '../ytdl_error.log');
        const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        
        let logContent = `==================================================\n`;
        logContent += `TIMESTAMP   : ${timestamp} (WIB)\n`;
        logContent += `ACTION      : ${action}\n`;
        logContent += `URL         : ${url}\n`;
        logContent += `ERROR       : ${err.message || err}\n`;
        
        if (err.stdout) {
            logContent += `STDOUT      :\n${err.stdout}\n`;
        }
        if (err.stderr) {
            logContent += `STDERR      :\n${err.stderr}\n`;
        }
        if (err.stack) {
            logContent += `STACK TRACE :\n${err.stack}\n`;
        }
        
        logContent += `OPTIONS     : ${JSON.stringify(options, null, 2)}\n`;
        logContent += `==================================================\n\n`;
        
        fs.appendFileSync(logPath, logContent, 'utf8');
        logTable('INFO', 'System', `Detail log error disimpan di: ytdl_error.log`);
    } catch (e) {
        logTable('ERROR', 'System', `Gagal menulis berkas log error: ${e.message}`);
    }
}
 
async function downloadFromY2Mate(url, isAudio) {
    try {
        logTable('INFO', 'System', 'Mencoba mengunduh video menggunakan fallback Y2Mate Scraper...');
        
        // 1. Ekstrak Video ID
        const idRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(idRegex);
        if (!match) throw new Error("Format URL YouTube tidak valid");
        const videoId = match[1];
 
        // 2. Ambil token/key analisis dari Y2Mate
        const analyzeUrl = 'https://www.y2mate.com/mates/en/analyze/ajax';
        const analyzeBody = querystring.stringify({
            url: `https://www.youtube.com/watch?v=${videoId}`,
            q_auto: 0,
            ajax: 1
        });
 
        const analyzeRes = await fetch(analyzeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: analyzeBody
        });
 
        if (!analyzeRes.ok) throw new Error(`Gagal menghubungi server Y2Mate (Status ${analyzeRes.status})`);
        const analyzeData = await analyzeRes.json();
        
        if (analyzeData.status !== 'success' || !analyzeData.result) {
            throw new Error("Gagal menganalisis video di Y2Mate");
        }
 
        const html = analyzeData.result;
        
        // 3. Cari k-parameter untuk kualitas yang diinginkan
        let k = '';
        let ftype = isAudio ? 'mp3' : 'mp4';
        let fquality = isAudio ? '128k' : '360p'; // default 360p video atau 128k audio
 
        const submitMatches = [...html.matchAll(/ajaxSubmit\('([^']+)',\s*'([^']+)'\)/g)];
        if (submitMatches.length === 0) {
            throw new Error("Gagal mengambil k-parameter dari Y2Mate");
        }
 
        if (isAudio) {
            const mp3Match = submitMatches.find(m => {
                const idx = html.indexOf(m[0]);
                const snippet = html.substring(idx - 200, idx + 200);
                return snippet.includes('.mp3') || snippet.includes('Audio');
            });
            k = mp3Match ? mp3Match[2] : submitMatches[0][2];
            ftype = 'mp3';
            fquality = '128';
        } else {
            let videoMatch = submitMatches.find(m => {
                const idx = html.indexOf(m[0]);
                const snippet = html.substring(idx - 200, idx + 200);
                return snippet.includes('360p') && snippet.includes('.mp4');
            });
            
            if (!videoMatch) {
                videoMatch = submitMatches.find(m => {
                    const idx = html.indexOf(m[0]);
                    const snippet = html.substring(idx - 200, idx + 200);
                    return snippet.includes('720p') && snippet.includes('.mp4');
                });
            }
 
            if (!videoMatch) {
                videoMatch = submitMatches.find(m => {
                    const idx = html.indexOf(m[0]);
                    const snippet = html.substring(idx - 200, idx + 200);
                    return snippet.includes('.mp4');
                });
            }
 
            k = videoMatch ? videoMatch[2] : submitMatches[0][2];
            ftype = 'mp4';
            fquality = videoMatch ? (html.substring(html.indexOf(videoMatch[0]) - 200, html.indexOf(videoMatch[0]) + 200).match(/\d+p/) || ['360p'])[0].replace('p', '') : '360';
        }
 
        // 4. Konversi / dapatkan link unduhan direct
        const convertUrl = 'https://www.y2mate.com/mates/en/convert';
        const convertBody = querystring.stringify({
            type: 'youtube',
            _id: videoId,
            v_id: videoId,
            ajax: 1,
            token: '',
            ftype: ftype,
            fquality: fquality,
            k: k
        });
 
        const convertRes = await fetch(convertUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: convertBody
        });
 
        if (!convertRes.ok) throw new Error(`Gagal konversi link di Y2Mate (Status ${convertRes.status})`);
        const convertData = await convertRes.json();
 
        if (convertData.status !== 'success' || !convertData.result) {
            throw new Error("Gagal mendapatkan link konversi dari Y2Mate");
        }
 
        const dlinkMatch = convertData.result.match(/href="([^"]+)"/);
        if (!dlinkMatch) throw new Error("Link unduhan langsung tidak ditemukan dalam respons Y2Mate");
        const directLink = dlinkMatch[1].replace(/&amp;/g, '&');
 
        // 5. Unduh berkasnya ke folder TEMP
        const ext = ftype;
        const outFileName = `media_${timestamp}_1.${ext}`;
        const outPath = path.join(TEMP_DIR, outFileName);
 
        logTable('INFO', 'System', `Mulai mengunduh file media langsung dari CDN Y2Mate...`);
        const mediaRes = await fetch(directLink);
        if (!mediaRes.ok) throw new Error(`Gagal mengunduh file dari CDN (Status ${mediaRes.status})`);
 
        const mediaBuffer = await mediaRes.arrayBuffer();
        fs.writeFileSync(outPath, Buffer.from(mediaBuffer));
 
        logTable('SUCCESS', 'System', `File berhasil diunduh via Y2Mate: ${outFileName}`);
        return [outPath];
    } catch (err) {
        logTable('ERROR', 'System', `Y2Mate Fallback Gagal: ${err.message}`);
        throw err;
    }
}
 
async function getVideoInfo(url) {
    try {
        const options = {
            dumpSingleJson: true,
            noWarnings: true,
            noCheckCertificate: true,
            ignoreNoFormatsError: true, // Penting untuk IG Slide Foto
            forceIpv4: true // Paksa IPv4 untuk menghindari blokir IPv6 di VPS
        };
        
        // Gunakan cookies jika tersedia (sangat direkomendasikan untuk bypass blokir IP YouTube/Instagram di VPS)
        if (fs.existsSync(COOKIES_PATH) && (url.includes('instagram.com') || url.includes('youtube.com') || url.includes('youtu.be'))) {
            options.cookies = COOKIES_PATH;
        }

        // Bypass blokir IP YouTube dengan memicu fallback ke android dan web player client
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            options.extractorArgs = 'youtube:player-client=android,web,default';
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
        // Tulis detail log error ke berkas log utama
        writeErrorLog(url, 'GET_VIDEO_INFO', err, options);
 
        // Cek jika error format dan belum pernah update biner
        if (err.message.includes('No video formats found') && !global.hasUpdatedYtDlp) {
            global.hasUpdatedYtDlp = true;
            const updated = await updateYtDlpBinary();
            if (updated) {
                logTable('INFO', 'System', 'Mencoba kembali mengambil info video dengan biner baru...');
                return await getVideoInfo(url); // Coba ulang sekali lagi
            }
        }
 
        // FALLBACK KEDUA: Jika yt-dlp gagal mem-bypass blokir YouTube, coba gunakan Y2Mate API Scraper
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            try {
                logTable('WARN', 'System', 'yt-dlp diblokir YouTube, beralih menggunakan Y2Mate Scraper...');
                const idRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
                const match = url.match(idRegex);
                const videoId = match ? match[1] : '';
                return {
                    title: "YouTube Video (Y2Mate Fallback)",
                    duration: 0,
                    uploader: "YouTube",
                    thumbnail: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '',
                    _is_y2mate: true,
                    _video_id: videoId
                };
            } catch (e) {
                logTable('ERROR', 'System', `Fallback Y2Mate juga gagal: ${e.message}`);
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

    // FALLBACK Y2MATE (Jika video info diselamatkan oleh Y2Mate)
    if (info && info._is_y2mate) {
        return await downloadFromY2Mate(url, isAudio);
    }
 
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
        playlistEnd: 10,
        forceIpv4: true // Paksa IPv4 untuk menghindari blokir IPv6 di VPS
    };

    // Bypass blokir IP YouTube (terutama di VPS/Colab) dengan memicu fallback ke android dan web player client
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        options.extractorArgs = 'youtube:player-client=android,web,default';
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
        // Tulis detail log error ke berkas log utama
        writeErrorLog(url, `DOWNLOAD_${type.toUpperCase()}`, err, options);
 
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
 
        // FALLBACK KEDUA: Jika yt-dlp gagal mengunduh, coba unduh menggunakan Y2Mate
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            try {
                logTable('WARN', 'System', 'yt-dlp gagal mengunduh media, mencoba mengunduh via Y2Mate...');
                return await downloadFromY2Mate(url, isAudio);
            } catch (fallbackErr) {
                logTable('ERROR', 'System', `Fallback Y2Mate juga gagal: ${fallbackErr.message}`);
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
