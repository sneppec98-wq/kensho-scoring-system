import 'dart:async';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import '../models/event_model.dart';
import '../models/athlete_model.dart';

class DatabaseHelper {
  static final DatabaseHelper _instance = DatabaseHelper._internal();
  static Database? _database;

  factory DatabaseHelper() => _instance;

  DatabaseHelper._internal();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    String path = join(await getDatabasesPath(), 'kensho_local.db');
    return await openDatabase(
      path,
      version: 1,
      onCreate: _onCreate,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    // Table Events
    await db.execute('''
      CREATE TABLE events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        date TEXT,
        location TEXT,
        status TEXT,
        createdAt TEXT
      )
    ''');

    // Table Athletes
    await db.execute('''
      CREATE TABLE athletes (
        id TEXT PRIMARY KEY,
        eventId TEXT,
        name TEXT NOT NULL,
        team TEXT,
        classCode TEXT,
        className TEXT,
        imageUrl TEXT,
        status TEXT,
        gender TEXT,
        weight REAL,
        birthYear INTEGER
      )
    ''');
  }

  // --- EVENT OPERATIONS ---
  
  Future<void> upsertEvent(Event event) async {
    final db = await database;
    await db.insert(
      'events',
      event.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<Event>> getEvents() async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query('events', orderBy: 'createdAt DESC');
    return List.generate(maps.length, (i) => Event.fromMap(maps[i]));
  }

  // --- ATHLETE OPERATIONS ---

  Future<void> upsertAthlete(Athlete athlete) async {
    final db = await database;
    await db.insert(
      'athletes',
      athlete.toMap(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<Athlete>> getAthletes(String eventId) async {
    final db = await database;
    final List<Map<String, dynamic>> maps = await db.query(
      'athletes',
      where: 'eventId = ?',
      whereArgs: [eventId],
      orderBy: 'name ASC',
    );
    return List.generate(maps.length, (i) => Athlete.fromMap(maps[i]));
  }

  Future<int> getAthleteCount() async {
    final db = await database;
    return Sqflite.firstIntValue(await db.rawQuery('SELECT COUNT(*) FROM athletes')) ?? 0;
  }

  Future<void> clearAll() async {
    final db = await database;
    await db.delete('events');
    await db.delete('athletes');
  }
}
