import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/city.dart';
import 'indian_cities_data.dart';

class CitySearchService {
  // GeoDB Cities API on RapidAPI
  static const String _baseUrl = 'https://wft-geo-db.p.rapidapi.com/v1/geo';
  static const String _apiKey = 'YOUR_RAPIDAPI_KEY'; // Replace with your RapidAPI key
  static const String _apiHost = 'wft-geo-db.p.rapidapi.com';

  Timer? _debounceTimer;
  http.Client? _client;

  CitySearchService() {
    _client = http.Client();
  }

  /// Search cities directly.
  Future<List<City>> searchCities(String query) async {
    if (query.trim().length < 2) {
      return [];
    }
    return _fetchCities(query.trim());
  }

  /// Direct API call to Photon (Komoot) Geocoding API for robust autocomplete
  Future<List<City>> _fetchCities(String query) async {
    try {
      // Append "+india" to strongly bias results toward Indian villages, towns, and cities.
      final uri = Uri.parse(
        'https://photon.komoot.io/api/?q=${Uri.encodeComponent(query)}+india&limit=15',
      );

      final response = await _client!.get(uri, headers: {
        'User-Agent': 'DravYantra-Fleet-Management-App',
      });

      if (response.statusCode == 200) {
        final Map<String, dynamic> data = jsonDecode(response.body);
        final List features = data['features'] ?? [];
        
        return features.map((item) {
          final json = item as Map<String, dynamic>;
          final props = json['properties'] as Map<String, dynamic>? ?? {};
          final coords = (json['geometry'] as Map<String, dynamic>?)?['coordinates'] as List?;
          
          final name = props['name'] ?? props['city'] ?? props['town'] ?? props['village'] ?? props['county'] ?? 'Unknown';
          final state = props['state'] ?? props['county'] ?? '';
          final country = props['country'] ?? 'India';
          
          double? lat, lon;
          if (coords != null && coords.length >= 2) {
            lon = double.tryParse(coords[0].toString());
            lat = double.tryParse(coords[1].toString());
          }
          
          return City(
            name: name.toString(),
            state: state.toString(),
            country: country.toString(),
            latitude: lat,
            longitude: lon,
          );
        }).where((city) => city.name.isNotEmpty && city.name != 'Unknown').toList();
      } else {
        debugPrint('Photon API error: ${response.statusCode}');
        return _localSearch(query);
      }
    } catch (e) {
      debugPrint('Photon API exception: $e');
      return _localSearch(query);
    }
  }

  /// Fallback: search from the comprehensive list of 1221 Indian cities
  List<City> _localSearch(String query) {
    final q = query.toLowerCase();
    final matches = allIndianCities.where((c) {
      return c.name.toLowerCase().contains(q) || c.state.toLowerCase().contains(q);
    }).toList();

    // Sort matches: prefix matches first, then contains matches
    matches.sort((a, b) {
      final aNameLower = a.name.toLowerCase();
      final bNameLower = b.name.toLowerCase();
      final aStarts = aNameLower.startsWith(q);
      final bStarts = bNameLower.startsWith(q);

      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      
      // Then alphabetical
      return aNameLower.compareTo(bNameLower);
    });

    return matches.take(15).toList();
  }

  void dispose() {
    _debounceTimer?.cancel();
    _client?.close();
  }
}
