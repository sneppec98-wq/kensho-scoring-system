class Event {
  final String id;
  final String name;
  final String? date;
  final String? location;
  final String? status;
  final String? createdAt;

  Event({
    required this.id,
    required this.name,
    this.date,
    this.location,
    this.status,
    this.createdAt,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name.toUpperCase(),
      'date': date,
      'location': location?.toUpperCase(),
      'status': status,
      'createdAt': createdAt,
    };
  }

  factory Event.fromMap(Map<String, dynamic> map) {
    return Event(
      id: map['id'] ?? '',
      name: map['name'] ?? '',
      date: map['date'],
      location: map['location'],
      status: map['status'],
      createdAt: map['createdAt'],
    );
  }

  factory Event.fromFirestore(String id, Map<String, dynamic> data) {
    return Event(
      id: id,
      name: data['name'] ?? '',
      date: data['date'],
      location: data['location'],
      status: data['status'],
      createdAt: data['createdAt'],
    );
  }
}
