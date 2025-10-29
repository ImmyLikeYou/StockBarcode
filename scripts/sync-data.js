const fs = require('fs').promises;
const path = require('path');

const DATA_FILES = ['inventory.json', 'products.json', 'transactions.json'];
const SOURCE_DIR = path.join(process.env.APPDATA || process.env.HOME, '.barcode-inventory');
const TARGET_DIR = path.join(__dirname, '..', 'app-data');

async function ensureDir(dirPath) {
    try {
        await fs.access(dirPath);
    } catch {
        await fs.mkdir(dirPath, { recursive: true });
    }
}

async function syncData(source, target, file) {
    console.log(`Syncing ${file}...`);
    try {
        const sourceFile = path.join(source, file);
        const targetFile = path.join(target, file);

        // Check if source file exists
        try {
            await fs.access(sourceFile);
        } catch {
            console.log(`Source file ${file} does not exist, skipping...`);
            return;
        }

        // Read source file
        const sourceData = await fs.readFile(sourceFile, 'utf8');

        try {
            // Check if target file exists and read it
            const targetData = await fs.readFile(targetFile, 'utf8');

            // Parse both files (will throw if invalid JSON)
            const sourceJson = JSON.parse(sourceData);
            const targetJson = JSON.parse(targetData);

            // Write newer file to older location
            const sourceTime = (await fs.stat(sourceFile)).mtime;
            const targetTime = (await fs.stat(targetFile)).mtime;

            if (sourceTime > targetTime) {
                console.log(`  Source is newer, copying to target`);
                await fs.writeFile(targetFile, sourceData);
            } else {
                console.log(`  Target is newer, copying to source`);
                await fs.writeFile(sourceFile, targetData);
            }
        } catch (err) {
            if (err.code === 'ENOENT') {
                // Target doesn't exist, copy from source
                console.log(`  Target missing, copying from source`);
                await fs.writeFile(targetFile, sourceData);
            } else {
                throw err; // Re-throw other errors
            }
        }

        console.log(`  Done syncing ${file}`);
    } catch (err) {
        console.error(`Error syncing ${file}:`, err);
    }
}

async function main() {
    try {
        // Ensure both directories exist
        await ensureDir(SOURCE_DIR);
        await ensureDir(TARGET_DIR);

        // Sync each data file
        for (const file of DATA_FILES) {
            await syncData(SOURCE_DIR, TARGET_DIR, file);
        }

        console.log('All files synced successfully!');
    } catch (err) {
        console.error('Sync failed:', err);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}