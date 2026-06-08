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

  /// Direct API call to OpenStreetMap Nominatim Geocoding API
  Future<List<City>> _fetchCities(String query) async {
    try {
      final uri = Uri.parse(
        'https://nominatim.openstreetmap.org/search?q=${Uri.encodeComponent(query)}&countrycodes=in&format=json&addressdetails=1&limit=15',
      );

      final response = await _client!.get(uri, headers: {
        'User-Agent': 'DravYantra-Fleet-Management-App',
      });

      if (response.statusCode == 200) {
        final List data = jsonDecode(response.body);
        return data.map((item) {
          final json = item as Map<String, dynamic>;
          final address = json['address'] as Map<String, dynamic>? ?? {};
          final name = address['city'] ?? 
                       address['town'] ?? 
                       address['village'] ?? 
                       address['suburb'] ?? 
                       address['municipality'] ?? 
                       address['hamlet'] ?? 
                       json['display_name'].toString().split(',')[0];
          
          final state = address['state'] ?? '';
          final lat = double.tryParse(json['lat']?.toString() ?? '');
          final lon = double.tryParse(json['lon']?.toString() ?? '');
          
          return City(
            name: name.toString(),
            state: state.toString(),
            latitude: lat,
            longitude: lon,
          );
        }).where((city) => city.name.isNotEmpty).toList();
      } else {
        debugPrint('Nominatim API error: ${response.statusCode}');
        return _localSearch(query);
      }
    } catch (e) {
      debugPrint('Nominatim API exception: $e');
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
