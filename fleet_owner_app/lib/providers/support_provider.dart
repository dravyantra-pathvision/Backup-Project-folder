import 'package:flutter/foundation.dart';
import '../models/support_ticket_model.dart';
import '../services/support_service.dart';

class SupportProvider with ChangeNotifier {
  final SupportService _service = SupportService();

  List<SupportTicket> _tickets = [];
  bool _isLoading = false;
  String? _error;

  List<SupportTicket> get tickets => _tickets;
  bool get isLoading => _isLoading;
  String? get error => _error;

  Future<void> fetchTickets() async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      _tickets = await _service.getTickets();
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<SupportTicket> fetchTicketDetail(String ticketNumber) async {
    try {
      return await _service.getTicketDetail(ticketNumber);
    } catch (e) {
      rethrow;
    }
  }

  Future<void> createTicket(String category, String subject, String description, String priority) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final newTicket = await _service.createTicket(category, subject, description, priority);
      _tickets.insert(0, newTicket);
    } catch (e) {
      _error = e.toString();
      rethrow;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> addMessage(String ticketNumber, String message) async {
    try {
      await _service.addMessage(ticketNumber, message);
    } catch (e) {
      rethrow;
    }
  }
}
