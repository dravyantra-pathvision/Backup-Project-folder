class SupportTicket {
  final int id;
  final String ticketNumber;
  final String uid;
  final String category;
  final String priority;
  final String status;
  final String subject;
  final String description;
  final DateTime createdAt;
  final DateTime? resolvedAt;
  final String? assignedStaffName;
  final List<TicketMessage> messages;

  SupportTicket({
    required this.id,
    required this.ticketNumber,
    required this.uid,
    required this.category,
    required this.priority,
    required this.status,
    required this.subject,
    required this.description,
    required this.createdAt,
    this.resolvedAt,
    this.assignedStaffName,
    this.messages = const [],
  });

  factory SupportTicket.fromJson(Map<String, dynamic> json) {
    return SupportTicket(
      id: json['id'] as int,
      ticketNumber: json['ticket_number'] as String,
      uid: json['uid'] as String,
      category: json['category'] as String,
      priority: json['priority'] ?? 'Medium',
      status: json['status'] ?? 'Open',
      subject: json['subject'] as String,
      description: json['description'] as String,
      createdAt: DateTime.parse(json['created_at']),
      resolvedAt: json['resolved_at'] != null ? DateTime.parse(json['resolved_at']) : null,
      assignedStaffName: json['assigned_staff_name'],
      messages: json['messages'] != null
          ? (json['messages'] as List).map((m) => TicketMessage.fromJson(m)).toList()
          : [],
    );
  }
}

class TicketMessage {
  final int id;
  final String ticketNumber;
  final String senderId;
  final String senderName;
  final String senderRole;
  final String message;
  final List<dynamic> attachments;
  final DateTime createdAt;

  TicketMessage({
    required this.id,
    required this.ticketNumber,
    required this.senderId,
    required this.senderName,
    required this.senderRole,
    required this.message,
    required this.attachments,
    required this.createdAt,
  });

  factory TicketMessage.fromJson(Map<String, dynamic> json) {
    return TicketMessage(
      id: json['id'] as int,
      ticketNumber: json['ticket_number'] as String,
      senderId: json['sender_id'] as String,
      senderName: json['sender_name'] ?? 'Support Staff',
      senderRole: json['sender_role'] ?? 'admin',
      message: json['message'] as String,
      attachments: json['attachments'] ?? [],
      createdAt: DateTime.parse(json['created_at']),
    );
  }
}
