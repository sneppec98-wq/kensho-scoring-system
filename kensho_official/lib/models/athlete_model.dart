class Athlete {
  final String id;
  final String? eventId;
  final String name;
  final String? team;
  final String? classCode;
  final String? className;
  final String? imageUrl;
  final String? status;
  final String? gender;
  final double? weight;
  final int? birthYear;

  Athlete({
    required this.id,
    this.eventId,
    required this.name,
    this.team,
    this.classCode,
    this.className,
    this.imageUrl,
    this.status,
    this.gender,
    this.weight,
    this.birthYear,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'eventId': eventId,
      'name': name.toUpperCase(),
      'team': team?.toUpperCase(),
      'classCode': classCode,
      'className': className,
      'imageUrl': imageUrl,
      'status': status,
      'gender': gender,
      'weight': weight,
      'birthYear': birthYear,
    };
  }

  factory Athlete.fromMap(Map<String, dynamic> map) {
    return Athlete(
      id: map['id'] ?? '',
      eventId: map['eventId'],
      name: map['name'] ?? '',
      team: map['team'],
      classCode: map['classCode'],
      className: map['className'],
      imageUrl: map['imageUrl'],
      status: map['status'],
      gender: map['gender'],
      weight: map['weight']?.toDouble(),
      birthYear: map['birthYear'],
    );
  }

  factory Athlete.fromFirestore(String id, Map<String, dynamic> data, {String? eventId}) {
    return Athlete(
      id: id,
      eventId: eventId,
      name: data['name'] ?? data['athleteName'] ?? '',
      team: data['team'] ?? data['kontingen'] ?? '',
      classCode: data['classCode'],
      className: data['className'],
      imageUrl: data['imageUrl'] ?? data['photoUrl'],
      status: data['status'],
      gender: data['gender'],
      weight: data['weight']?.toDouble(),
      birthYear: data['birthYear'],
    );
  }
}
