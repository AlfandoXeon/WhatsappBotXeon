const fs = require('fs');
const path = require('path');
const pino = require('pino');

const logger = pino({ level: 'info' });
const TEMP_DIR = path.join(__dirname, '../../temp');

if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

function deleteFile(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logger.info(`Deleted file: ${filePath}`);
        }
    } catch (err) {
        logger.error(`Failed to delete file ${filePath}: ${err.message}`);
    }
}

function startGarbageCollector() {
    setInterval(() => {
        logger.info('Running garbage collector for temp dir...');
        fs.readdir(TEMP_DIR, (err, files) => {
            if (err) {
                logger.error('GC failed to read temp dir:', err.message);
                return;
            }

            const now = Date.now();
            const MAX_AGE = 20 * 60 * 1000;

            files.forEach(file => {
                const filePath = path.join(TEMP_DIR, file);
                fs.stat(filePath, (err, stats) => {
                    if (err) return;
                    
                    const age = now - stats.mtimeMs;
                    if (age > MAX_AGE) {
                        deleteFile(filePath);
                        logger.info(`GC deleted stale file: ${filePath}`);
                    }
                });
            });
        });
    }, 30 * 60 * 1000);
}

module.exports = {
    TEMP_DIR,
    deleteFile,
    startGarbageCollector
};
