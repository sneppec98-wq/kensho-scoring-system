import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/scoring_service.dart';

class MatchPage extends StatefulWidget {
  const MatchPage({super.key});

  @override
  State<MatchPage> createState() => _MatchPageState();
}

class _MatchPageState extends State<MatchPage> {
  final ScoringService _scoringService = ScoringService();
  
  // Data for selected match (Live monitored)
  String _selectedTitle = 'PILIH TATAMI';
  String _redName = '-';
  String _redTeam = '-';
  String _redScore = '0';
  String _blueName = '-';
  String _blueTeam = '-';
  String _blueScore = '0';
  String _time = '00:00';
  String _currentTatamiId = '';

  @override
  void dispose() {
    _scoringService.stopListening();
    super.dispose();
  }

  void _selectTatami(String tatamiId, String title) {
    if (_currentTatamiId == tatamiId) return;

    setState(() {
      _currentTatamiId = tatamiId;
      _selectedTitle = title;
      // Reset scores while waiting for first update
      _redScore = '0';
      _blueScore = '0';
      _time = '00:00';
    });

    _scoringService.listenToLiveScore(tatamiId, (data) {
      if (mounted) {
        setState(() {
          _redName = data['nameAka'] ?? '-';
          _redTeam = data['teamAka'] ?? '-';
          _redScore = (data['akaScore'] ?? 0).toString();
          
          _blueName = data['nameAo'] ?? '-';
          _blueTeam = data['teamAo'] ?? '-';
          _blueScore = (data['aoScore'] ?? 0).toString();
          
          _time = data['timerText'] ?? '00:00';
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'PERTANDINGAN LIVE',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF0F172A),
          ),
        ),
        actions: [
          if (_currentTatamiId.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.stop_circle_outlined, color: Colors.red),
              onPressed: () {
                _scoringService.stopListening();
                setState(() => _currentTatamiId = '');
              },
              tooltip: 'Berhenti Memantau',
            ),
        ],
      ),
      body: Column(
        children: [
          // TOP AREA: Scoring Information (Fixed)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(bottom: BorderSide(color: Color(0xFFE2E8F0))),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildMatchHeader(_selectedTitle),
                const SizedBox(height: 16),
                _buildLiveScoreCard(
                  _redName, _redTeam, _redScore,
                  _blueName, _blueTeam, _blueScore,
                  _time,
                ),
              ],
            ),
          ),

          // BOTTOM AREA: Class / Match List
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                Text(
                  'SINKRONISASI TATAMI (LIVE REALTIME)',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: const Color(0xFF94A3B8),
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 16),
                _buildTatamiItem('tatami1', 'TATAMI 1 (UTAMA)'),
                const SizedBox(height: 12),
                _buildTatamiItem('tatami2', 'TATAMI 2'),
                const SizedBox(height: 12),
                _buildTatamiItem('tatami3', 'TATAMI 3'),
                const SizedBox(height: 24),
                
                // Info Box
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.bolt, color: Color(0xFF2563EB), size: 18),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Menggunakan Mode Hemat: Data skor ditarik dari jalur Relay Supabase, bukan Firebase Firestore.',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF1E40AF),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMatchHeader(String title) {
    return Row(
      children: [
        Container(
          width: 4,
          height: 16,
          decoration: BoxDecoration(
            color: const Color(0xFF2563EB),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: 8),
        Text(
          title,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF0F172A),
            letterSpacing: 0.5,
          ),
        ),
        const Spacer(),
        if (_currentTatamiId.isNotEmpty)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFFDCFCE7),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              'MEMANTAU',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF166534),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildLiveScoreCard(
    String redName, String redTeam, String redScore,
    String blueName, String blueTeam, String blueScore,
    String time
  ) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF2563EB).withOpacity(0.2),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        children: [
          Text(
            time,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: const Color(0xFFF59E0B),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildFighterScore(redName, redTeam, redScore, Colors.redAccent),
              Text(
                'VS',
                style: GoogleFonts.plusJakartaSans(
                  fontWeight: FontWeight.w900,
                  color: Colors.white24,
                  fontSize: 18,
                ),
              ),
              _buildFighterScore(blueName, blueTeam, blueScore, Colors.blueAccent),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFighterScore(String name, String team, String score, Color color) {
    return Column(
      children: [
        Text(
          score,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 48,
            fontWeight: FontWeight.w900,
            color: color,
          ),
        ),
        SizedBox(
          width: 80,
          child: Text(
            name,
            textAlign: TextAlign.center,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: Colors.white,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        Text(
          team,
          style: GoogleFonts.plusJakartaSans(
            fontSize: 9,
            color: Colors.white60,
          ),
        ),
      ],
    );
  }

  Widget _buildTatamiItem(String tatamiId, String title) {
    bool isSelected = _currentTatamiId == tatamiId;
    
    return GestureDetector(
      onTap: () => _selectTatami(tatamiId, title),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFEEF2FF) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFE2E8F0),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(
              Icons.radio_button_checked_rounded,
              color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF94A3B8),
              size: 20,
            ),
            const SizedBox(width: 16),
            Text(
              title,
              style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.w700,
                color: isSelected ? const Color(0xFF2563EB) : const Color(0xFF0F172A),
              ),
            ),
            const Spacer(),
            if (isSelected)
              const Icon(Icons.check_circle_rounded, color: Color(0xFF2563EB), size: 20),
          ],
        ),
      ),
    );
  }
}
