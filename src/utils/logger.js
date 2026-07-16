const Table = require('cli-table3');
const chalk = require('chalk');

/**
 * Fungsi utilitas untuk mencetak baris log ke terminal dalam bentuk tabel.
 * @param {string} type - Jenis event (contoh: SUCCESS, ERROR, COMMAND, INFO, dll)
 * @param {string} user - Nama pengguna (jika tidak ada gunakan '-')
 * @param {string} desc - Deskripsi kejadian
 */
function logTable(type, user, desc) {
    const time = new Date().toLocaleTimeString('id-ID', { hour12: false });
    
    // Konfigurasi pewarnaan latar berdasarkan tipe log
    let typeColored = type;
    switch (type) {
        case 'SUCCESS': typeColored = chalk.bgGreen.black(` ${type} `); break;
        case 'ERROR':   typeColored = chalk.bgRed.white(` ${type} `); break;
        case 'COMMAND': typeColored = chalk.bgCyan.black(` ${type} `); break;
        case 'QUEUE':   typeColored = chalk.bgMagenta.white(` ${type} `); break;
        case 'DOWNLOAD':typeColored = chalk.bgBlue.white(` ${type} `); break;
        case 'INFO':    typeColored = chalk.bgYellow.black(` ${type} `); break;
        default:        typeColored = chalk.bgWhite.black(` ${type} `); break;
    }

    // Inisialisasi tabel satu baris
    const table = new Table({
        chars: {
            'top': '─', 'top-mid': '┬', 'top-left': '┌', 'top-right': '┐',
            'bottom': '─', 'bottom-mid': '┴', 'bottom-left': '└', 'bottom-right': '┘',
            'left': '│', 'left-mid': '├',
            'mid': '─', 'mid-mid': '┼',
            'right': '│', 'right-mid': '┤',
            'middle': '│'
        },
        colWidths: [12, 14, 20, 60],
        wordWrap: true
    });

    table.push([
        chalk.gray(time),
        typeColored,
        chalk.green(user),
        chalk.white(desc)
    ]);

    console.log(table.toString());
}

module.exports = {
    logTable
};
