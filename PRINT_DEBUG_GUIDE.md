# 🧪 PRINT DEBUG MODE - TESTING GUIDE

## Current Setup:
✅ Background: BLACK (untuk visibility test)
✅ Manual Lines: WHITE 3px solid
✅ Boxes: White border, dark background
✅ Text: White color

## Test Instructions:

### 1. Test Line Tool
1. Buka `build.html` di browser
2. Klik icon "Line Tool" di sidebar (icon kedua dari atas)
3. Button harus menyala BIRU (active state)
4. Klik di canvas untuk titik awal → muncul bulatan KUNING
5. Klik lagi untuk titik akhir → garis HITAM terbentuk
6. Hover garis → tombol X merah muncul
7. Buat 3-4 garis sebagai test

### 2. Test Print Preview
1. Klik tombol Print (icon printer di sidebar bawah)
2. Print preview window terbuka
3. **PERIKSA:**
   - ✅ Background HITAM?
   - ✅ Garis PUTIH tebal keliatan?
   - ✅ Kotak-kotak ada border putih?
   - ✅ Text berwarna putih?
   - ✅ Semua tidak terpotong?

### 3. Test Save/Load
1. Save template dengan garis (klik SIMPAN)
2. Refresh halaman
3. Load template (klik MUAT)
4. Garis harus balik semua!

## Expected Results:

**✅ SUKSES jika:**
- Background print = HITAM solid
- Garis manual = PUTIH tebal (3px)
- Semua elemen visible
- Tidak ada yang terpotong

**❌ GAGAL jika:**
- Background masih putih
- Garis tidak muncul
- Elemen terpotong di tepi

## Debug Checklist:

- [ ] Line Tool button berfungsi (klik = aktif)
- [ ] Garis terbentuk saat klik 2x di canvas
- [ ] Garis terlihat di screen (hitam 2px)
- [ ] Print preview background HITAM
- [ ] Print preview garis PUTIH
- [ ] Save/Load berfungsi (garis persist)

---

## Jika Masih Gagal:
1. Buka Console (F12)
2. Check error messages
3. Screenshot print preview
4. Report ke developer

## Reverting to Normal (White Background):
Setelah debug selesai, ganti CSS @media print:
- background: #000000 → background: white
- lines: #FFFFFF → #000000
- borders: #FFFFFF → #000000
