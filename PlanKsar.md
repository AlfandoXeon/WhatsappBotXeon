Nama Aplikasi = XeonBot()
Bahasa = Nodejs




saya ingin membuat bot whatsapp downloader yang bernama XeonBot()
menggunakan bahasa nodejs saja (baileys dan yt-dlp)
nanti setiap ada orang yang mengirim link youtube ke nomor bot tsb..
maka bot akan memproses, dan mengirimkan video / media dalam bentuk dokumen..
apakah bisa
coba anda buat implementation plan nya terlebih dahulu..
dan tambahkan fitur yang menurut anda berguna untuk bot ini..
niatnya saya tidak hanya berhenti pada yt downloader, tetapi semua platform media sosiial..
ya adalah user, saya mengirim link instagram ke bot, bot akan mendeteksi bahwa itu adalah link instagram, dan langsung memproses video nya, dan mengirim saya video instagram tsb dalam bentuk dokumen..
dan text untuk info dari video nya.. 
jika ada yang ingin anda tanyakan lebih lanjut silahkan saja


Berikut adalah plan kasar saya




---

## Ringkasan Proyek & Arsitektur Utama

XeonBot() dirancang menggunakan arsitektur *Event-Driven* berbasis **Node.js** sebagai *orchestrator*, **Baileys** untuk menangani protokol WhatsApp secara asinkron, dan **yt-dlp** sebagai mesin pengekstraksi media universal.

### Alur Kerja Data (Data Flow)

```
[User Link] ➔ [Baileys Gateway] ➔ [Regex Router] ➔ [Metadata Validator]
                                                            │
[Document Sent] 🔀 [Local Storage Cleanup] ◀ [yt-dlp Engine] ◀ [Queue Worker]

```

---

## Panduan Implementasi Tahap demi Tahap

### Tahap 1: Setup Autentikasi dan Inisialisasi Gateway

Jangan gunakan penyimpanan memori sederhana untuk Baileys. Anda wajib menggunakan `useMultiFileAuthState` agar sesi bot tetap bertahan ketika server *restart* tanpa perlu melakukan *scan* ulang QR Code.

* **Implementasi:** Simpan data sesi di folder lokal yang terisolasi (misalnya `./auth_info_baileys`).
* **Logika Penanganan Koneksi:** Buat pendengar (*listener*) untuk `connection.update`. Jika koneksi terputus dengan alasan `DisconnectReason.loggedOut`, hapus folder autentikasi secara otomatis untuk memicu pembuatan QR Code baru pada *log* konsol.

### Tahap 2: Validasi Tahap 1 – Sinkronisasi Pesan & Regex Routing

Ketika pesan masuk melalui `messages.upsert`, bot harus menyaring pesan masuk sebelum melakukan operasi I/O apa pun.

```javascript
// Contoh Logika Penyaringan Awal
const message = m.messages[0];
if (!message.message || message.key.fromMe) return;

const text = message.message.conversation || 
             message.message.extendedTextMessage?.text || "";

// Ekstraksi URL menggunakan Regex global
const urlRegex = /(https?:\/\/[^\s]+)/g;
const match = text.match(urlRegex);
if (!match) return; // Abaikan jika tidak ada link

```

Setelah URL didapatkan, validasi tipe platform menggunakan ekspresi reguler yang ketat:

* **YouTube:** `/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/`
* **Instagram:** `/^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|tv)\/.+$/`
* **TikTok:** `/^(https?:\/\/)?([a-z]{2,3}\.)?tiktok\.com\/.+$/`

> **Aturan Tegas:** Jika URL tidak cocok dengan platform yang didukung, kirim pesan penolakan secara instan: *"Platform tidak didukung."* Jangan teruskan ke proses berikutnya untuk menghemat komputasi server.

### Tahap 3: Validasi Tahap 2 – Pra-Unduh (Metadata & Pengecekan Batasan)

Ini adalah titik kritis di mana sebagian besar pengembang pemula gagal. **Jangan langsung mengunduh file.** Anda harus memeriksa konten video tersebut terlebih dahulu tanpa mengunduhnya.

* Jalankan perintah `yt-dlp --dump-json [URL]`.
* Ekstrak informasi penting dari *output* JSON tersebut:
1. `filesize` atau `filesize_approx` (Perkiraan ukuran file).
2. `duration` (Durasi dalam detik).
3. `description` atau `title` (Untuk dijadikan *caption* WhatsApp).



#### Aturan Batasan Validasi:

| Parameter | Batas Maksimal | Tindakan Jika Melanggar |
| --- | --- | --- |
| **Ukuran File** | 100 MB | Cari resolusi lebih rendah via `yt-dlp`. Jika tetap >100MB, batalkan dan kirim pesan: *"File terlalu besar (Maks 100MB)"* |
| **Durasi** | 900 detik (15 Menit) | Batalkan proses secara instan untuk mencegah pembengkakan CPU server. |

---

## Fitur-Fitur Lanjutan & Mekanisme Pertahanan

### 1. Sistem Antrean Asinkron (Concurrency Control)

Jika 10 pengguna mengirim link secara bersamaan, server Anda akan menjalankan 10 proses `yt-dlp` sekaligus. Ini akan menghabiskan memori RAM dan membuat Baileys kehilangan koneksi (*ping timeout*).

* **Solusi:** Implementasikan sistem antrean menggunakan array atau pustaka seperti `async.queue`.
* **Konfigurasi Batas:** Setel tingkat konkurensi maksimal **2 atau 3 proses unduhan aktif secara bersamaan**.
* **Interaksi Pengguna:** Ketika pengguna mengirim link dan antrean penuh, bot harus membalas: *"Permintaan Anda ada di urutan ke-[X]. Mohon tunggu."*

### 2. Auto-Downscaling & Ekstraksi Cerdas

Jangan biarkan bot Anda menyerah hanya karena video asli berukuran 1080p 200MB. Gunakan argumen pemilihan format pada `yt-dlp` untuk membatasi ukuran file secara dinamis.

* **Argumen Perintah `yt-dlp`:**
```bash
yt-dlp -f "best[filesize<100M]/bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best" --merge-output-format mp4 [URL]

```


*Perintah di atas memaksa mesin mencari format terbaik yang ukurannya di bawah 100MB atau otomatis menurunkan resolusi ke 720p dengan ekstensi `.mp4` agar kompatibel dengan pemutar bawaan WhatsApp.*

### 3. Rotasi Cookie Instagram (Anti-Scraping Defense)

Instagram akan memblokir alamat IP server Anda jika mendeteksi aktivitas pengunduhan berulang tanpa sesi login.

* **Solusi:** Anda harus mengekstrak berkas `cookies.txt` dari akun Instagram sekunder (akun tumbal) menggunakan ekstensi browser seperti *Get Cookies.txt*.
* Simpan berkas tersebut di server dan panggil menggunakan flag `--cookie cookies.txt` di dalam argumen `yt-dlp`.
* **Fitur Keamanan:** Buat mekanisme di mana jika `yt-dlp` mengembalikan eror kode `403 Forbidden` pada link Instagram, bot otomatis mengganti ke berkas `cookies2.txt` (sistem rotasi).

### 4. Manajemen Penyimpanan & Pembersih Sampah Otomatis (Garbage Collector)

File video yang berhasil diunduh akan disimpan di folder lokal sementara (misalnya `./temp`). Jika tidak dikelola, penyimpanan server Anda akan penuh dalam hitungan hari.

* **Alur Penghapusan:** Gunakan blok `try...finally` dalam kode Node.js Anda.
* Pastikan fungsi `fs.unlinkSync(filePath)` dijalankan segera setelah fungsi `sock.sendMessage()` menyelesaikan tugasnya (baik pengiriman tersebut berhasil maupun gagal karena masalah jaringan).
* **Cron Job Cadangan:** Buat fungsi `setInterval` yang berjalan setiap 30 menit untuk memindai folder `./temp` dan menghapus file apa pun yang waktu modifikasinya (*mtime*) sudah lebih dari 20 menit yang lalu. Ini mengantisipasi file sampah dari proses unduhan yang terhenti di tengah jalan karena bot macet.

### 5. Format Pengiriman Dokumen

Kirim media menggunakan tipe pesan dokumen, bukan video biasa, untuk menjaga kualitas asli serta menghindari pembatasan kompresi otomatis oleh WhatsApp.

* Setel properti `mimetype` secara manual ke `video/mp4` atau `audio/mpeg` (jika pengguna meminta format audio).
* Masukkan judul video asli sebagai properti `fileName` agar dokumen yang diterima pengguna memiliki nama yang rapi, bukan kode acak string.




