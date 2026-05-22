import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../core/theme.dart';

class AdminDashboardScreen extends StatelessWidget {
  const AdminDashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('System Admin Console', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        foregroundColor: AppTheme.textPrimary,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.bell),
            onPressed: () {},
            tooltip: 'Notifications',
          ),
          IconButton(
            icon: const Icon(LucideIcons.logOut, color: AppTheme.danger),
            onPressed: () async {
              await FirebaseAuth.instance.signOut();
              if (context.mounted) context.go('/login');
            },
            tooltip: 'Logout',
          ),
          const SizedBox(width: 16),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Welcome Back, Admin',
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
            ),
            const Text(
              'Here is what is happening on the platform today.',
              style: TextStyle(color: AppTheme.textSecondary, fontSize: 16),
            ),
            const SizedBox(height: 32),
            
            // Metrics Grid
            GridView.count(
              crossAxisCount: MediaQuery.of(context).size.width > 800 ? 4 : 2,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              children: [
                const _MetricCard(
                  title: 'Total Fleet Owners',
                  value: '1,245',
                  icon: LucideIcons.users,
                  trend: '+12% this month',
                  color: AppTheme.primaryBlue,
                ),
                const _MetricCard(
                  title: 'Active Vehicles',
                  value: '8,420',
                  icon: LucideIcons.truck,
                  trend: '+5% today',
                  color: AppTheme.success,
                ),
                const _MetricCard(
                  title: 'Monthly Revenue',
                  value: '\$24,500',
                  icon: LucideIcons.creditCard,
                  trend: '+8% vs last month',
                  color: AppTheme.warning,
                ),
                _MetricCard(
                  title: 'System Health',
                  value: '99.9%',
                  icon: LucideIcons.activity,
                  trend: 'All systems operational',
                  color: Colors.purple.shade400,
                ),
              ],
            ),
            
            const SizedBox(height: 32),
            
            // Two Column Layout for wider screens
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Recent Registrations (Fleet Owners)
                Expanded(
                  flex: 2,
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 10)],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'Pending Approvals',
                              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                            ),
                            TextButton(
                              onPressed: () {},
                              child: const Text('View All'),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        const _UserApprovalTile(
                          name: 'Rajesh Logistics',
                          email: 'rajesh@logistics.com',
                          date: '2 hours ago',
                        ),
                        const _UserApprovalTile(
                          name: 'SafeMove Transports',
                          email: 'contact@safemove.in',
                          date: '5 hours ago',
                        ),
                        const _UserApprovalTile(
                          name: 'Speedy Delivery Co.',
                          email: 'admin@speedy.com',
                          date: 'Yesterday',
                        ),
                      ],
                    ),
                  ),
                ),
                
                const SizedBox(width: 24),
                
                // Platform Status
                Expanded(
                  flex: 1,
                  child: Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 10)],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'System Status',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 20),
                        const _StatusItem(label: 'API Server', status: 'Operational', isOk: true),
                        const _StatusItem(label: 'Database', status: 'Operational', isOk: true),
                        const _StatusItem(label: 'Notification Service', status: 'Operational', isOk: true),
                        const _StatusItem(label: 'Map Tile Server', status: 'Slow Response', isOk: false),
                        const Divider(height: 32),
                        const Text(
                          'Quick Actions',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppTheme.textSecondary),
                        ),
                        const SizedBox(height: 12),
                        ElevatedButton.icon(
                          onPressed: () {},
                          icon: const Icon(LucideIcons.refreshCw, size: 16),
                          label: const Text('Restart Background Jobs'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.background,
                            foregroundColor: AppTheme.textPrimary,
                            elevation: 0,
                            minimumSize: const Size(double.infinity, 40),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final String trend;
  final Color color;

  const _MetricCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.trend,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [BoxShadow(color: Colors.black12, blurRadius: 10)],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 24),
              ),
              Text(
                trend,
                style: const TextStyle(fontSize: 12, color: AppTheme.success, fontWeight: FontWeight.w500),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            value,
            style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
          ),
          Text(
            title,
            style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _UserApprovalTile extends StatelessWidget {
  final String name;
  final String email;
  final String date;

  const _UserApprovalTile({required this.name, required this.email, required this.date});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: Row(
        children: [
          CircleAvatar(
            backgroundColor: AppTheme.primaryBlue.withOpacity(0.1),
            child: const Icon(LucideIcons.building, color: AppTheme.primaryBlue, size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                Text(email, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
              ],
            ),
          ),
          Text(date, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
          const SizedBox(width: 16),
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primaryBlue,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text('Approve', style: TextStyle(fontSize: 12)),
          ),
          const SizedBox(width: 8),
          OutlinedButton(
            onPressed: () {},
            style: OutlinedButton.styleFrom(
              foregroundColor: AppTheme.danger,
              side: const BorderSide(color: AppTheme.danger),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: const Text('Deny', style: TextStyle(fontSize: 12)),
          ),
        ],
      ),
    );
  }
}

class _StatusItem extends StatelessWidget {
  final String label;
  final String status;
  final bool isOk;

  const _StatusItem({required this.label, required this.status, required this.isOk});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w500)),
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: isOk ? AppTheme.success : AppTheme.warning,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                status,
                style: TextStyle(
                  color: isOk ? AppTheme.success : AppTheme.warning,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
