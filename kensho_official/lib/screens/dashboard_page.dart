import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/event_model.dart';
import '../services/database_helper.dart';
import '../services/firebase_sync_service.dart';

class DashboardPage extends StatefulWidget {
  final Function(String eventId)? onEventTap;
  const DashboardPage({super.key, this.onEventTap});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  final DatabaseHelper _dbHelper = DatabaseHelper();
  final FirebaseSyncService _syncService = FirebaseSyncService();
  
  List<Event> _events = [];
  int _athleteCount = 0;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadLocalData();
  }

  Future<void> _loadLocalData() async {
    setState(() => _isLoading = true);
    final events = await _dbHelper.getEvents();
    final count = await _dbHelper.getAthleteCount();
    setState(() {
      _events = events;
      _athleteCount = count;
      _isLoading = false;
    });
  }

  Future<void> _refreshData() async {
    setState(() => _isLoading = true);
    
    // 1. Sync Events (Manual Pull)
    await _syncService.syncEvents();
    
    // 2. Sync Global Count (Very cheap Aggregate Query)
    final cloudCount = await _syncService.getCloudAthleteCount();
    
    // 3. Reload from Local
    await _loadLocalData();
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Data berhasil diperbarui (Hemat Quota)')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _refreshData,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Selamat Datang, Sensei!',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: const Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Mode Hemat: Baca dari Database Lokal 🛡️',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          color: const Color(0xFF64748B),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: _refreshData,
                  icon: Icon(
                    Icons.sync_rounded,
                    color: _isLoading ? Colors.grey : const Color(0xFF2563EB),
                  ),
                  tooltip: 'Sinkronisasi Manual (Ambil Data Baru)',
                )
              ],
            ),
            const SizedBox(height: 32),

            // Statistics Grid
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 2,
              crossAxisSpacing: 12,
              mainAxisSpacing: 12,
              childAspectRatio: 1.8,
              children: [
                _buildStatCard(
                  'Atlet Terdaftar',
                  _athleteCount.toString(),
                  Icons.people_alt_rounded,
                  const Color(0xFF2563EB),
                ),
                _buildStatCard(
                  'Event Aktif',
                  _events.length.toString(),
                  Icons.emoji_events_rounded,
                  const Color(0xFFF59E0B),
                ),
              ],
            ),
            const SizedBox(height: 32),

            // Section Header
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Daftar Pertandingan',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF0F172A),
                  ),
                ),
                if (_events.isEmpty && !_isLoading)
                   Text(
                    'Belum ada data',
                    style: GoogleFonts.plusJakartaSans(fontSize: 12, color: Colors.grey),
                  ),
              ],
            ),
            const SizedBox(height: 16),

            if (_isLoading && _events.isEmpty)
              const Center(child: CircularProgressIndicator())
            else if (_events.isEmpty)
              _buildEmptyState()
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _events.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final e = _events[index];
                  return InkWell(
                    onTap: () {
                      if (widget.onEventTap != null) widget.onEventTap!(e.id);
                    },
                    borderRadius: BorderRadius.circular(16),
                    child: _buildEventItem(
                      e.name,
                      e.location ?? 'Lokasi Belum Diatur',
                      e.date ?? '-',
                      e.status == 'active',
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        children: [
          const SizedBox(height: 40),
          Icon(Icons.cloud_off_rounded, size: 64, color: Colors.grey.withOpacity(0.3)),
          const SizedBox(height: 16),
          Text(
            'Klik tombol refresh untuk menarik data event.',
            style: GoogleFonts.plusJakartaSans(color: Colors.grey),
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, color: color, size: 24),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF1E293B),
                ),
              ),
              Text(
                label,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: const Color(0xFF64748B),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEventItem(String title, String location, String date, bool isActive) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: isActive ? const Color(0xFFEEF2FF) : const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              Icons.calendar_today_rounded,
              color: isActive ? const Color(0xFF4338CA) : const Color(0xFF94A3B8),
              size: 20,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF0F172A),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    const Icon(Icons.location_on_rounded, size: 12, color: Color(0xFF94A3B8)),
                    const SizedBox(width: 4),
                    Text(
                      location,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        color: const Color(0xFF94A3B8),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 16),
          if (isActive)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFFDCFCE7),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                'AKTIF',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: const Color(0xFF166534),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
