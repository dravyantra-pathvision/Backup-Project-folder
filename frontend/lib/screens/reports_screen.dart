import 'dart:io';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../core/theme.dart';
import '../models/engine.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  String _selectedFilter = 'All';
  List<Map<String, dynamic>> _schedules = [];
  bool _loadingSchedules = false;
  final Set<String> _downloadingReports = {};

  final List<Map<String, dynamic>> _allReports = [
    {'title': 'Daily Fleet Summary', 'desc': 'Distance covered, fuel consumed, active vehicles.', 'icon': LucideIcons.fileText, 'category': 'Performance', 'type': 'daily_fleet_summary'},
    {'title': 'Driver Compliance Report', 'desc': 'License expiries, health scores, and leaves.', 'icon': LucideIcons.userCheck, 'category': 'Compliance', 'type': 'driver_compliance'},
    {'title': 'Monthly Fuel Audit', 'desc': 'Complete ledger of all fill-ups across all stations.', 'icon': LucideIcons.fuel, 'category': 'Fuel', 'type': 'monthly_fuel_audit'},
    {'title': 'Expense & Toll Report', 'desc': 'FASTag deductions and miscellaneous expenses.', 'icon': LucideIcons.receipt, 'category': 'Financial', 'type': 'expense_toll'},
    {'title': 'Vehicle Health Report', 'desc': 'Maintenance logs, service due dates, and health scores.', 'icon': LucideIcons.shieldCheck, 'category': 'Maintenance', 'type': 'vehicle_health'},
    {'title': 'Trip Efficiency Report', 'desc': 'Route deviations, delays, and load efficiency.', 'icon': LucideIcons.trendingUp, 'category': 'Performance', 'type': 'trip_efficiency'},
    {'title': 'Idle Analysis Report', 'desc': 'Detailed breakdown of vehicle idling times.', 'icon': LucideIcons.clock, 'category': 'Performance', 'type': 'idle_analysis'},
    {'title': 'Alert History Report', 'desc': 'Log of all critical alerts and resolutions.', 'icon': LucideIcons.bell, 'category': 'Compliance', 'type': 'alert_history'},
    {'title': 'Client Billing Report', 'desc': 'Invoices, proof of delivery, and client summaries.', 'icon': LucideIcons.briefcase, 'category': 'Financial', 'type': 'client_billing'},
  ];

  @override
  void initState() {
    super.initState();
    _loadSchedules();
  }

  Future<Map<String, String>> _getHeaders() async {
    final user = FirebaseAuth.instance.currentUser;
    final token = await user?.getIdToken();
    return {'Content-Type': 'application/json', 'Authorization': 'Bearer $token'};
  }

  Future<void> _loadSchedules() async {
    final engine = context.read<DataEngine>();
    setState(() => _loadingSchedules = true);
    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('${engine.baseUrl}/api/reports/schedules'),
        headers: headers,
      ).timeout(const Duration(seconds: 10));
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        setState(() => _schedules = data.cast<Map<String, dynamic>>());
      }
    } catch (e) {
      debugPrint('Failed to load schedules: $e');
    } finally {
      if (mounted) setState(() => _loadingSchedules = false);
    }
  }

  Future<void> _downloadReport(String title, String type) async {
    final engine = context.read<DataEngine>();
    setState(() => _downloadingReports.add(type));

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Preparing $title...'), 
        duration: const Duration(seconds: 2),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );

    try {
      final headers = await _getHeaders();
      final response = await http.get(
        Uri.parse('${engine.baseUrl}/api/reports/generate?type=$type&format=csv'),
        headers: headers,
      ).timeout(const Duration(seconds: 30));

      if (response.statusCode == 200) {
        final dir = await getTemporaryDirectory();
        final dateStr = DateTime.now().toIso8601String().split('T')[0];
        final file = File('${dir.path}/dravyantra_${type}_$dateStr.csv');
        await file.writeAsBytes(response.bodyBytes);

        await Share.shareXFiles([XFile(file.path)], text: 'DravYantra $title');

        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('✅ $title ready to share!'),
              backgroundColor: AppTheme.success,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
          );
        }
      } else {
        throw Exception('Server returned ${response.statusCode}');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❌ Failed to download: $e'),
            backgroundColor: AppTheme.danger,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _downloadingReports.remove(type));
    }
  }

  Future<void> _deleteSchedule(int id) async {
    final engine = context.read<DataEngine>();
    
    // Optimistic UI: Remove instantly for zero latency feel
    final index = _schedules.indexWhere((s) => s['id'] == id);
    if (index == -1) return;
    final removedSchedule = _schedules[index];
    setState(() => _schedules.removeAt(index));

    try {
      final headers = await _getHeaders();
      final response = await http.delete(
        Uri.parse('${engine.baseUrl}/api/reports/schedules/$id'),
        headers: headers,
      );
      
      if (response.statusCode != 200 && response.statusCode != 204) {
        throw Exception('Server returned ${response.statusCode}');
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Schedule deleted'), 
            backgroundColor: AppTheme.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        // Revert optimistic delete on error
        setState(() => _schedules.insert(index, removedSchedule));
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Delete failed: $e'), 
            backgroundColor: AppTheme.danger,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    }
  }

  Future<void> _showAddScheduleDialog() async {
    String? selectedReport;
    String? selectedFrequency;
    String? selectedChannel;
    final recipientCtrl = TextEditingController();
    final formKey = GlobalKey<FormState>();

    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Add Report Schedule'),
        content: Form(
          key: formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  decoration: InputDecoration(
                    labelText: 'Report *', 
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  items: _allReports.map((r) => DropdownMenuItem(value: r['type'] as String, child: Text(r['title'] as String, overflow: TextOverflow.ellipsis))).toList(),
                  onChanged: (v) => selectedReport = v,
                  validator: (v) => v == null ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  decoration: InputDecoration(
                    labelText: 'Frequency *', 
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  items: ['Daily', 'Weekly', 'Monthly'].map((f) => DropdownMenuItem(value: f, child: Text(f))).toList(),
                  onChanged: (v) => selectedFrequency = v,
                  validator: (v) => v == null ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  decoration: InputDecoration(
                    labelText: 'Channel *', 
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  items: ['Email', 'WhatsApp', 'SMS'].map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                  onChanged: (v) => selectedChannel = v,
                  validator: (v) => v == null ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: recipientCtrl,
                  decoration: InputDecoration(
                    labelText: 'Recipient (Email/Phone)', 
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  keyboardType: TextInputType.emailAddress,
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryBlue, 
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () {
              if (formKey.currentState!.validate()) Navigator.pop(ctx, true);
            },
            child: const Text('Add'),
          ),
        ],
      ).animate().scale(duration: 200.ms, curve: Curves.easeOutBack),
    );

    if (result != true) return;

    final engine = context.read<DataEngine>();
    
    // Optimistic UI update: Instantly show the new schedule
    final tempId = DateTime.now().millisecondsSinceEpoch;
    final tempSchedule = {
      'id': tempId,
      'report_type': selectedReport,
      'frequency': selectedFrequency,
      'channel': selectedChannel,
      'recipient': recipientCtrl.text.trim().isNotEmpty ? recipientCtrl.text.trim() : null,
    };
    
    setState(() => _schedules.add(tempSchedule));

    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('${engine.baseUrl}/api/reports/schedules'),
        headers: headers,
        body: jsonEncode(tempSchedule),
      );
      
      if (response.statusCode == 201) {
        // Fetch real data quietly in background to get actual IDs
        _loadSchedules();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('✅ Schedule added!'), 
              backgroundColor: AppTheme.success,
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              duration: const Duration(seconds: 2),
            ),
          );
        }
      } else {
        throw Exception('Server returned ${response.statusCode}');
      }
    } catch (e) {
      if (mounted) {
        // Revert optimistic add
        setState(() => _schedules.removeWhere((s) => s['id'] == tempId));
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Failed: $e'), 
            backgroundColor: AppTheme.danger,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final filteredReports = _selectedFilter == 'All'
        ? _allReports
        : _allReports.where((r) => r['category'] == _selectedFilter).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          const SizedBox(height: 16),
          _buildFilterChips(),
          const SizedBox(height: 16),
          // Animate the list changes
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 300),
            transitionBuilder: (child, animation) => FadeTransition(
              opacity: animation,
              child: SlideTransition(
                position: Tween<Offset>(begin: const Offset(0, 0.05), end: Offset.zero).animate(animation),
                child: child,
              ),
            ),
            child: Column(
              key: ValueKey<String>(_selectedFilter),
              children: filteredReports.asMap().entries.map((entry) {
                return _buildReportItem(entry.value)
                    .animate()
                    .fadeIn(duration: 300.ms, delay: (entry.key * 50).ms)
                    .slideY(begin: 0.1, end: 0, curve: Curves.easeOutCubic);
              }).toList(),
            ),
          ),
          const SizedBox(height: 24),
          _buildSchedulingSection(),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Automated Reports', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
        Text('Download and schedule compliance and performance reports', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
      ],
    ).animate().fadeIn(duration: 400.ms).slideY(begin: -0.2, end: 0, curve: Curves.easeOutQuad);
  }

  Widget _buildFilterChips() {
    final categories = ['All', 'Performance', 'Compliance', 'Fuel', 'Financial', 'Maintenance'];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Wrap(
        spacing: 8,
        children: categories.map((cat) {
          final isSelected = _selectedFilter == cat;
          return FilterChip(
            label: Text(cat),
            selected: isSelected,
            selectedColor: AppTheme.primaryBlue.withOpacity(0.2),
            checkmarkColor: AppTheme.primaryBlue,
            onSelected: (selected) {
              if (selected) setState(() => _selectedFilter = cat);
            },
          ).animate(target: isSelected ? 1 : 0)
           .scaleXY(end: 1.05, duration: 150.ms, curve: Curves.easeOut)
           .tint(color: isSelected ? AppTheme.primaryBlue.withOpacity(0.1) : Colors.transparent);
        }).toList(),
      ),
    ).animate().fadeIn(duration: 300.ms).slideX(begin: 0.1, end: 0);
  }

  Widget _buildReportItem(Map<String, dynamic> report) {
    final type = report['type'] as String;
    final isDownloading = _downloadingReports.contains(type);
    
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: Material(
        color: Theme.of(context).cardColor,
        borderRadius: BorderRadius.circular(12),
        elevation: 1,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () {
            // Native ripple provides tap feedback
          },
          child: Padding(
            padding: const EdgeInsets.all(12.0),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: AppTheme.primaryBlue.withOpacity(0.1),
                  child: Icon(report['icon'] as IconData, color: AppTheme.primaryBlue, size: 20),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(report['title'] as String, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                      const SizedBox(height: 4),
                      Text(report['desc'] as String, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                isDownloading
                    ? const SizedBox(width: 28, height: 28, child: CircularProgressIndicator(strokeWidth: 2))
                    : IconButton(
                        icon: const Icon(LucideIcons.download, size: 20, color: AppTheme.primaryBlue),
                        style: IconButton.styleFrom(
                          backgroundColor: AppTheme.primaryBlue.withOpacity(0.05),
                        ),
                        onPressed: () => _downloadReport(report['title'] as String, type),
                      ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSchedulingSection() {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(LucideIcons.calendar, color: AppTheme.primaryBlue, size: 18),
                SizedBox(width: 8),
                Text('Schedule Reports', style: TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 12),
            const Text('Automatically receive reports in your inbox or WhatsApp.', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
            const SizedBox(height: 16),
            
            // Smooth animated size for schedules container
            AnimatedSize(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeInOut,
              child: _loadingSchedules && _schedules.isEmpty
                  ? Center(child: _buildShimmerLoading())
                  : _schedules.isEmpty
                      ? const Text('No schedules yet. Add one below!', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)).animate().fadeIn()
                      : Column(
                          children: _schedules.map((s) => _buildScheduleRow(s)
                            .animate(key: ValueKey(s['id']))
                            .fadeIn(duration: 400.ms)
                            .slideX(begin: -0.1, end: 0, curve: Curves.easeOutCubic)
                          ).toList(),
                        ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: _showAddScheduleDialog,
                icon: const Icon(LucideIcons.plus, size: 16),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryBlue, 
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                label: const Text('Add Schedule'),
              ).animate(onPlay: (controller) => controller.repeat(reverse: true))
               .shimmer(duration: 2.seconds, color: Colors.white24, curve: Curves.easeInOut),
            ),
          ],
        ),
      ),
    ).animate().fadeIn(duration: 500.ms, delay: 200.ms).slideY(begin: 0.1, end: 0);
  }

  Widget _buildShimmerLoading() {
    return Column(
      children: List.generate(2, (index) => Padding(
        padding: const EdgeInsets.only(bottom: 8.0),
        child: Container(
          height: 30,
          decoration: BoxDecoration(
            color: Colors.grey[300],
            borderRadius: BorderRadius.circular(8),
          ),
        ),
      )),
    ).animate(onPlay: (controller) => controller.repeat(reverse: true))
     .fade(begin: 0.5, end: 1.0, duration: 800.ms);
  }

  Widget _buildScheduleRow(Map<String, dynamic> schedule) {
    final reportType = schedule['report_type'] ?? '';
    final matchingReport = _allReports.firstWhere((r) => r['type'] == reportType, orElse: () => {'title': reportType});
    final title = matchingReport['title'] as String;
    final frequency = schedule['frequency'] ?? '';
    final channel = schedule['channel'] ?? '';
    final id = schedule['id'];

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 8.0, horizontal: 8.0),
      margin: const EdgeInsets.only(bottom: 6.0),
      decoration: BoxDecoration(
        color: AppTheme.background,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13), overflow: TextOverflow.ellipsis),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: AppTheme.primaryBlue.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
            child: Text(frequency, style: const TextStyle(color: AppTheme.primaryBlue, fontSize: 10, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: AppTheme.success.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
            child: Text(channel, style: const TextStyle(color: AppTheme.success, fontSize: 10, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: () => _deleteSchedule(id is int ? id : int.tryParse(id.toString()) ?? 0),
            child: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppTheme.danger.withOpacity(0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Icon(LucideIcons.trash2, size: 14, color: AppTheme.danger),
            ),
          ),
        ],
      ),
    );
  }
}
