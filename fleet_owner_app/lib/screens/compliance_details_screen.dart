import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import 'package:provider/provider.dart';
import '../models/engine.dart';
import 'package:lucide_icons/lucide_icons.dart';

class ComplianceDetailsScreen extends StatelessWidget {
  final String initialTab;

  const ComplianceDetailsScreen({super.key, required this.initialTab});

  @override
  Widget build(BuildContext context) {
    final vehicles = context.watch<DataEngine>().vehicles;
    
    final now = DateTime.now();
    final next7Days = now.add(const Duration(days: 7));

    List<Map<String, String>> expired = [];
    List<Map<String, String>> expiringSoon = [];
    List<Map<String, String>> valid = [];

    for (var v in vehicles) {
      void check(String dateStr, String type) {
        if (dateStr.isEmpty) return;
        try {
          final date = DateTime.parse(dateStr);
          final item = {
            'plate': v.plate,
            'type': type,
            'date': dateStr.split('T')[0],
          };
          
          if (date.isBefore(now)) {
            expired.add(item);
          } else if (date.isBefore(next7Days)) {
            expiringSoon.add(item);
          } else {
            valid.add(item);
          }
        } catch (_) {}
      }
      check(v.insurance, 'Insurance');
      check(v.permit, 'Permit');
      check(v.puc, 'PUC');
      check(v.nextService, 'Service');
    }

    return DefaultTabController(
      length: 3,
      initialIndex: initialTab == 'Expired' ? 0 : (initialTab == 'Expiring Soon' ? 1 : 2),
      child: Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(LucideIcons.arrowLeft),
            tooltip: 'Back',
            onPressed: () {
              if (context.canPop()) {
                context.pop();
              } else {
                context.go('/dashboard');
              }
            },
          ),
          title: const Text('Compliance Documents'),
          backgroundColor: Colors.white,
          foregroundColor: AppTheme.textPrimary,
          elevation: 0,
          bottom: const TabBar(
            labelColor: AppTheme.primaryBlue,
            unselectedLabelColor: AppTheme.textSecondary,
            indicatorColor: AppTheme.primaryBlue,
            tabs: [
              Tab(text: 'Expired'),
              Tab(text: 'Expiring Soon'),
              Tab(text: 'Valid'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _DocList(docs: expired, color: AppTheme.danger, icon: LucideIcons.alertOctagon),
            _DocList(docs: expiringSoon, color: AppTheme.warning, icon: LucideIcons.clock),
            _DocList(docs: valid, color: AppTheme.success, icon: LucideIcons.checkCircle),
          ],
        ),
      ),
    );
  }
}

class _DocList extends StatelessWidget {
  final List<Map<String, String>> docs;
  final Color color;
  final IconData icon;

  const _DocList({required this.docs, required this.color, required this.icon});

  @override
  Widget build(BuildContext context) {
    if (docs.isEmpty) {
      return const Center(child: Text('No documents found in this category.', style: TextStyle(color: AppTheme.textSecondary)));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: docs.length,
      itemBuilder: (context, index) {
        final doc = docs[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: ListTile(
            leading: Icon(icon, color: color),
            title: Text(doc['plate']!, style: const TextStyle(fontWeight: FontWeight.bold)),
            subtitle: Text('${doc['type']} • Expiry: ${doc['date']}'),
            trailing: const Icon(LucideIcons.chevronRight, size: 16),
            onTap: () {
              // Can navigate to vehicle profile
            },
          ),
        );
      },
    );
  }
}
