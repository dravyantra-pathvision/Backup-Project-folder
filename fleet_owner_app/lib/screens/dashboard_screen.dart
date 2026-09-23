import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../core/theme.dart';
import '../models/engine.dart';
import '../widgets/live_ticker.dart';
import 'compliance_details_screen.dart';
import 'driver_profile_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkProfileCompletion();
    });
  }

  void _checkProfileCompletion() async {
    if (!mounted) return;
    final engine = Provider.of<DataEngine>(context, listen: false);
    
    while (!engine.profileLoaded && mounted) {
      await Future.delayed(const Duration(milliseconds: 500));
    }
    if (!mounted) return;

    final bool isUserComplete = engine.user.isComplete;
    final bool isOrgComplete = engine.org.isComplete;
    
    if (!isUserComplete || !isOrgComplete) {
      final now = DateTime.now();
      final lastPrompted = engine.lastPromptedAt;
      
      if (lastPrompted == null || now.difference(lastPrompted).inHours >= 24) {
        String missing = '';
        if (!isUserComplete && !isOrgComplete) {
          missing = 'User Profile and Organization Profile';
        } else if (!isUserComplete) {
          missing = 'User Profile';
        } else {
          missing = 'Organization Profile';
        }

        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (dialogCtx) {
            return AlertDialog(
              backgroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: const Row(
                children: [
                  Icon(LucideIcons.alertTriangle, color: AppTheme.danger, size: 24),
                  SizedBox(width: 8),
                  Text('Complete Profile Setup', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: AppTheme.textPrimary)),
                ],
              ),
              content: Text(
                'Please complete your $missing in Settings to unlock all DravYantra Logistics features.',
                style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary),
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    engine.recordPromptTime();
                    Navigator.pop(dialogCtx);
                  },
                  child: const Text('Remind Me Later', style: TextStyle(color: AppTheme.textSecondary)),
                ),
                ElevatedButton(
                  onPressed: () {
                    engine.recordPromptTime();
                    Navigator.pop(dialogCtx);
                    context.go('/settings');
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryBlue,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: const Text('Go to Settings'),
                ),
              ],
            );
          },
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _LiveTicker(),
          const SizedBox(height: 12),
          const _PeriodSelector(),
          const SizedBox(height: 16),
          const _KpiGrid(),
          const SizedBox(height: 16),
          LayoutBuilder(
            builder: (context, constraints) {
              if (constraints.maxWidth > 1000) {
                return const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(flex: 1, child: _ActiveAlertsPanel()),
                    SizedBox(width: 16),
                    Expanded(flex: 1, child: _DriverLeaderboard()),
                  ],
                );
              } else {
                return const Column(
                  children: [
                    _ActiveAlertsPanel(),
                    SizedBox(height: 16),
                    _DriverLeaderboard(),
                  ],
                );
              }
            },
          ),
          const SizedBox(height: 16),
          LayoutBuilder(
            builder: (context, constraints) {
              if (constraints.maxWidth > 1000) {
                return const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(flex: 2, child: _LiveFleetCard()),
                    SizedBox(width: 16),
                    Expanded(flex: 1, child: _CompliancePanel()),
                  ],
                );
              } else {
                return const Column(
                  children: [
                    _LiveFleetCard(),
                    SizedBox(height: 16),
                    _CompliancePanel(),
                  ],
                );
              }
            },
          ),
        ],
      ),
    );
  }
}

class _LiveTicker extends StatelessWidget {
  const _LiveTicker();

  @override
  Widget build(BuildContext context) {
    final alerts = context.watch<DataEngine>().alerts;
    if (alerts.isEmpty) return const SizedBox.shrink();

    return LiveTicker(
      children: alerts.map((a) {
        return Padding(
          padding: const EdgeInsets.only(right: 24),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.circle, size: 8, color: a.sev == 'danger' ? AppTheme.danger : AppTheme.warning),
              const SizedBox(width: 6),
              Text(a.truck, style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.bold, fontSize: 12)),
              const SizedBox(width: 6),
              const Text('—', style: TextStyle(color: Colors.white54)),
              const SizedBox(width: 6),
              Text(a.msg, style: const TextStyle(color: Colors.white, fontSize: 12)),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _PeriodSelector extends StatelessWidget {
  const _PeriodSelector();

  String _periodLabel(String period, DataEngine engine) {
    switch (period) {
      case 'today':
        return 'Today';
      case 'week':
        return 'This Week';
      case 'month':
        return 'This Month';
      case 'last_month':
        return 'Last Month';
      case 'custom':
        if (engine.customPeriodStart != null && engine.customPeriodEnd != null) {
          final fmt = DateFormat('MMM d');
          return '${fmt.format(engine.customPeriodStart!)} - ${fmt.format(engine.customPeriodEnd!)}';
        }
        return 'Custom';
      default:
        return 'Today';
    }
  }

  @override
  Widget build(BuildContext context) {
    final engine = context.watch<DataEngine>();
    final current = engine.selectedPeriod;

    final periods = [
      {'key': 'today', 'label': 'Today'},
      {'key': 'week', 'label': 'This Week'},
      {'key': 'month', 'label': 'This Month'},
      {'key': 'last_month', 'label': 'Last Month'},
      {'key': 'custom', 'label': 'Custom'},
    ];

    return Card(
      margin: EdgeInsets.zero,
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isSmall = constraints.maxWidth < 600;
            return Row(
              children: [
                const Icon(LucideIcons.calendar, size: 16, color: AppTheme.primaryBlue),
                const SizedBox(width: 8),
                Text(
                  isSmall ? 'Period:' : 'Filter Period:',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: periods.map((p) {
                        final key = p['key']!;
                        final label = p['label']!;
                        final isSelected = current == key;

                        return Padding(
                          padding: const EdgeInsets.only(right: 8.0),
                          child: ChoiceChip(
                            label: Text(
                              key == 'custom' && isSelected ? _periodLabel('custom', engine) : label,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                                color: isSelected ? Colors.white : AppTheme.textPrimary,
                              ),
                            ),
                            selected: isSelected,
                            selectedColor: AppTheme.primaryBlue,
                            backgroundColor: Colors.grey.shade100,
                            side: BorderSide.none,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            onSelected: (selected) async {
                              if (!selected) return;
                              if (key == 'custom') {
                                final now = DateTime.now();
                                final range = await showDateRangePicker(
                                  context: context,
                                  firstDate: DateTime(2024, 1, 1),
                                  lastDate: now,
                                  initialDateRange: DateTimeRange(
                                    start: engine.customPeriodStart ?? now.subtract(const Duration(days: 7)),
                                    end: engine.customPeriodEnd ?? now,
                                  ),
                                );
                                if (range != null) {
                                  engine.setPeriod('custom', start: range.start, end: range.end);
                                }
                              } else {
                                engine.setPeriod(key);
                              }
                            },
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _KpiGrid extends StatelessWidget {
  const _KpiGrid();

  String _inr(num n) {
    final value = n is int ? n.toString() : n.toStringAsFixed(2).replaceFirst(RegExp(r'\.00$'), '');
    final parts = value.split('.');
    final formattedInt = parts[0].replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},');
    return parts.length > 1 ? '₹$formattedInt.${parts[1]}' : '₹$formattedInt';
  }

  String _moneyWithLiters(num money, num liters) {
    final moneyStr = _inr(money);
    final String litersStr;
    if (liters == 0) {
      litersStr = '0 L';
    } else if (liters < 1) {
      litersStr = '${liters.toStringAsFixed(2)} L';
    } else if (liters == liters.toInt()) {
      litersStr = '${liters.toInt()} L';
    } else {
      litersStr = '${liters.toStringAsFixed(1)} L';
    }
    return '$moneyStr / $litersStr';
  }

  @override
  Widget build(BuildContext context) {
    final engine = context.watch<DataEngine>();
    final stats = engine.fleetStats;

    // Calculate total consumed fuel from in-memory trips as fallback if backend stats return 0
    final String todayDateStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
    double inMemoryConsumedL = 0.0;
    for (final t in engine.trips) {
      if (engine.selectedPeriod == 'today' && t.date.isNotEmpty && !t.date.startsWith(todayDateStr)) {
        continue;
      }
      final vMil = engine.vehicles.where((v) => v.plate == t.vehicle).map((v) => v.mil).firstWhere((m) => m > 0, orElse: () => 4.0);
      final effectiveMil = vMil > 0 ? vMil : (t.defaultMileage > 0 ? t.defaultMileage : 4.0);
      final fUsed = t.fuelUsed > 0 ? t.fuelUsed : (t.distance > 0 ? t.distance / effectiveMil : 0.0);
      inMemoryConsumedL += fUsed;
    }

    final double fuelConsumedL = (stats?.fuelConsumedL != null && stats!.fuelConsumedL > 0)
        ? stats.fuelConsumedL
        : (engine.spendLiters > 0 ? engine.spendLiters.toDouble() : inMemoryConsumedL);

    final double fuelSpend = (stats?.fuelCostRupees != null && stats!.fuelCostRupees > 0)
        ? stats.fuelCostRupees
        : (engine.spend > 0 ? engine.spend.toDouble() : (fuelConsumedL * engine.alertSettings.fuelPricePerLiter));

    final double verifiedSavingsRupees = stats?.verifiedSavingsRupees ?? engine.savings.toDouble();
    final double fuelSavedLiters = stats?.fuelSavedLiters ?? engine.savingsLiters.toDouble();

    final double totalLossRupees = stats?.totalLossRupees ?? engine.loss;
    final double totalLossLiters = stats?.totalLossLiters ?? engine.lossLiters.toDouble();

    final double co2Avoided = stats?.co2AvoidedKg ?? (fuelSavedLiters * 2.68);
    final double carbonReduced = stats?.carbonReducedKg ?? (co2Avoided * (12.0 / 44.0));

    final totalVehicles = engine.vehicles.length;
    final assignedVehicles = engine.vehicles.where((v) => v.driver.isNotEmpty).length;

    final totalDrivers = engine.drivers.length;
    final activeDrivers = engine.drivers.where((d) => d.vehicle.isNotEmpty || d.status == 'on_duty').length;

    final periodTitle = _getPeriodDisplayTitle(engine.selectedPeriod);

    final double screenWidth = MediaQuery.of(context).size.width;
    final int crossCount = screenWidth > 1200 ? 3 : (screenWidth > 750 ? 2 : 1);
    final double aspect = screenWidth > 1200 ? 2.2 : (screenWidth > 600 ? 2.0 : (screenWidth < 400 ? 2.4 : 2.15));

    return GridView.count(
      crossAxisCount: crossCount,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: aspect,
      children: [
        // 1. Savings Wallet Card
        _buildKpiCard(
          title: 'Savings Wallet',
          value: _inr(verifiedSavingsRupees),
          subtitle: '${fuelSavedLiters.toStringAsFixed(1)} L Saved • $periodTitle',
          icon: LucideIcons.wallet,
          color: AppTheme.success,
          badgeText: 'Verified Savings',
          onTap: () => context.go('/savings-wallet'),
        ),

        // 2. Fuel Consumed Card
        _buildKpiCard(
          title: 'Fuel Consumed',
          value: _moneyWithLiters(fuelSpend, fuelConsumedL),
          subtitle: 'Click to view vehicle breakdown • $periodTitle',
          icon: LucideIcons.fuel,
          color: AppTheme.primaryBlue,
          badgeText: '$periodTitle',
          onTap: () => context.go('/fuel-consumed'),
        ),

        // 3. Fuel Loss Card
        _buildKpiCard(
          title: 'Fuel Loss',
          value: _moneyWithLiters(totalLossRupees, totalLossLiters),
          subtitle: 'Idling, Speeding & Theft • $periodTitle',
          icon: LucideIcons.trendingDown,
          color: AppTheme.danger,
          badgeText: 'Loss Breakdown',
          onTap: () => context.go('/fuel-loss'),
        ),

        // 4. CO2 Avoided & Carbon Reduced Card
        _buildKpiCard(
          title: 'CO₂ & Carbon Reduction',
          value: '${co2Avoided.toStringAsFixed(1)} kg CO₂',
          subtitle: '${carbonReduced.toStringAsFixed(1)} kg Carbon (C) Reduced',
          icon: LucideIcons.leaf,
          color: AppTheme.success,
          badgeText: 'From Fuel Saved',
          onTap: () => context.go('/carbon-analytics'),
        ),

        // 5. Active Vehicles Card
        _buildKpiCard(
          title: 'Active Vehicles',
          value: '$assignedVehicles / $totalVehicles',
          subtitle: '${engine.vehicles.where((v) => v.status == 'running').length} Running • ${engine.vehicles.where((v) => v.status == 'idle').length} Idle',
          icon: LucideIcons.truck,
          color: AppTheme.primaryBlue,
          badgeText: 'Live Fleet',
          onTap: () => context.go('/live-tracking'),
        ),

        // 6. Drivers Active Card
        _buildKpiCard(
          title: 'Drivers Active',
          value: '$activeDrivers / $totalDrivers',
          subtitle: 'Click to view driver performance',
          icon: LucideIcons.user,
          color: AppTheme.primaryBlue,
          badgeText: 'Driver Roster',
          onTap: () => context.go('/drivers'),
        ),
      ],
    );
  }

  String _getPeriodDisplayTitle(String period) {
    switch (period) {
      case 'today':
        return 'Today';
      case 'week':
        return 'This Week';
      case 'month':
        return 'This Month';
      case 'last_month':
        return 'Last Month';
      case 'custom':
        return 'Custom Period';
      default:
        return 'Selected Period';
    }
  }

  Widget _buildKpiCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color color,
    required String badgeText,
    required VoidCallback onTap,
  }) {
    return Card(
      clipBehavior: Clip.antiAlias,
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Expanded(
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(5),
                          decoration: BoxDecoration(
                            color: color.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Icon(icon, color: color, size: 15),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            title,
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                            overflow: TextOverflow.ellipsis,
                            maxLines: 1,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      badgeText,
                      style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: color),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  value,
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color),
                ),
              ),
              const SizedBox(height: 2),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      subtitle,
                      style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const Icon(LucideIcons.chevronRight, size: 12, color: AppTheme.textSecondary),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showSavingsWalletDetails(BuildContext context, DataEngine engine) {
    final stats = engine.fleetStats;
    final verifiedRupees = stats?.verifiedSavingsRupees ?? engine.savings.toDouble();
    final fuelSavedL = stats?.fuelSavedLiters ?? engine.savingsLiters.toDouble();
    final co2 = stats?.co2AvoidedKg ?? (fuelSavedL * 2.68);
    final carbon = stats?.carbonReducedKg ?? (co2 * (12.0 / 44.0));
    final idleLossR = stats?.idleLossRupees ?? engine.idleRupees;
    final theftLossR = stats?.theftLossRupees ?? 0.0;
    final totalLossR = stats?.totalLossRupees ?? engine.loss;
    final totalLossL = stats?.totalLossLiters ?? engine.lossLiters.toDouble();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(LucideIcons.wallet, color: AppTheme.success, size: 22),
            SizedBox(width: 8),
            Text('Savings Wallet Breakdown', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          ],
        ),
        content: SizedBox(
          width: 480,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.success.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.success.withOpacity(0.2)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('1. Verified Savings (Realized)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.success)),
                      const SizedBox(height: 4),
                      Text('• Money Saved: ${_inr(verifiedRupees)}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      Text('• Fuel Saved: ${fuelSavedL.toStringAsFixed(1)} Litres', style: const TextStyle(fontSize: 12)),
                      Text('• CO₂ Avoided: ${co2.toStringAsFixed(2)} kg CO₂', style: const TextStyle(fontSize: 12)),
                      Text('• Carbon Reduced: ${carbon.toStringAsFixed(2)} kg C', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.success)),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.primaryBlue.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.primaryBlue.withOpacity(0.2)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('2. Prevented Loss (Mitigated Risk)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.primaryBlue)),
                      const SizedBox(height: 4),
                      Text('• Theft Loss Mitigated: ${_inr(theftLossR)}', style: const TextStyle(fontSize: 12)),
                      Text('• Idle Reduction Recovered: ${_inr(idleLossR * 0.5)}', style: const TextStyle(fontSize: 12)),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.warning.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppTheme.warning.withOpacity(0.2)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('3. Identified Fuel Waste (Opportunity)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.warning)),
                      const SizedBox(height: 4),
                      Text('• Total Fuel Loss Detected: ${_inr(totalLossR)} / ${totalLossL.toStringAsFixed(1)} L', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                      const SizedBox(height: 4),
                      const Text(
                        'Note: Identified waste is potential room for improvement through driver feedback and route efficiency. It is kept separate and NOT claimed as actual savings.',
                        style: TextStyle(fontSize: 11, color: AppTheme.textSecondary, fontStyle: FontStyle.italic),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.go('/savings-wallet');
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white),
            child: const Text('View Savings Wallet'),
          ),
        ],
      ),
    );
  }

  void _showFuelLossDetails(BuildContext context, DataEngine engine) {
    final stats = engine.fleetStats;
    final idleLossR = stats?.idleLossRupees ?? engine.idleRupees;
    final idleLossL = stats?.idleLossLiters ?? (idleLossR / 92.0);

    final speedingLossR = stats?.speedingLossRupees ?? 0.0;
    final speedingLossL = stats?.speedingLossLiters ?? 0.0;

    final theftLossR = stats?.theftLossRupees ?? 0.0;
    final theftLossL = stats?.theftLossLiters ?? 0.0;

    final totalLossR = stats?.totalLossRupees ?? engine.loss;
    final totalLossL = stats?.totalLossLiters ?? engine.lossLiters.toDouble();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(LucideIcons.trendingDown, color: AppTheme.danger, size: 22),
            SizedBox(width: 8),
            Text('Vehicle Fuel Loss Breakdown', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          ],
        ),
        content: SizedBox(
          width: 520,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.danger.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total Measured Fuel Loss', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.danger)),
                      Text('${_inr(totalLossR)} (${totalLossL.toStringAsFixed(1)} L)', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.danger)),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                const Text('Loss Causes Summary:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 8),
                _lossCauseRow('Excess Idling Loss', idleLossL, idleLossR, LucideIcons.clock, AppTheme.warning),
                _lossCauseRow('Overspeeding & Inefficiency', speedingLossL, speedingLossR, LucideIcons.gauge, AppTheme.warning),
                _lossCauseRow('Fuel Theft & Abnormal Drop', theftLossL, theftLossR, LucideIcons.alertTriangle, AppTheme.danger),
                const SizedBox(height: 14),
                const Text('Vehicle Breakdown:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                const SizedBox(height: 8),
                ...engine.vehicles.take(5).map((v) {
                  final vTrips = engine.trips.where((t) => t.vehicle == v.plate);
                  final vLossR = vTrips.fold(0.0, (s, t) => s + t.moneyWasted);
                  final vLossL = vTrips.fold(0.0, (s, t) => s + t.fuelWasted);
                  return Container(
                    margin: const EdgeInsets.only(bottom: 6),
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            const Icon(LucideIcons.truck, size: 14, color: AppTheme.primaryBlue),
                            const SizedBox(width: 8),
                            Text(v.plate, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                          ],
                        ),
                        Text(
                          '${_inr(vLossR)} (${vLossL.toStringAsFixed(1)} L)',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textPrimary),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Close'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              context.go('/fuel-loss');
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white),
            child: const Text('View Fuel Loss Page'),
          ),
        ],
      ),
    );
  }

  Widget _lossCauseRow(String title, double liters, double rupees, IconData icon, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Expanded(child: Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500))),
          Text('${liters.toStringAsFixed(1)} L  •  ${_inr(rupees)}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

class _ActiveAlertsPanel extends StatelessWidget {
  const _ActiveAlertsPanel();

  @override
  Widget build(BuildContext context) {
    final alerts = context.watch<DataEngine>().alerts;

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InkWell(
              onTap: () => context.go('/alerts'),
              child: const Row(
                children: [
                  Icon(LucideIcons.alertTriangle, color: AppTheme.danger, size: 16),
                  SizedBox(width: 8),
                  Text('Active Alerts', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  Spacer(),
                  Text('View All', style: TextStyle(fontSize: 12, color: AppTheme.primaryBlue, fontWeight: FontWeight.bold)),
                  Icon(LucideIcons.chevronRight, size: 14, color: AppTheme.primaryBlue),
                ],
              ),
            ),
            const SizedBox(height: 12),
            if (alerts.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Center(
                  child: Text('No active alerts for selected period', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                ),
              )
            else
              ...alerts.take(4).map((a) => Padding(
                padding: const EdgeInsets.only(bottom: 8.0),
                child: InkWell(
                  onTap: () => context.go('/alerts'),
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppTheme.background,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: (a.sev == 'danger' ? AppTheme.danger : AppTheme.warning).withOpacity(0.2)),
                    ),
                    child: Row(
                      children: [
                        Icon(a.sev == 'danger' ? LucideIcons.alertOctagon : LucideIcons.alertTriangle, color: a.sev == 'danger' ? AppTheme.danger : AppTheme.warning, size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(a.truck, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              Text(a.msg, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis),
                            ],
                          ),
                        ),
                        Text('${a.time} ago', style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary)),
                      ],
                    ),
                  ),
                ),
              )).toList(),
          ],
        ),
      ),
    );
  }
}

class _DriverLeaderboard extends StatefulWidget {
  const _DriverLeaderboard();

  @override
  State<_DriverLeaderboard> createState() => _DriverLeaderboardState();
}

class _DriverLeaderboardState extends State<_DriverLeaderboard> {
  bool _showBottomDrivers = false;

  @override
  Widget build(BuildContext context) {
    final drivers = context.watch<DataEngine>().drivers;
    final sortedDrivers = List<Driver>.from(drivers)..sort((a, b) => b.score.compareTo(a.score));

    final topDrivers = sortedDrivers.take(3).toList();
    final bottomDrivers = sortedDrivers.reversed.take(3).toList();

    final activeList = _showBottomDrivers ? bottomDrivers : topDrivers;

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  _showBottomDrivers ? LucideIcons.alertCircle : LucideIcons.award,
                  color: _showBottomDrivers ? AppTheme.warning : AppTheme.warning,
                  size: 16,
                ),
                const SizedBox(width: 8),
                Text(
                  _showBottomDrivers ? 'Bottom Drivers (Needs Attention)' : 'Top Performing Drivers',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                const Spacer(),
                InkWell(
                  onTap: () {
                    setState(() {
                      _showBottomDrivers = !_showBottomDrivers;
                    });
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppTheme.primaryBlue.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      _showBottomDrivers ? 'Show Top' : 'Show Bottom',
                      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.primaryBlue),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (activeList.isEmpty)
              const Text('No driver performance data available', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary))
            else
              ...activeList.map((d) {
                final rank = sortedDrivers.indexOf(d) + 1;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 6.0),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => DriverProfileScreen(driver: d))),
                      borderRadius: BorderRadius.circular(8),
                      child: Container(
                        padding: const EdgeInsets.all(8.0),
                        decoration: BoxDecoration(
                          color: AppTheme.background,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: [
                            Text('#$rank', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textSecondary, fontSize: 13)),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(d.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                  Text(
                                    '${d.mil > 0 ? '${d.mil.toStringAsFixed(1)} km/l' : 'Standard Efficiency'} • ${d.trips} trips',
                                    style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: (d.score >= 80 ? AppTheme.success : (d.score >= 60 ? AppTheme.warning : AppTheme.danger)).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                '${d.score}',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: d.score >= 80 ? AppTheme.success : (d.score >= 60 ? AppTheme.warning : AppTheme.danger),
                                  fontSize: 12,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            const SizedBox(height: 8),
            InkWell(
              onTap: () => context.go('/drivers'),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('View All Drivers & Details', style: TextStyle(fontSize: 12, color: AppTheme.primaryBlue, fontWeight: FontWeight.bold)),
                  SizedBox(width: 4),
                  Icon(LucideIcons.arrowRight, size: 14, color: AppTheme.primaryBlue),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CompliancePanel extends StatelessWidget {
  const _CompliancePanel();

  @override
  Widget build(BuildContext context) {
    final vehicles = context.watch<DataEngine>().vehicles;
    
    int expired = 0;
    int expiringSoon = 0;
    int valid = 0;

    final now = DateTime.now();
    final next7Days = now.add(const Duration(days: 7));

    for (var v in vehicles) {
      void check(String dateStr) {
        if (dateStr.isEmpty) return;
        try {
          final date = DateTime.parse(dateStr);
          if (date.isBefore(now)) {
            expired++;
          } else if (date.isBefore(next7Days)) {
            expiringSoon++;
          } else {
            valid++;
          }
        } catch (e) {
          // Ignore parse error
        }
      }
      check(v.insurance);
      check(v.permit);
      check(v.puc);
      check(v.nextService);
    }

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            InkWell(
              onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const ComplianceDetailsScreen(initialTab: 'Valid'))),
              child: const Row(
                children: [
                  Icon(LucideIcons.fileText, color: AppTheme.primaryBlue, size: 16),
                  SizedBox(width: 8),
                  Text('Compliance Overview', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  Spacer(),
                  Icon(LucideIcons.chevronRight, size: 14, color: AppTheme.textSecondary),
                ],
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _buildCompMetric(context, 'Expired', expired.toString(), AppTheme.danger),
                const SizedBox(width: 8),
                _buildCompMetric(context, 'Expiring', expiringSoon.toString(), AppTheme.warning),
                const SizedBox(width: 8),
                _buildCompMetric(context, 'Valid', valid.toString(), AppTheme.success),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCompMetric(BuildContext context, String label, String val, Color color) {
    return Expanded(
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => ComplianceDetailsScreen(initialTab: label))),
          borderRadius: BorderRadius.circular(8),
          child: Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(color: color.withOpacity(0.05), borderRadius: BorderRadius.circular(8), border: Border.all(color: color.withOpacity(0.1))),
            child: Column(
              children: [
                Text(val, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
                Text(label, style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _LiveFleetCard extends StatelessWidget {
  const _LiveFleetCard();

  @override
  Widget build(BuildContext context) {
    final engine = context.watch<DataEngine>();
    final vehicles = engine.vehicles;
    final speedLimit = engine.effectiveSpeedThreshold;

    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                const Icon(LucideIcons.truck, color: AppTheme.primaryBlue, size: 16),
                const SizedBox(width: 8),
                const Text('Live Vehicle Status', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                const Spacer(),
                const Text('● Real-time', style: TextStyle(color: AppTheme.success, fontSize: 12, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              showCheckboxColumn: false,
              headingTextStyle: const TextStyle(color: AppTheme.textSecondary, fontSize: 12, fontWeight: FontWeight.bold),
              dataTextStyle: const TextStyle(color: AppTheme.textPrimary, fontSize: 13),
              columns: const [
                DataColumn(label: Text('Reg. Plate')),
                DataColumn(label: Text('Location')),
                DataColumn(label: Text('Status')),
                DataColumn(label: Text('Speed')),
                DataColumn(label: Text('Fuel Present %')),
              ],
              rows: vehicles.map((v) {
                return DataRow(
                  onSelectChanged: (_) {
                    final engine = Provider.of<DataEngine>(context, listen: false);
                    engine.highlightVehicle(v.plate);
                    context.go('/vehicles');
                  },
                  cells: [
                    DataCell(
                      InkWell(
                        onTap: () {
                          final engine = Provider.of<DataEngine>(context, listen: false);
                          engine.highlightVehicle(v.plate);
                          context.go('/vehicles');
                        },
                        child: Text(
                          v.plate,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            color: AppTheme.primaryBlue,
                            decoration: TextDecoration.underline,
                          ),
                        ),
                      ),
                    ),
                    DataCell(Text(v.lat != 0.0 && v.lng != 0.0 ? '${v.lat.toStringAsFixed(4)}, ${v.lng.toStringAsFixed(4)}' : (v.loc.isNotEmpty ? v.loc : '—'))),
                    DataCell(Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: v.status == 'running' ? AppTheme.success.withOpacity(0.1) : AppTheme.warning.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        v.status.toUpperCase(),
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: v.status == 'running' ? AppTheme.success : AppTheme.warning,
                        ),
                      ),
                    )),
                    DataCell(Text('${v.speed} km/h', style: TextStyle(color: v.speed > speedLimit ? AppTheme.danger : AppTheme.textPrimary))),
                    DataCell(Text('${v.fuel}%')),
                  ],
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}
