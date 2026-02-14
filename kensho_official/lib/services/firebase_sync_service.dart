import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/event_model.dart';
import '../models/athlete_model.dart';
import 'database_helper.dart';

class FirebaseSyncService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final DatabaseHelper _dbHelper = DatabaseHelper();

  // --- SYNC EVENTS ---
  
  Future<List<Event>> syncEvents() async {
    try {
      // 1. Fetch from Firestore (Manual Pull)
      QuerySnapshot querySnapshot = await _firestore
          .collection('events')
          .orderBy('createdAt', descending: true)
          .get();

      List<Event> events = [];
      for (var doc in querySnapshot.docs) {
        final event = Event.fromFirestore(doc.id, doc.data() as Map<String, dynamic>);
        events.add(event);
        
        // 2. Mirror to Local SQLite
        await _dbHelper.upsertEvent(event);
      }
      
      return events;
    } catch (e) {
      print('[Sync] Error syncing events: $e');
      // If error, fallback to local data
      return await _dbHelper.getEvents();
    }
  }

  // --- SYNC ATHLETES ---

  Future<List<Athlete>> syncAthletes(String eventId) async {
    try {
      // 1. Fetch from Firestore (Sub-collection)
      QuerySnapshot querySnapshot = await _firestore
          .collection('events')
          .doc(eventId)
          .collection('athletes')
          .get();

      List<Athlete> athletes = [];
      for (var doc in querySnapshot.docs) {
        final athlete = Athlete.fromFirestore(
          doc.id, 
          doc.data() as Map<String, dynamic>,
          eventId: eventId
        );
        athletes.add(athlete);
        
        // 2. Mirror to Local SQLite
        await _dbHelper.upsertAthlete(athlete);
      }
      
      return athletes;
    } catch (e) {
      print('[Sync] Error syncing athletes: $e');
      // If error, fallback to local data
      return await _dbHelper.getAthletes(eventId);
    }
  }

  // --- AGGREGATE COUNT (Sangat Hemat Quota) ---
  
  Future<int> getCloudAthleteCount() async {
    try {
      // Menggunakan AggregateQuery - Hanya 1 read per 1000 dokumen
      AggregateQuery countQuery = _firestore.collectionGroup('athletes').count();
      AggregateQuerySnapshot snapshot = await countQuery.get();
      return snapshot.count ?? 0;
    } catch (e) {
      print('[Sync] Error counting athletes: $e');
      return await _dbHelper.getAthleteCount();
    }
  }
}
