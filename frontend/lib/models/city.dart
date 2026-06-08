class City {
  final String name;
  final String state;
  final String country;
  final double? latitude;
  final double? longitude;

  City({
    required this.name,
    required this.state,
    this.country = 'India',
    this.latitude,
    this.longitude,
  });

  factory City.fromGeoDB(Map<String, dynamic> json) {
    return City(
      name: json['city'] ?? json['name'] ?? '',
      state: json['region'] ?? json['regionCode'] ?? '',
      country: json['country'] ?? 'India',
      latitude: json['latitude']?.toDouble(),
      longitude: json['longitude']?.toDouble(),
    );
  }

  String get displayName => name;
  String get subtitle => state.isNotEmpty ? state : country;

  @override
  String toString() => '$name, $state';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is City &&
          runtimeType == other.runtimeType &&
          name == other.name &&
          state == other.state;

  @override
  int get hashCode => name.hashCode ^ state.hashCode;
}
