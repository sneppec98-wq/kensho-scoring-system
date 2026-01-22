const REPO_OWNER = 'sneppec98-wq';
const REPO_NAME = 'kensho-scoring-system';

async function fetchLatestRelease() {
    const downloadLink = document.getElementById('download-link');
    const downloadText = document.getElementById('download-text');
    const versionInfo = document.getElementById('version-info');

    try {
        const response = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`);

        if (!response.ok) throw new Error('Gagal mengambil data dari GitHub');

        const data = await response.json();
        const version = data.tag_name;

        // Cari file .exe
        const asset = data.assets.find(a => a.name.endsWith('.exe'));

        if (asset) {
            downloadLink.href = asset.browser_download_url;
            downloadLink.classList.remove('disabled');
            downloadText.innerText = `Download v${version.replace('v', '')}`;
            versionInfo.innerText = `Versi Terbaru: ${version} (${(asset.size / (1024 * 1024)).toFixed(1)} MB)`;
        } else {
            throw new Error('File installer tidak ditemukan');
        }

    } catch (error) {
        console.error(error);
        versionInfo.innerText = 'Gagal memuat versi terbaru. Silakan muat ulang halaman.';
        downloadText.innerText = 'Coba Lagi';
    }
}

document.addEventListener('DOMContentLoaded', fetchLatestRelease);
