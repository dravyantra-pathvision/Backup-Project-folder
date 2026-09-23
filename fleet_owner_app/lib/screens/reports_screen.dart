import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';

class ReportsScreen extends StatefulWidget {
  const ReportsScreen({super.key});

  @override
  State<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends State<ReportsScreen> {
  final List<Map<String, dynamic>> _reports = [
    {
      'id': 'fleet_performance',
      'title': 'Fleet Performance Report',
      'desc': 'Complete operational overview: vehicle trips, distance, fuel efficiency, idling, and overspeeding metrics.',
      'icon': LucideIcons.gauge,
      'color': AppTheme.primaryBlue,
    },
    {
      'id': 'fuel_savings',
      'title': 'Fuel & Savings Report',
      'desc': 'Audited financial savings: verified baseline fuel savings, prevented loss, and identified fuel waste breakdown.',
      'icon': LucideIcons.wallet,
      'color': AppTheme.success,
    },
    {
      'id': 'driver_performance',
      'title': 'Driver Performance & Safety Report',
      'desc': 'Driver safety rankings, scores, overspeeding violations, idling duration, and attention alerts.',
      'icon': LucideIcons.userCheck,
      'color': const Color(0xFF8E44AD),
    },
    {
      'id': 'trip_activity',
      'title': 'Trip & Vehicle Activity Report',
      'desc': 'Detailed trip logs, vehicle usage, start/end locations, trip durations, and major in-transit alerts.',
      'icon': LucideIcons.navigation,
      'color': const Color(0xFF2980B9),
    },
    {
      'id': 'fuel_loss',
      'title': 'Fuel Loss / Theft Report',
      'desc': 'Abnormal fuel drops, idling waste, overspeeding fuel impact, and prevented vs unrecovered loss events.',
      'icon': LucideIcons.alertOctagon,
      'color': AppTheme.danger,
    },
    {
      'id': 'carbon_impact',
      'title': 'Carbon Impact Report',
      'desc': 'ESG environmental summary: verified CO₂ avoided (kg CO₂) and Pure Carbon (C) reduced (kg C) baseline stats.',
      'icon': LucideIcons.leaf,
      'color': const Color(0xFF27AE60),
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(),
            const SizedBox(height: 24),
            _buildReportsGrid(context),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Fleet Intelligence Reports',
          style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
        ),
        SizedBox(height: 6),
        Text(
          'Select an official DravYantra report category below to view detailed metrics, insights, and downloadable PDF business reports.',
          style: TextStyle(fontSize: 13, color: AppTheme.textSecondary, height: 1.4),
        ),
      ],
    );
  }

  Widget _buildReportsGrid(BuildContext context) {
    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _reports.length,
      separatorBuilder: (_, __) => const SizedBox(height: 16),
      itemBuilder: (ctx, index) {
        final r = _reports[index];
        final Color color = r['color'];

        return Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey.shade200),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.02),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(18.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: color.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(r['icon'], color: color, size: 22),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Text(
                        r['title'],
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'Audit Standard',
                        style: TextStyle(fontSize: 10, color: AppTheme.textSecondary, fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  r['desc'],
                  style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary, height: 1.35),
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(LucideIcons.calendar, size: 13, color: AppTheme.textSecondary),
                        SizedBox(width: 4),
                        Text('Period-aware filterable', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                      ],
                    ),
                    ElevatedButton.icon(
                      onPressed: () {
                        context.go('/report-detail?type=${r['id']}');
                      },
                      icon: const Icon(LucideIcons.arrowRight, size: 14),
                      label: const Text('View Report'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: color,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
