import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:intl/intl.dart';
import 'dart:async';
import '../providers/support_provider.dart';
import '../models/support_ticket_model.dart';
import '../core/theme.dart';

class TicketDetailScreen extends StatefulWidget {
  final String ticketNumber;
  const TicketDetailScreen({Key? key, required this.ticketNumber}) : super(key: key);

  @override
  State<TicketDetailScreen> createState() => _TicketDetailScreenState();
}

class _TicketDetailScreenState extends State<TicketDetailScreen> {
  final _messageController = TextEditingController();
  Timer? _pollingTimer;
  bool _isLoading = true;
  bool _isSending = false;
  SupportTicket? _ticket;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchTicket();
    _pollingTimer = Timer.periodic(const Duration(seconds: 3), (_) => _pollTicket());
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _pollTicket() async {
    if (!mounted) return;
    try {
      final ticket = await context.read<SupportProvider>().fetchTicketDetail(widget.ticketNumber);
      if (mounted) {
        if (_ticket == null || ticket.messages.length != _ticket!.messages.length) {
          setState(() {
            _ticket = ticket;
          });
        }
      }
    } catch (e) {
      // Ignore polling errors to prevent UI disruption
    }
  }

  Future<void> _fetchTicket() async {
    setState(() => _isLoading = true);
    try {
      final ticket = await context.read<SupportProvider>().fetchTicketDetail(widget.ticketNumber);
      if (mounted) {
        setState(() {
          _ticket = ticket;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = e.toString());
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _sendMessage() async {
    final msg = _messageController.text.trim();
    if (msg.isEmpty) return;

    setState(() => _isSending = true);
    try {
      await context.read<SupportProvider>().addMessage(widget.ticketNumber, msg);
      _messageController.clear();
      await _fetchTicket(); // refresh ticket messages
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e'), backgroundColor: Colors.red));
      }
    } finally {
      if (mounted) setState(() => _isSending = false);
    }
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'Open': return Colors.blue;
      case 'In Progress': return Colors.orange;
      case 'Resolved': return Colors.green;
      case 'Closed': return Colors.grey;
      case 'Escalated': return Colors.red;
      case 'Reopened': return Colors.purple;
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft),
          tooltip: 'Back',
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/support');
            }
          },
        ),
        title: Text('Ticket ${widget.ticketNumber}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 16)),
        backgroundColor: AppTheme.primary,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text(_error!, style: const TextStyle(color: Colors.red)))
              : _ticket == null
                  ? const Center(child: Text('Ticket not found'))
                  : Column(
                      children: [
                        _buildTicketHeader(),
                        Expanded(
                          child: ListView.builder(
                            padding: const EdgeInsets.all(16),
                            itemCount: _ticket!.messages.length,
                            itemBuilder: (context, index) {
                              final msg = _ticket!.messages[index];
                              final isMe = msg.senderRole != 'admin'; // fleet owners are not admin
                              return _buildMessageBubble(msg, isMe);
                            },
                          ),
                        ),
                        if (_ticket!.status != 'Closed' && _ticket!.status != 'Resolved')
                          _buildMessageInput(),
                        if (_ticket!.status == 'Closed' || _ticket!.status == 'Resolved')
                          Container(
                            padding: const EdgeInsets.all(16),
                            color: Colors.grey[200],
                            width: double.infinity,
                            alignment: Alignment.center,
                            child: const Text('This ticket is closed.', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold)),
                          ),
                      ],
                    ),
    );
  }

  Widget _buildTicketHeader() {
    return Container(
      padding: const EdgeInsets.all(16),
      color: Colors.white,
      width: double.infinity,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(_ticket!.category, style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold)),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: _statusColor(_ticket!.status).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: _statusColor(_ticket!.status).withOpacity(0.5)),
                ),
                child: Text(
                  _ticket!.status,
                  style: TextStyle(color: _statusColor(_ticket!.status), fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(_ticket!.subject, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text(_ticket!.description, style: const TextStyle(fontSize: 14)),
          const SizedBox(height: 12),
          Text(
            'Created on ${DateFormat('MMM dd, yyyy - hh:mm a').format(_ticket!.createdAt.toLocal())}',
            style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageBubble(TicketMessage msg, bool isMe) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(12),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: isMe ? AppTheme.primary.withOpacity(0.1) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: isMe ? AppTheme.primary.withOpacity(0.3) : AppTheme.border),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(isMe ? Icons.person : Icons.support_agent, size: 14, color: AppTheme.textSecondary),
                const SizedBox(width: 4),
                Text(
                  msg.senderName,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textSecondary),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(msg.message, style: const TextStyle(fontSize: 14)),
            const SizedBox(height: 6),
            Text(
              DateFormat('hh:mm a').format(msg.createdAt.toLocal()),
              style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageInput() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: const BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: AppTheme.border)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _messageController,
              decoration: InputDecoration(
                hintText: 'Type a message...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                filled: true,
                fillColor: AppTheme.background,
                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              ),
              maxLines: null,
            ),
          ),
          const SizedBox(width: 8),
          CircleAvatar(
            backgroundColor: AppTheme.primary,
            child: _isSending
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                : IconButton(
                    icon: const Icon(Icons.send, color: Colors.white),
                    onPressed: _sendMessage,
                  ),
          ),
        ],
      ),
    );
  }
}
