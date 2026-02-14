import 'dart:async';
import 'package:supabase_flutter/supabase_flutter.dart';

class ScoringService {
  final SupabaseClient _supabase = Supabase.instance.client;
  StreamSubscription? _subscription;

  /// Listen to live score updates for a specific tatami
  /// This uses Supabase Realtime (Economical Mode)
  void listenToLiveScore(String tatamiId, Function(Map<String, dynamic>) onUpdate) {
    // 1. Cancel existing subscription if any
    stopListening();

    print('[Scoring] Starting live monitor for: $tatamiId');

    // 2. Subscribe to the 'live_scores' table for specific tatami_id
    _subscription = _supabase
        .from('live_scores')
        .stream(primaryKey: ['tatami_id'])
        .eq('tatami_id', tatamiId)
        .listen((List<Map<String, dynamic>> data) {
          if (data.isNotEmpty) {
            final scoreData = data.first['data'] as Map<String, dynamic>;
            onUpdate(scoreData);
          }
        }, onError: (error) {
          print('[Scoring] Stream Error: $error');
        });
  }

  /// Stop listening to real-time updates to save bandwidth
  void stopListening() {
    _subscription?.cancel();
    _subscription = null;
  }
}
