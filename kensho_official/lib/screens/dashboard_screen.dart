import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dashboard_page.dart';
import 'athlete_page.dart';
import 'match_page.dart';
import 'settings_page.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _selectedIndex = 0;
  String? _pendingEventId;

  List<Widget> get _pages => [
    DashboardPage(onEventTap: (id) {
      setState(() {
        _pendingEventId = id;
        _selectedIndex = 1; // Switch to Atlet
      });
    }),
    AthletePage(key: ValueKey(_pendingEventId), initialEventId: _pendingEventId),
    const MatchPage(),
    const SettingsPage(),
  ];

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: _selectedIndex == 0 || _selectedIndex == 2
          ? AppBar(
              backgroundColor: Colors.white,
              elevation: 0,
              title: Text(
                _selectedIndex == 0 ? 'KENSHO OFFICIAL' : 'PERTANDINGAN LIVE',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF0F172A),
                  letterSpacing: -0.5,
                ),
              ),
              actions: [
                if (_selectedIndex == 0) ...[
                  IconButton(
                    icon: const Icon(Icons.notifications_none_rounded, color: Color(0xFF64748B)),
                    onPressed: () {},
                  ),
                  const SizedBox(width: 8),
                  const CircleAvatar(
                    radius: 16,
                    backgroundColor: Color(0xFFE2E8F0),
                    child: Icon(Icons.person, size: 20, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(width: 16),
                ]
              ],
            )
          : null, // AppBar is handled by individual pages for Athlete and Settings
      body: IndexedStack(
        index: _selectedIndex,
        children: _pages,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, -5),
            ),
          ],
        ),
        child: BottomNavigationBar(
          backgroundColor: Colors.white,
          selectedItemColor: const Color(0xFF2563EB),
          unselectedItemColor: const Color(0xFF94A3B8),
          selectedLabelStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 12),
          unselectedLabelStyle: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, fontSize: 12),
          type: BottomNavigationBarType.fixed,
          currentIndex: _selectedIndex,
          onTap: _onItemTapped,
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.dashboard_rounded), label: 'Dashboard'),
            BottomNavigationBarItem(icon: Icon(Icons.group_rounded), label: 'Atlet'),
            BottomNavigationBarItem(icon: Icon(Icons.sports_rounded), label: 'Tanding'),
            BottomNavigationBarItem(icon: Icon(Icons.settings_rounded), label: 'Pengaturan'),
          ],
        ),
      ),
    );
  }
}
