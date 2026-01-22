const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const sourceDir = __dirname;
const stagingDir = path.join(__dirname, 'dist_staging');

// Files/Folders to ignore
const ignoreList = ['node_modules', 'dist_production', 'dist_staging', '.git', '.gemini', 'brain', 'obfuscate.js', 'package-lock.json'];

function copyRecursiveSync(src, dest) {
    const exists = fs.existsSync(src);
    const stats = exists && fs.statSync(src);
    const isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest);
        fs.readdirSync(src).forEach((childItemName) => {
            if (!ignoreList.includes(childItemName)) {
                copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
            }
        });
    } else {
        fs.copyFileSync(src, dest);
    }
}

function obfuscateFile(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    const obfuscatedCode = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.75,
        numbersToExpressions: true,
        simplify: true,
        stringArrayThreshold: 0.75,
        splitStrings: true,
        splitStringsChunkLength: 10
    }).getObfuscatedCode();
    fs.writeFileSync(filePath, obfuscatedCode, 'utf8');
}

function processDirectory(dir) {
    fs.readdirSync(dir).forEach((file) => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDirectory(fullPath);
        } else if (file.endsWith('.js')) {
            console.log(`Obfuscating: ${fullPath}`);
            obfuscateFile(fullPath);
        }
    });
}

console.log('--- STARTING OBFUSCATION PROCESS ---');

// 1. Clean & Create Staging
if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir);

// 2. Copy files to Staging
console.log('Copying files to staging...');
copyRecursiveSync(sourceDir, stagingDir);

// 3. Obfuscate JS files in Staging
console.log('Applying obfuscation...');
processDirectory(stagingDir);

console.log('--- OBFUSCATION COMPLETE ---');
