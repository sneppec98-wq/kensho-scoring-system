$path = "c:/Users/KIM/Downloads/Kensho/AplikasiScoring/event-detail.html"
$content = [System.IO.File]::ReadAllText($path)

# Fix redundant if at line 3260
$content = $content -replace "(?m)^\s+if\r?\n\s+if \(classData\.code && classData\.name\) {", "                                if (classData.code && classData.name) {"

# Fix renderContingentTracking NEW DISCOVERY split tag
$content = $content -replace "(?s)\$\{isDiscovered\s*\?\s*'<span\s+class=\\\"text-\[7px\] text-indigo-400 font-black tracking-tighter uppercase leading-none mt-1\\\" > NEW\s+DISCOVERY</span > ' : ''\}", "`${isDiscovered ? '<span class=\"text-[7px] text-indigo-400 font-black tracking-tighter uppercase leading-none mt-1\">NEW DISCOVERY</span>' : ''}`"

# Fix renderContingentTracking SUDAH MASUK split tag
$content = $content -replace "(?s)<span\s+class=\\\"px-3 py-1 rounded-full text-\[8px\] font-black bg-green-500/20 text-green-400 border border-green-500/30\\\">SUDAH\s+MASUK ✅</span>", "<span class=\"px-3 py-1 rounded-full text-[8px] font-black bg-green-500/20 text-green-400 border border-green-500/30\">SUDAH MASUK ✅</span>"

# Fix renderContingentTracking BELUM ADA DATA split tag
$content = $content -replace "(?s)<span\s+class=\\\"px-3 py-1 rounded-full text-\[8px\] font-black bg-slate-800 text-slate-500 border border-white/5 opacity-40\\\">BELUM\s+ADA DATA ⏳</span>", "<span class=\"px-3 py-1 rounded-full text-[8px] font-black bg-slate-800 text-slate-500 border border-white/5 opacity-40\">BELUM ADA DATA ⏳</span>"

[System.IO.File]::WriteAllText($path, $content)
