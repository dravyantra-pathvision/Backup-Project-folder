import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../core/theme.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  String _selectedFilter = 'All';
  
  final List<Map<String, dynamic>> _allReports = [
    {'title': 'Daily Fleet Summary', 'desc': 'Distance covered, fuel consumed, active vehicles.', 'icon': LucideIcons.fileText, 'category': 'Performance'},
    {'title': 'Driver Compliance Report', 'desc': 'License expiries, health scores, and leaves.', 'icon': LucideIcons.userCheck, 'category': 'Compliance'},
    {'title': 'Monthly Fuel Audit', 'desc': 'Complete ledger of all fill-ups across all stations.', 'icon': LucideIcons.fuel, 'category': 'Fuel'},
    {'title': 'Expense & Toll Report', 'desc': 'FASTag deductions and miscellaneous expenses.', 'icon': LucideIcons.receipt, 'category': 'Financial'},
    {'title': 'Vehicle Health Report', 'desc': 'Maintenance logs, service due dates, and health scores.', 'icon': LucideIcons.shieldCheck, 'category': 'Maintenance'},
    {'title': 'Trip Efficiency Report', 'desc': 'Route deviations, delays, and load efficiency.', 'icon': LucideIcons.trendingUp, 'category': 'Performance'},
    {'title': 'Idle Analysis Report', 'desc': 'Detailed breakdown of vehicle idling times.', 'icon': LucideIcons.clock, 'category': 'Performance'},
    {'title': 'Alert History Report', 'desc': 'Log of all critical alerts and resolutions.', 'icon': LucideIcons.bell, 'category': 'Compliance'},
    {'title': 'Client Billing Report', 'desc': 'Invoices, proof of delivery, and client summaries.', 'icon': LucideIcons.briefcase, 'category': 'Financial'},
  ];

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
          ...filteredReports.map((r) => _buildReportItem(r['title'], r['desc'], r['icon'])),
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
    );
  }

  Widget _buildFilterChips() {
    final categories = ['All', 'Performance', 'Compliance', 'Fuel', 'Financial', 'Maintenance'];
    return Wrap(
      spacing: 8,
      children: categories.map((cat) {
        return FilterChip(
          label: Text(cat),
          selected: _selectedFilter == cat,
          onSelected: (selected) {
            if (selected) {
              setState(() => _selectedFilter = cat);
            }
          },
        );
      }).toList(),
    );
  }

  Widget _buildReportItem(String title, String desc, IconData icon) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: AppTheme.primaryBlue.withOpacity(0.1),
          child: Icon(icon, color: AppTheme.primaryBlue, size: 20),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
        subtitle: Text(desc, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
        trailing: ElevatedButton.icon(
          onPressed: () {},
          icon: const Icon(LucideIcons.download, size: 14),
          label: const Text('Download'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppTheme.background,
            foregroundColor: AppTheme.textPrimary,
            elevation: 0,
            side: const BorderSide(color: Colors.grey),
          ),
        ),
      ),
    );
  }

  Widget _buildSchedulingSection() {
    return Card(
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
            _buildScheduleRow('Daily Fleet Summary', 'Daily', 'Email'),
            _buildScheduleRow('Monthly Fuel Audit', 'Monthly', 'WhatsApp'),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () {},
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white),
              child: const Text('Add Schedule'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildScheduleRow(String report, String frequency, String channel) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        children: [
          Text(report, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: AppTheme.primaryBlue.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
            child: Text(frequency, style: const TextStyle(color: AppTheme.primaryBlue, fontSize: 10, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(color: AppTheme.success.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
            child: Text(channel, style: const TextStyle(color: AppTheme.success, fontSize: 10, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(width: 8),
          const Icon(LucideIcons.trash2, size: 14, color: AppTheme.danger),
        ],
      ),
    );
  }
}
