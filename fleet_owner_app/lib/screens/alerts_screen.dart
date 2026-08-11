import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../models/engine.dart';
import '../core/theme.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  String _formatTime(String t) {
    try {
      final dt = DateTime.parse(t).toLocal();
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      final hr = dt.hour > 12 ? dt.hour - 12 : (dt.hour == 0 ? 12 : dt.hour);
      final min = dt.minute.toString().padLeft(2, '0');
      final day = dt.day.toString().padLeft(2, '0');
      final month = dt.month.toString().padLeft(2, '0');
      return '$day/$month/${dt.year}, $hr:$min $ampm';
    } catch(e) {
      return t;
    }
  }

  String _filter = 'all'; // all, critical, warnings
  AlertCategory? _categoryFilter;

  bool _whatsappEnabled = true;
  bool _smsEnabled = false;
  bool _emailEnabled = true;
  bool _pushEnabled = true;

  @override
  Widget build(BuildContext context) {
    final engine = context.watch<DataEngine>();
    
    // Filter alerts based on status (exclude dismissed) and category/severity
    final activeAlerts = engine.alerts.where((a) => a.status != AlertStatus.dismissed).toList();
    
    final filteredAlerts = activeAlerts.where((a) {
      bool categoryMatch = _categoryFilter == null || a.category == _categoryFilter;
      bool severityMatch = _filter == 'all' || 
                          (_filter == 'critical' && a.sev == 'danger') || 
                          (_filter == 'warnings' && a.sev == 'warning');
      return categoryMatch && severityMatch;
    }).toList();

    int critical = activeAlerts.where((a) => a.sev == 'danger').length;
    int warning = activeAlerts.where((a) => a.sev == 'warning').length;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            alignment: WrapAlignment.spaceBetween,
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 16,
            runSpacing: 16,
            children: [
              const Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('Alerts & Notifications', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  Text('Real-time system events and actionable insights', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                ],
              ),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  TextButton.icon(
                    onPressed: () async {
                      final messenger = ScaffoldMessenger.of(context);
                      try {
                        final ok = await engine.clearAllAlerts();
                        messenger.showSnackBar(
                          SnackBar(
                            content: Text(ok ? 'All alerts cleared' : 'Failed to clear alerts'),
                            backgroundColor: ok ? AppTheme.success : AppTheme.danger,
                            duration: const Duration(seconds: 2),
                          ),
                        );
                      } catch (e) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: const Text('Error clearing alerts'), backgroundColor: AppTheme.danger),
                        );
                      }
                    },
                    icon: const Icon(LucideIcons.trash2, size: 14),
                    label: const Text('Clear All'),
                    style: TextButton.styleFrom(foregroundColor: AppTheme.textSecondary),
                  ),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(backgroundColor: AppTheme.success, foregroundColor: Colors.white),
                    onPressed: () async {
                      final ok = await engine.markAllAlertsAsRead();
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(ok ? 'All alerts marked as read' : 'Failed to mark alerts as read'),
                            backgroundColor: ok ? AppTheme.success : AppTheme.danger,
                            duration: const Duration(seconds: 2),
                          ),
                        );
                      }
                    },
                    icon: const Icon(LucideIcons.checkCheck, size: 14), 
                    label: const Text('Mark All Read')
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),

          _buildKpis(activeAlerts.length, critical, warning),
          const SizedBox(height: 16),
          _buildFilters(),
          const SizedBox(height: 16),
          _buildAlertsList(engine, filteredAlerts),
        ],
      ),
    );
  }

  Widget _buildNotificationSettings() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white, 
        borderRadius: BorderRadius.circular(12), 
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(LucideIcons.bellRing, size: 18, color: AppTheme.primaryBlue),
              SizedBox(width: 8),
              Text('Notification Delivery', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            ],
          ),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 2.5,
            children: [
              _channelCard('WhatsApp', LucideIcons.messageSquare, _whatsappEnabled, (v) => setState(() => _whatsappEnabled = v)),
              _channelCard('SMS', LucideIcons.smartphone, _smsEnabled, (v) => setState(() => _smsEnabled = v)),
              _channelCard('Email', LucideIcons.mail, _emailEnabled, (v) => setState(() => _emailEnabled = v)),
              _channelCard('Push', LucideIcons.bell, _pushEnabled, (v) => setState(() => _pushEnabled = v)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPerTypeTogglesPanel(DataEngine engine) {
    final settings = engine.alertSettings;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white, 
        borderRadius: BorderRadius.circular(12), 
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Alert Types Enabled', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: settings.perTypeToggles.entries.map((e) {
              final isEnabled = e.value;
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: isEnabled ? AppTheme.primaryBlue.withOpacity(0.1) : Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: isEnabled ? AppTheme.primaryBlue.withOpacity(0.3) : Colors.grey.shade300),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      e.key.toUpperCase(), 
                      style: TextStyle(
                        fontSize: 11, 
                        fontWeight: FontWeight.bold,
                        color: isEnabled ? AppTheme.primaryBlue : AppTheme.textSecondary
                      )
                    ),
                    const SizedBox(width: 4),
                    Switch(
                      value: isEnabled,
                      onChanged: (val) {
                        final newToggles = Map<String, bool>.from(settings.perTypeToggles);
                        newToggles[e.key] = val;
                        engine.updateAlertSettings(settings.copyWith(perTypeToggles: newToggles));
                      },
                      activeColor: AppTheme.primaryBlue,
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _channelCard(String title, IconData icon, bool value, Function(bool) onChanged) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppTheme.primaryBlue, size: 18),
          const SizedBox(width: 8),
          Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
          Switch(
            value: value, 
            onChanged: onChanged, 
            activeColor: AppTheme.primaryBlue,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
        ],
      ),
    );
  }

  Widget _buildFilters() {
    final List<DropdownMenuItem<String>> items = [
      const DropdownMenuItem(value: 'all', child: Text('All')),
      const DropdownMenuItem(value: 'critical', child: Text('Critical')),
      const DropdownMenuItem(value: 'warnings', child: Text('Warnings')),
      ...AlertCategory.values.map((cat) => DropdownMenuItem(
        value: 'cat_${cat.name}',
        child: Text(cat.name.toUpperCase()),
      )),
    ];

    String currentValue = 'all';
    if (_categoryFilter != null) {
      currentValue = 'cat_${_categoryFilter!.name}';
    } else if (_filter != 'all') {
      currentValue = _filter;
    }

    return Card(
      elevation: 4,
      shadowColor: Colors.black12,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<String>(
            value: currentValue,
            isExpanded: true,
            icon: const Icon(Icons.arrow_drop_down, color: AppTheme.textSecondary),
            hint: Row(
              children: [
                const Icon(Icons.search, color: AppTheme.textSecondary),
                const SizedBox(width: 12),
                const Text('Search for alert type...', style: TextStyle(color: AppTheme.textSecondary, fontSize: 14)),
              ],
            ),
            selectedItemBuilder: (BuildContext context) {
              return items.map((item) {
                return Row(
                  children: [
                    const Icon(Icons.search, color: AppTheme.textSecondary),
                    const SizedBox(width: 12),
                    item.child!,
                  ],
                );
              }).toList();
            },
            items: items,
            onChanged: (String? val) {
              if (val != null) {
                setState(() {
                  if (val == 'all' || val == 'critical' || val == 'warnings') {
                    _filter = val;
                    _categoryFilter = null;
                  } else if (val.startsWith('cat_')) {
                    _filter = 'all';
                    final catName = val.substring(4);
                    _categoryFilter = AlertCategory.values.firstWhere((c) => c.name == catName);
                  }
                });
              }
            },
          ),
        ),
      ),
    );
  }

  Widget _buildKpis(int total, int critical, int warning) {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: [
        _kpiCard('Active Alerts', '$total', 'total unresolved', AppTheme.primaryBlue),
        _kpiCard('Critical Priority', '$critical', 'immediate action', AppTheme.danger),
        _kpiCard('Warnings', '$warning', 'monitor closely', AppTheme.warning),
      ],
    );
  }

  Widget _kpiCard(String title, String value, String subtitle, Color color) {
    return Container(
      width: 150,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.1)),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
          const SizedBox(height: 4),
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 2),
          Text(subtitle, style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary)),
        ],
      ),
    );
  }

  Widget _buildAlertsList(DataEngine engine, List<Alert> alerts) {
    if (alerts.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 60),
          child: Column(
            children: [
              Icon(LucideIcons.shieldCheck, size: 48, color: Colors.grey),
              SizedBox(height: 12),
              Text('No active alerts matching criteria', style: TextStyle(color: AppTheme.textSecondary)),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: alerts.length,
      itemBuilder: (context, index) {
        final a = alerts[index];
        final color = a.sev == 'danger' ? AppTheme.danger : AppTheme.warning;
        
        IconData icon;
        switch (a.category) {
          case AlertCategory.safety: icon = LucideIcons.shieldAlert; break;
          case AlertCategory.fuel: icon = LucideIcons.fuel; break;
          case AlertCategory.compliance: icon = LucideIcons.fileWarning; break;
          case AlertCategory.connectivity: icon = LucideIcons.wifiOff; break;
        }

        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey.shade200),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.02),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(a.truck, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                          child: Text(a.sev.toUpperCase(), style: TextStyle(fontSize: 9, color: color, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text('Driver: ${a.driver}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 2),
                    Text(a.msg, style: TextStyle(fontSize: 13, color: a.status == AlertStatus.acknowledged ? AppTheme.textSecondary : AppTheme.textPrimary)),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(_formatTime(a.time), style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                        a.status == AlertStatus.pending 
                          ? InkWell(
                              onTap: () => engine.acknowledgeAlert(a.id),
                              child: const Text('Acknowledge', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.primaryBlue)),
                            )
                          : const Text('Acknowledged', style: TextStyle(fontSize: 11, color: AppTheme.success, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
