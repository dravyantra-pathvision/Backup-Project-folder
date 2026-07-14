import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/support_ticket_model.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../core/config.dart';

class SupportService {
  static String get baseUrl {
    return AppConfig.apiBaseUrl.isNotEmpty ? AppConfig.apiBaseUrl.replaceAll(RegExp(r'/$'), '') + '/api/support' : '';
  }

  Future<Map<String, String>> _getHeaders() async {
    final user = FirebaseAuth.instance.currentUser;
    final token = user != null ? await user.getIdToken() : '';
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  Future<List<SupportTicket>> getTickets() async {
    final response = await http.get(Uri.parse('$baseUrl/tickets'), headers: await _getHeaders());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final List tickets = data['data'];
      return tickets.map((t) => SupportTicket.fromJson(t)).toList();
    } else {
      throw Exception('Failed to load tickets: ${response.body}');
    }
  }

  Future<SupportTicket> getTicketDetail(String ticketNumber) async {
    final response = await http.get(Uri.parse('$baseUrl/tickets/$ticketNumber'), headers: await _getHeaders());
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return SupportTicket.fromJson(data['data']);
    } else {
      throw Exception('Failed to load ticket detail: ${response.body}');
    }
  }

  Future<SupportTicket> createTicket(String category, String subject, String description, String priority) async {
    final response = await http.post(
      Uri.parse('$baseUrl/tickets'),
      headers: await _getHeaders(),
      body: jsonEncode({
        'category': category,
        'subject': subject,
        'description': description,
        'priority': priority,
      }),
    );
    if (response.statusCode == 201) {
      final data = jsonDecode(response.body);
      return SupportTicket.fromJson(data['data']);
    } else {
      throw Exception('Failed to create ticket: ${response.body}');
    }
  }

  Future<TicketMessage> addMessage(String ticketNumber, String message) async {
    final response = await http.post(
      Uri.parse('$baseUrl/tickets/$ticketNumber/messages'),
      headers: await _getHeaders(),
      body: jsonEncode({
        'message': message,
      }),
    );
    if (response.statusCode == 201) {
      final data = jsonDecode(response.body);
      return TicketMessage.fromJson(data['data']);
    } else {
      throw Exception('Failed to add message: ${response.body}');
    }
  }
}
