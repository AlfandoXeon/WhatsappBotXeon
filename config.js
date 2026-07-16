module.exports = {
    botName: "XeonBot",
    ownerName: "AlfandoXeon",
    ownerNumber: "6285764175824", // Masukkan nomor lengkap dengan kode negara, tanpa '+'
    public: true, // Jika false, bot hanya merespons pesan dari owner
    autoRead: true, // Jika true, pesan yang masuk otomatis terbaca (centang biru)
    menuThumbnail: 'thumbnail/thumbv3.png', // Path ke gambar thumbnail menu bot
    features: [
        { cmd: 'menu', desc: 'Menampilkan daftar menu bot' },
        { cmd: 'ping', desc: 'Cek status respons bot' },
        { cmd: 'status', desc: 'Cek jumlah antrean unduhan saat ini' },
        { cmd: 'play <judul>', desc: 'Cari & download video YouTube (Tampil di Galeri)' },
        { cmd: 'playmusic <judul>', desc: 'Cari & download lagu MP3 dari YouTube' },
        { cmd: 'ytdl <link>', desc: 'Download video YouTube kualitas terbaik (Dokumen)' },
        { cmd: 'tt <link>', desc: 'Download Video / Carousel TikTok kualitas HD (Galeri)' },
        { cmd: 'ig <link>', desc: 'Download Video / Carousel Foto Instagram (Galeri)' },
        { cmd: 's / sticker', desc: 'Membuat stiker dari gambar/video. Bisa custom nama (ex: #s Pack | Author)' },
        { cmd: 'toimg', desc: 'Mengubah stiker kembali menjadi gambar atau video' },
        { cmd: 'add <nomor>', desc: 'Menambahkan anggota ke grup (Admin Only)' },
        { cmd: 'kick @tag', desc: 'Mengeluarkan anggota dari grup (Admin Only)' },
        { cmd: 'tagall', desc: 'Memanggil seluruh anggota grup (Admin Only)' },
        { cmd: 'hidetag <pesan>', desc: 'Tag seluruh anggota secara tersembunyi (Admin Only)' },
        { cmd: 'suit @tag', desc: 'Tantang seseorang bermain batu-gunting-kertas' },
        { cmd: 'jadian', desc: 'Cari pasangan acak di grup' }
    ],

    // Default Sticker Metadata
    stickerPack: "Dibuat oleh",
    stickerAuthor: "XeonBot",

    // Global Messages (Teks balasan bot yang bisa diedit)
    messages: {
        waitInfo: 'mengambil info media...',
        waitQueue: '...',
        downloading: 'memproses unduhan anda<>',
        search: 'mencari media yang sesuai...<>',
        success: 'berhasil kak<>',
        errLink: '❌ Link tidak valid!',
        errPlatform: '❌ Platform tidak didukung. Harap gunakan link YouTube, Instagram, atau TikTok.',
        errDuration: '❌ Durasi video terlalu panjang! Maksimal 15 menit.',
        errNotFound: '❌ Video/Lagu tidak ditemukan.',
        errSystem: '❌ Terjadi kesalahan pada sistem:',
        errNotGroup: '❌ Perintah ini hanya bisa digunakan di dalam grup!',
        errNotAdmin: '❌ Anda bukan Admin grup!',
        errBotNotAdmin: '❌ Bot harus dijadikan Admin terlebih dahulu untuk menjalankan perintah ini!'
    }
};
