import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class RankingPage extends StatelessWidget {
  const RankingPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Color(0xFF0F172A), size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'RANKING REGIONAL',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF0F172A),
          ),
        ),
      ),
      body: Column(
        children: [
          // Professional Disclaimer
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            color: const Color(0xFFEFF6FF), // Blue 50
            child: Row(
              children: [
                const Icon(Icons.info_outline_rounded, color: Color(0xFF2563EB), size: 18),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Seluruh data yang tersaji berasal eksklusif dari hasil pertandingan yang dikelola melalui ekosistem teknologi Kensho Tech.',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF1E40AF), // Blue 800
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // Filter Section
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            color: Colors.white,
            child: Column(
              children: [
                Row(
                  children: [
                    Expanded(
                      child: _buildDropdownFilter(
                        'Pilih Region',
                        ['Semua Region', 'Jawa Timur', 'Jawa Barat', 'DKI Jakarta'],
                        Icons.map_rounded,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildDropdownFilter(
                        'Pilih Kota/Kab',
                        ['Semua Kota', 'Malang', 'Surabaya', 'Sidoarjo', 'Gresik'],
                        Icons.location_city_rounded,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: _buildDropdownFilter(
                        'Kategori',
                        ['Semua Kategori', 'Kumite Perorangan', 'Kata Perorangan', 'Kata Beregu'],
                        Icons.sports_martial_arts_rounded,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: _buildDropdownFilter(
                        'Kelompok Usia',
                        [
                          'Semua Umur', 'PRA USIA DINI', 'USIA DINI', 'PRA PEMULA', 
                          'PEMULA', 'KADET', 'JUNIOR', 'UNDER 21', 'SENIOR'
                        ],
                        Icons.calendar_today_rounded,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          
          // Leaderboard
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.all(24),
              itemCount: 15,
              itemBuilder: (context, index) {
                return _buildRankingItem(index + 1);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDropdownFilter(String hint, List<String> items, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(12),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: items.first,
          isExpanded: true,
          icon: const Icon(Icons.expand_more_rounded, color: Color(0xFF64748B)),
          style: GoogleFonts.plusJakartaSans(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: const Color(0xFF0F172A),
          ),
          items: items.map((String value) {
            return DropdownMenuItem<String>(
              value: value,
              child: Row(
                children: [
                  Icon(icon, size: 16, color: const Color(0xFF64748B)),
                  const SizedBox(width: 8),
                  Text(value),
                ],
              ),
            );
          }).toList(),
          onChanged: (_) {},
        ),
      ),
    );
  }

  Widget _buildRankingItem(int rank) {
    bool isTopThree = rank <= 3;
    Color rankColor = rank == 1 ? const Color(0xFFF59E0B) : 
                     rank == 2 ? const Color(0xFF94A3B8) :
                     rank == 3 ? const Color(0xFFB45309) : const Color(0xFF64748B);

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isTopThree ? rankColor.withOpacity(0.3) : const Color(0xFFE2E8F0),
          width: isTopThree ? 2 : 1,
        ),
        boxShadow: isTopThree ? [
          BoxShadow(
            color: rankColor.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 4),
          )
        ] : null,
      ),
      child: Row(
        children: [
          // Rank Number
          SizedBox(
            width: 40,
            child: Text(
              '#$rank',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 18,
                fontWeight: FontWeight.w900,
                color: rankColor,
              ),
            ),
          ),
          
          // Athlete Info
          const CircleAvatar(
            radius: 20,
            backgroundColor: Color(0xFFF1F5F9),
            child: Icon(Icons.person, color: Color(0xFF94A3B8), size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Atlet Berbakat #$rank',
                  style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF0F172A),
                    fontSize: 14,
                  ),
                ),
                Text(
                  'Kensho Dojo Indonesia',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: const Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),
          
          // Points
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${2500 - (rank * 100)}',
                style: GoogleFonts.plusJakartaSans(
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF0F172A),
                  fontSize: 16,
                ),
              ),
              Text(
                'PTS',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF94A3B8),
                  letterSpacing: 1,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
