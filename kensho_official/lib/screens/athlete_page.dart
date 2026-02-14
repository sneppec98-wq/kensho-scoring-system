import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'ranking_page.dart';
import '../services/supabase_manager.dart';
import '../models/athlete_model.dart';
import '../models/event_model.dart';
import '../services/database_helper.dart';
import '../services/firebase_sync_service.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class AthletePage extends StatefulWidget {
  final String? initialEventId;
  const AthletePage({super.key, this.initialEventId});

  @override
  State<AthletePage> createState() => _AthletePageState();
}

class _AthletePageState extends State<AthletePage> {
  final ImagePicker _picker = ImagePicker();
  final DatabaseHelper _dbHelper = DatabaseHelper();
  final FirebaseSyncService _syncService = FirebaseSyncService();
  
  File? _selectedImage;
  bool _isUploading = false;
  bool _isLoading = false;
  
  List<Athlete> _athletes = [];
  List<Event> _events = [];
  String? _selectedEventId;
  
  // Form Controllers
  final _nameController = TextEditingController();
  final _contingentController = TextEditingController();
  final _dobController = TextEditingController();
  final _weightController = TextEditingController();
  String _selectedCategory = 'Semua Kategori';

  @override
  void initState() {
    super.initState();
    _selectedEventId = widget.initialEventId;
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    final events = await _dbHelper.getEvents();
    if (events.isNotEmpty && _selectedEventId == null) {
      _selectedEventId = events.first.id;
    }
    await _loadAthletes();
    setState(() {
      _events = events;
      _isLoading = false;
    });
  }

  Future<void> _loadAthletes() async {
    if (_selectedEventId == null) return;
    final athletes = await _dbHelper.getAthletes(_selectedEventId!);
    setState(() {
      _athletes = athletes;
    });
  }

  Future<void> _syncData() async {
    if (_selectedEventId == null) return;
    setState(() => _isLoading = true);
    
    // 1. Sync from Cloud to Local (Hemat Quota)
    await _syncService.syncAthletes(_selectedEventId!);
    
    // 2. Refresh Local List
    await _loadAthletes();
    
    setState(() => _isLoading = false);
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Daftar atlet berhasil disinkronisasi')),
      );
    }
  }

  Future<void> _saveAthlete() async {
    if (_nameController.text.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Nama lengkap wajib diisi')),
      );
      return;
    }

    if (_selectedEventId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pilih event terlebih dahulu')),
      );
      return;
    }

    setState(() => _isUploading = true);

    try {
      // 1. Upload to Supabase (Media Storage - Hemat Firebase Storage)
      String? imageUrl;
      if (_selectedImage != null) {
        imageUrl = await SupabaseManager.uploadAthletePhoto(_selectedImage!, _nameController.text);
      }

      // 2. Save to Cloud Firestore
      final athleteData = {
        'name': _nameController.text.toUpperCase(),
        'team': _contingentController.text.toUpperCase(),
        'className': _selectedCategory,
        'imageUrl': imageUrl,
        'status': 'active',
        'createdAt': DateTime.now().toIso8601String(),
      };

      DocumentReference docRef = await FirebaseFirestore.instance
          .collection('events')
          .doc(_selectedEventId)
          .collection('athletes')
          .add(athleteData);

      // 3. Mirror to Local SQLite (Offline Access - Hemat Firebase Reads)
      final newAthlete = Athlete(
        id: docRef.id,
        eventId: _selectedEventId,
        name: _nameController.text,
        team: _contingentController.text,
        className: _selectedCategory,
        imageUrl: imageUrl,
        status: 'active',
      );
      
      await _dbHelper.upsertAthlete(newAthlete);
      
      // 4. Update UI
      await _loadAthletes();

      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Color(0xFF10B981),
            content: Text('Atlet berhasil didaftarkan secara lokal & cloud!'),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Gagal menyimpan: $e')),
        );
      }
    } finally {
      setState(() => _isUploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        title: Text(
          'MANAJEMEN ATLET',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: const Color(0xFF0F172A),
          ),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.sync_rounded, color: _isLoading ? Colors.grey : const Color(0xFF2563EB)),
            onPressed: _isLoading ? null : _syncData,
            tooltip: 'Tarik Data Baru (Sync)',
          ),
          IconButton(
            icon: const Icon(Icons.analytics_outlined, color: Color(0xFF2563EB)),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const RankingPage()),
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          // Event Selector
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            color: Colors.white,
            child: Row(
              children: [
                const Icon(Icons.emoji_events_outlined, size: 20, color: Color(0xFF64748B)),
                const SizedBox(width: 12),
                Expanded(
                  child: _events.isEmpty
                      ? Text('Memuat event...', style: GoogleFonts.plusJakartaSans(color: Colors.grey))
                      : DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _selectedEventId,
                            isExpanded: true,
                            hint: const Text('Pilih Event'),
                            items: _events.map((e) => DropdownMenuItem(
                              value: e.id,
                              child: Text(e.name, style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600, fontSize: 13)),
                            )).toList(),
                            onChanged: (val) {
                              setState(() => _selectedEventId = val);
                              _loadAthletes();
                            },
                          ),
                        ),
                ),
              ],
            ),
          ),
          
          const Divider(height: 1, color: Color(0xFFE2E8F0)),

          Expanded(
            child: RefreshIndicator(
              onRefresh: _syncData,
              child: _isLoading && _athletes.isEmpty
                  ? const Center(child: CircularProgressIndicator())
                  : _athletes.isEmpty
                      ? _buildEmptyState()
                      : ListView.builder(
                          padding: const EdgeInsets.all(24),
                          itemCount: _athletes.length,
                          itemBuilder: (context, index) {
                            final a = _athletes[index];
                            return _buildAthleteCard(
                              a.name,
                              a.team ?? '-',
                              a.className ?? 'Umum',
                              true,
                              a.imageUrl,
                            );
                          },
                        ),
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddAthleteModal(context),
        backgroundColor: const Color(0xFF2563EB),
        child: const Icon(Icons.add_rounded, color: Colors.white, size: 28),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.people_outline_rounded, size: 64, color: Colors.grey.withOpacity(0.3)),
          const SizedBox(height: 16),
          Text(
            'Daftar atlet lokal kosong.',
            style: GoogleFonts.plusJakartaSans(color: Colors.grey),
          ),
          const SizedBox(height: 8),
          Text(
            'Klik tombol sinkronisasi di kanan atas.',
            style: GoogleFonts.plusJakartaSans(color: Colors.grey, fontSize: 12),
          ),
        ],
      ),
    );
  }

  void _showAddAthleteModal(BuildContext context) {
    if (_selectedEventId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pilih event terlebih dahulu sebelum menambah atlet')),
      );
      return;
    }

    setState(() {
      _selectedImage = null;
      _nameController.clear();
      _contingentController.clear();
      _dobController.clear();
      _weightController.clear();
      _selectedCategory = 'Semua Kategori';
    });

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => StatefulBuilder(
        builder: (context, setModalState) => Container(
          height: MediaQuery.of(context).size.height * 0.85,
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'PENDAFTARAN ATLET',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    children: [
                      _buildModalLabel('FOTO ATLET'),
                      const SizedBox(height: 12),
                      GestureDetector(
                        onTap: () async {
                          final XFile? image = await _picker.pickImage(source: ImageSource.gallery);
                          if (image != null) {
                            setModalState(() => _selectedImage = File(image.path));
                            setState(() => _selectedImage = File(image.path));
                          }
                        },
                        child: CircleAvatar(
                          radius: 50,
                          backgroundColor: const Color(0xFFF1F5F9),
                          backgroundImage: _selectedImage != null ? FileImage(_selectedImage!) : null,
                          child: _selectedImage == null ? const Icon(Icons.add_a_photo_outlined, color: Color(0xFF94A3B8)) : null,
                        ),
                      ),
                      const SizedBox(height: 24),
                      _buildModalInput(_nameController, 'NAMA LENGKAP', 'Sesuai Akte Lahir'),
                      const SizedBox(height: 16),
                      _buildModalInput(_contingentController, 'KONTINGEN / TIM', 'Nama Klub/Dojo'),
                      const SizedBox(height: 16),
                      _buildModalDropdown('KATEGORI', [
                        'Semua Kategori', 'Kumite Perorangan', 'Kata Perorangan', 'Kata Beregu'
                      ], (val) => setModalState(() => _selectedCategory = val!)),
                      const SizedBox(height: 32),
                      SizedBox(
                        width: double.infinity,
                        height: 54,
                        child: ElevatedButton(
                          onPressed: _isUploading ? null : _saveAthlete,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF2563EB),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            elevation: 0,
                          ),
                          child: _isUploading 
                            ? const CircularProgressIndicator(color: Colors.white)
                            : Text('SIMPAN & SINKRON', style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w800, color: Colors.white)),
                        ),
                      ),
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildModalLabel(String label) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Text(
        label,
        style: GoogleFonts.plusJakartaSans(fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFF64748B), letterSpacing: 1),
      ),
    );
  }

  Widget _buildModalInput(TextEditingController controller, String label, String hint) {
    return Column(
      children: [
        _buildModalLabel(label),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          decoration: InputDecoration(
            hintText: hint,
            filled: true,
            fillColor: const Color(0xFFF8FAFC),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
          ),
        ),
      ],
    );
  }

  Widget _buildModalDropdown(String label, List<String> items, Function(String?) onChanged) {
    return Column(
      children: [
        _buildModalLabel(label),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(12)),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              isExpanded: true,
              value: _selectedCategory,
              items: items.map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
              onChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildAthleteCard(String name, String contingent, String category, bool isVerified, String? imageUrl) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: const Color(0xFFF1F5F9),
            backgroundImage: imageUrl != null ? NetworkImage(imageUrl) : null,
            child: imageUrl == null ? const Icon(Icons.person_outline_rounded, color: Color(0xFF94A3B8)) : null,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w700, fontSize: 14)),
                Text(contingent, style: GoogleFonts.plusJakartaSans(fontSize: 12, color: const Color(0xFF64748B))),
                const SizedBox(height: 4),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(4)),
                  child: Text(category, style: GoogleFonts.plusJakartaSans(fontSize: 10, fontWeight: FontWeight.w700)),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
        ],
      ),
    );
  }
}
