import 'dart:convert';
import 'package:http/http.dart' as http;
import '../core/config.dart';
import 'package:firebase_auth/firebase_auth.dart';

class OnboardingService {
  static String get baseUrl {
    return AppConfig.apiBaseUrl.isNotEmpty ? AppConfig.apiBaseUrl.replaceAll(RegExp(r'/$'), '') : '';
  }

  static Future<Map<String, dynamic>> getStatus() async {
    final user = FirebaseAuth.instance.currentUser;
    final token = await user?.getIdToken();
    if (token == null) throw Exception('Not authenticated');

    final response = await http.get(
      Uri.parse('$baseUrl/api/onboarding/status'),
      headers: {
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 200) {
      final json = jsonDecode(response.body);
      return json['data'];
    } else {
      throw Exception('Failed to load onboarding status');
    }
  }

  static Future<Map<String, dynamic>> updateStep(int stepId, Map<String, dynamic> data) async {
    final user = FirebaseAuth.instance.currentUser;
    final token = await user?.getIdToken();
    if (token == null) throw Exception('Not authenticated');

    final response = await http.put(
      Uri.parse('$baseUrl/api/onboarding/step/$stepId'),
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
      body: jsonEncode(data),
    );

    if (response.statusCode == 200) {
      final json = jsonDecode(response.body);
      return json['data'];
    } else {
      throw Exception('Failed to update step');
    }
  }

  static Future<Map<String, dynamic>> submitForApproval() async {
    final user = FirebaseAuth.instance.currentUser;
    final token = await user?.getIdToken();
    if (token == null) throw Exception('Not authenticated');

    final response = await http.post(
      Uri.parse('$baseUrl/api/onboarding/submit'),
      headers: {
        'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 200) {
      final json = jsonDecode(response.body);
      return json['data'];
    } else {
      throw Exception('Failed to submit onboarding');
    }
  }
}
