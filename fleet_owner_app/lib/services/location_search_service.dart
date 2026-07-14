import 'dart:convert';
import 'package:http/http.dart' as http;

class LocationSuggestion {
  final String displayName;
  final String city;
  final String state;

  LocationSuggestion({
    required this.displayName,
    required this.city,
    required this.state,
  });

  factory LocationSuggestion.fromJson(Map<String, dynamic> json) {
    final address = json['address'] ?? {};
    return LocationSuggestion(
      displayName: json['display_name'] ?? '',
      city: address['city'] ?? address['town'] ?? address['village'] ?? address['county'] ?? '',
      state: address['state'] ?? '',
    );
  }
}

class LocationSearchService {
  static Future<List<LocationSuggestion>> search(String query) async {
    if (query.trim().isEmpty) return [];
    
    try {
      final url = Uri.parse('https://nominatim.openstreetmap.org/search?q=${Uri.encodeComponent(query)}&format=json&addressdetails=1&countrycodes=in&limit=5');
      final response = await http.get(url, headers: {
        'User-Agent': 'DravYantraApp/1.0',
      });

      if (response.statusCode == 200) {
        final List<dynamic> data = json.decode(response.body);
        return data.map((item) => LocationSuggestion.fromJson(item)).toList();
      }
    } catch (e) {
      print('Location search error: $e');
    }
    return [];
  }
}
