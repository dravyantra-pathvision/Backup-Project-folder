import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../core/theme.dart';
import '../models/engine.dart';
import '../widgets/live_ticker.dart';
import 'trips_screen.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _LiveTicker(),
          const SizedBox(height: 16),
          _KpiGrid(),
          const SizedBox(height: 16),
          LayoutBuilder(
            builder: (context, constraints) {
              if (constraints.maxWidth > 1000) {
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(flex: 2, child: _FuelEfficiencyInsights()),
                    const SizedBox(width: 16),
                    Expanded(flex: 1, child: _ActiveAlertsPanel()),
                  ],
                );
              } else {
                return Column(
                  children: [
                    _FuelEfficiencyInsights(),
                    const SizedBox(height: 16),
                    _ActiveAlertsPanel(),
                  ],
                );
              }
            },
          ),
          const SizedBox(height: 16),
          LayoutBuilder(
            builder: (context, constraints) {
              if (constraints.maxWidth > 1000) {
                return Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: _CompliancePanel()),
                    const SizedBox(width: 16),
                    Expanded(child: _DriverLeaderboard()),
                  ],
                );
              } else {
                return Column(
                  children: [
                    _CompliancePanel(),
                    const SizedBox(height: 16),
                    _DriverLeaderboard(),
                  ],
                );
              }
            },
          ),
          const SizedBox(height: 16),
          _LiveFleetCard(),
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

class _KpiGrid extends StatelessWidget {
  const _KpiGrid();

  String _inr(num n) {
    final value = n is int ? n.toString() : n.toStringAsFixed(2).replaceFirst(RegExp(r'\.00$'), '');
    final parts = value.split('.');
    final formattedInt = parts[0].replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},');
    return parts.length > 1 ? '₹$formattedInt.${parts[1]}' : '₹$formattedInt';
  }

  String _moneyWithLiters(num money, int liters) {
    final moneyStr = _inr(money);
    final litersStr = '${liters.toString()} L';
    return '$moneyStr / $litersStr';
  }

  @override
  Widget build(BuildContext context) {
    final engine = context.watch<DataEngine>();
    
    // Use summary values fetched from backend summary endpoint (exact DB values)
    final int summaryFuelSpendRupees = engine.spend; // total fuel rupees
    final int summaryFuelUsedLiters = engine.spendLiters; // total fuel liters
    final double summaryMoneyWasted = engine.loss; // total money wasted
    final int summaryFuelWastedLiters = engine.lossLiters; // total fuel wasted liters
    final int summaryMoneySaved = engine.savings; // total money saved
    final int summaryFuelSavedLiters = engine.savingsLiters; // total fuel saved liters
    final int summaryFuelUsedLitersInt = summaryFuelUsedLiters;
    final int summaryFuelWastedLitersInt = summaryFuelWastedLiters;
    final double summaryFuelSpend = summaryFuelSpendRupees.toDouble();

    final totalVehicles = engine.vehicles.length;
    final assignedVehicles = engine.vehicles.where((v) => v.driver.isNotEmpty).length;
    final idleVehicles = engine.vehicles.where((v) => v.status == 'idle' && v.driver.isNotEmpty).length;
    final idleStr = assignedVehicles > 0 ? '$idleVehicles / $assignedVehicles' : '0 / 0';

    return GridView.count(
      crossAxisCount: MediaQuery.of(context).size.width > 1200 ? 4 : (MediaQuery.of(context).size.width > 800 ? 3 : 2),
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.5,
      children: [
        _buildKpiCard('Fuel Spend', _moneyWithLiters(summaryFuelSpend, summaryFuelUsedLitersInt), LucideIcons.fuel, AppTheme.primaryBlue, 'All trips'),
        _buildKpiCard('Fuel Loss', _moneyWithLiters(summaryMoneyWasted, summaryFuelWastedLitersInt), LucideIcons.fuel, AppTheme.danger, 'All trips'),
        _buildKpiCard('Savings Opp.', _moneyWithLiters(summaryMoneySaved, summaryFuelSavedLiters), LucideIcons.trendingUp, AppTheme.success, ''),
        _buildKpiCard('Active Vehicles', '$assignedVehicles / $totalVehicles', LucideIcons.truck, AppTheme.success, ''),
        _buildKpiCard('Drivers Active', '${engine.drivers.where((d) => d.vehicle.isNotEmpty).length} / ${engine.drivers.length}', LucideIcons.user, AppTheme.primaryBlue, ''),
        _buildKpiCard('Ideal Vehicles', idleStr, LucideIcons.clock, AppTheme.warning, ''),
      ],
    );
  }

  Widget _buildKpiCard(String title, String value, IconData icon, Color color, String subtitle) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12.0),
            child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(
              children: [
                Icon(icon, color: color, size: 16),
                const SizedBox(width: 6),
                Expanded(child: Text(title, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary), overflow: TextOverflow.ellipsis)),
              ],
            ),
            const SizedBox(height: 8),
            Center(child: Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary))),
            if (subtitle.isNotEmpty) Padding(
              padding: const EdgeInsets.only(top: 8.0),
              child: Text(subtitle, style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary)),
            ),
          ],
        ),
      ),
    );
  }
}

class _FuelEfficiencyInsights extends StatelessWidget {
  const _FuelEfficiencyInsights();

  String _inr(num n) {
    final value = n is int ? n.toString() : n.toStringAsFixed(2).replaceFirst(RegExp(r'\.00$'), '');
    final parts = value.split('.');
    final formattedInt = parts[0].replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},');
    return parts.length > 1 ? '₹$formattedInt.${parts[1]}' : '₹$formattedInt';
  }

  String _formatIdleDuration(int seconds) {
    final hours = seconds ~/ 3600;
    final minutes = (seconds % 3600) ~/ 60;
    if (hours > 0) {
      return '${hours}h ${minutes}m';
    }
    return '${minutes}m';
  }

  @override
  Widget build(BuildContext context) {
    final engine = context.watch<DataEngine>();
    
    // Use DB-sourced summary values instead of folding in-memory trips
    final double dbIdleWaste = engine.idleRupees; // rupees
    final int dbIdleSeconds = engine.idleSeconds; // seconds
    final double dbTotalLoss = engine.loss; // money wasted
    final double dbTotalSavings = engine.savings.toDouble(); // money saved
    final int dbTotalFuelUsed = engine.spendLiters; // liters
    final int dbTotalFuelWasted = engine.lossLiters; // liters

    final double lossPercentage = dbTotalFuelUsed > 0 ? (dbTotalFuelWasted / dbTotalFuelUsed) * 100 : 0.0;
    final int suspectCount = engine.fuelLogs.where((l) => l.isSuspect).length;
    final String idleTimeLabel = _formatIdleDuration(dbIdleSeconds);

    String formatRupees(num value) {
      final valueStr = value is int ? value.toString() : value.toStringAsFixed(2).replaceFirst(RegExp(r'\.00$'), '');
      final parts = valueStr.split('.');
      final formattedInt = parts[0].replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},');
      return parts.length > 1 ? '₹$formattedInt.${parts[1]}' : '₹$formattedInt';
    }
    final String idleWasteValue = formatRupees(dbIdleWaste);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(LucideIcons.fuel, color: AppTheme.primaryBlue, size: 18),
                SizedBox(width: 8),
                Text('Fuel Efficiency & Loss Insights', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: _insightTile(
                    engine,
                    'Idle Money Waste', 
                    idleWasteValue,
                    'From trips table (DB)',
                    AppTheme.primaryBlue,
                    LucideIcons.droplets,
                    showIdlePicker: true,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _insightTile(
                    engine,
                    'Potential Loss', 
                    _inr(dbTotalLoss), 
                    '${lossPercentage.toStringAsFixed(1)}% of total fuel', 
                    AppTheme.danger,
                    LucideIcons.trendingDown
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.success.withOpacity(0.05),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppTheme.success.withOpacity(0.1)),
              ),
              child: Row(
                children: [
                  const Icon(LucideIcons.lightbulb, color: AppTheme.success, size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Actionable Insight', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.textPrimary)),
                        Text(
                          'You can save up to ${_inr(dbTotalSavings)} this month by reducing idle time and optimizing routes.',
                          style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const Text('Flagged Anomalies', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textSecondary)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 12,
              runSpacing: 8,
              children: [
                _anomalyItem('$suspectCount Suspect Logs', LucideIcons.alertCircle, AppTheme.danger),
                _anomalyItem('2 Route Deviations', LucideIcons.mapPin, AppTheme.warning),
                _anomalyItem('15% High Idling', LucideIcons.clock, AppTheme.warning),
              ],
            ),
            const SizedBox(height: 12),
            const Text('Top Idle Waste (per trip)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textSecondary)),
            const SizedBox(height: 8),
            Builder(builder: (context) {
              final topTrips = engine.trips.where((t) => t.idleMoneyWasted > 0).toList();
              topTrips.sort((a, b) => b.idleMoneyWasted.compareTo(a.idleMoneyWasted));
              final items = topTrips.take(3).map((t) => Padding(
                    padding: const EdgeInsets.only(bottom: 6.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(child: Text('${t.vehicle} • ${t.id}', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600))),
                        Text(_inr(t.idleMoneyWasted), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  )).toList();
              if (items.isEmpty) return const Text('No idle waste recorded', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary));
              return Column(children: items);
            }),
          ],
        ),
      ),
    );
  }

  Widget _insightTile(DataEngine engine, String label, String value, String sub, Color color, IconData icon, {bool showIdlePicker = false}) {
    return Builder(builder: (ctx) {
      final idleTrips = engine.trips.where((t) => t.status == 'idle').toList();
      return Stack(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 18),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: color.withOpacity(0.08)),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 6, offset: const Offset(0,2))],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                // Title
                Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary, fontWeight: FontWeight.w600)),
                const SizedBox(height: 8),
                // Value (large, centered)
                Center(child: Text(value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color))),
                const SizedBox(height: 6),
                // Subtitle (smaller, muted)
                Text(sub, textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: AppTheme.textSecondary.withOpacity(0.9))),
              ],
            ),
          ),
          if (showIdlePicker)
            Positioned(
              left: 8,
              top: 8,
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: color.withOpacity(0.08)),
                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.03), blurRadius: 4, offset: const Offset(0,2))],
                ),
                child: PopupMenuButton<String>(
                  tooltip: 'Show idle trips',
                  padding: EdgeInsets.zero,
                  icon: Icon(LucideIcons.pin, size: 16, color: color.withOpacity(0.95)),
                  itemBuilder: (ctxInner) {
                    if (idleTrips.isEmpty) {
                      return [const PopupMenuItem<String>(value: '', child: Text('No idle trips'))];
                    }
                    return idleTrips.map((t) {
                      return PopupMenuItem<String>(
                        value: t.id,
                        child: Row(
                          children: [
                            Expanded(child: Text('${t.vehicle} • ${t.id}', overflow: TextOverflow.ellipsis)),
                            const SizedBox(width: 8),
                            Text('${t.idleFuelWasted.toStringAsFixed(2)} L', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      );
                    }).toList();
                  },
                  onSelected: (tripId) {
                    if (tripId == null || tripId.isEmpty) return;
                    engine.highlightTrip(tripId);
                    Navigator.push(
                      ctx,
                      MaterialPageRoute(builder: (context) => const TripsScreen()),
                    );
                  },
                ),
              ),
            ),
        ],
      );
    });
  }

  Widget _anomalyItem(String label, IconData icon, Color color) {
    return Row(
      children: [
        Icon(icon, color: color, size: 14),
        const SizedBox(width: 4),
        Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500)),
      ],
    );
  }
}

class _ActiveAlertsPanel extends StatelessWidget {
  const _ActiveAlertsPanel();

  @override
  Widget build(BuildContext context) {
    final alerts = context.watch<DataEngine>().alerts;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(LucideIcons.alertTriangle, color: AppTheme.danger, size: 16),
                SizedBox(width: 8),
                Text('Active Alerts', style: TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 12),
            ...alerts.take(4).map((a) => Padding(
              padding: const EdgeInsets.only(bottom: 8.0),
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
            )).toList(),
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

    List<Map<String, String>> upcoming = [];

    for (var v in vehicles) {
      void check(String dateStr, String type) {
        if (dateStr.isEmpty) return;
        try {
          final date = DateTime.parse(dateStr);
          if (date.isBefore(now)) {
            expired++;
          } else if (date.isBefore(next7Days)) {
            expiringSoon++;
            final diff = date.difference(now);
            String left = '';
            if (diff.inDays > 0) {
              left = '${diff.inDays} days left';
            } else {
              left = '${diff.inHours} hours left';
            }
            upcoming.add({
              'plate': v.plate,
              'type': type,
              'left': left,
            });
          } else {
            valid++;
          }
        } catch (e) {
          // Invalid date format
        }
      }
      check(v.insurance, 'Insurance');
      check(v.permit, 'Permit');
      check(v.puc, 'PUC');
      check(v.nextService, 'Service');
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(LucideIcons.fileText, color: AppTheme.primaryBlue, size: 16),
                SizedBox(width: 8),
                Text('Compliance Status', style: TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                _buildCompMetric('Expired', expired.toString(), AppTheme.danger),
                const SizedBox(width: 12),
                _buildCompMetric('Expiring Soon', expiringSoon.toString(), AppTheme.warning),
                const SizedBox(width: 12),
                _buildCompMetric('Valid', valid.toString(), AppTheme.success),
              ],
            ),
            const SizedBox(height: 16),
            const Text('Upcoming Expiries (Next 7 Days)', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textSecondary)),
            const SizedBox(height: 8),
            if (upcoming.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8.0),
                child: Text('No upcoming expiries', style: TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
              )
            else
              ...upcoming.map((item) => _buildCompItem(item['plate']!, item['type']!, item['left']!)).toList(),
          ],
        ),
      ),
    );
  }

  Widget _buildCompMetric(String label, String val, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: color.withOpacity(0.05), borderRadius: BorderRadius.circular(8), border: Border.all(color: color.withOpacity(0.1))),
        child: Column(
          children: [
            Text(val, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
            Text(label, style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary)),
          ],
        ),
      ),
    );
  }

  Widget _buildCompItem(String truck, String doc, String time) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text('$truck ($doc)', style: const TextStyle(fontSize: 12)),
          Text(time, style: const TextStyle(fontSize: 12, color: AppTheme.danger, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

class _DriverLeaderboard extends StatelessWidget {
  const _DriverLeaderboard();

  @override
  Widget build(BuildContext context) {
    final drivers = context.watch<DataEngine>().drivers;
    final sortedDrivers = List<Driver>.from(drivers)..sort((a, b) => b.score.compareTo(a.score));

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(LucideIcons.award, color: AppTheme.warning, size: 16),
                SizedBox(width: 8),
                Text('Top 3 Drivers', style: TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 12),
            ...sortedDrivers.take(3).map((d) {
              int rank = sortedDrivers.indexOf(d) + 1;
              return Padding(
                padding: const EdgeInsets.only(bottom: 8.0),
                child: Row(
                  children: [
                    Text('#$rank', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textSecondary, fontSize: 13)),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(d.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                          Text(d.status == 'on_duty' ? 'On Duty' : 'Idle', style: TextStyle(fontSize: 10, color: d.status == 'on_duty' ? AppTheme.success : AppTheme.textSecondary)),
                        ],
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(color: AppTheme.success.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                      child: Text('${d.score}', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.success, fontSize: 12)),
                    ),
                  ],
                ),
              );
            }).toList(),
          ],
        ),
      ),
    );
  }
}

class _LiveFleetCard extends StatelessWidget {
  const _LiveFleetCard();

  @override
  Widget build(BuildContext context) {
    final vehicles = context.watch<DataEngine>().vehicles;

    return Card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                const Icon(LucideIcons.truck, color: AppTheme.primaryBlue, size: 16),
                const SizedBox(width: 8),
                const Text('Live Vehicle Status', style: TextStyle(fontWeight: FontWeight.bold)),
                const Spacer(),
                const Text('● Real-time', style: TextStyle(color: AppTheme.success, fontSize: 12, fontWeight: FontWeight.bold)),
              ],
            ),
          ),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingTextStyle: const TextStyle(color: AppTheme.textSecondary, fontSize: 12, fontWeight: FontWeight.bold),
              dataTextStyle: const TextStyle(color: AppTheme.textPrimary, fontSize: 13),
              columns: const [
                DataColumn(label: Text('Reg. Plate')),
                DataColumn(label: Text('Location')),
                DataColumn(label: Text('Status')),
                DataColumn(label: Text('Speed')),
                DataColumn(label: Text('Fuel %')),
                DataColumn(label: Text('FASTag Balance')),
              ],
              rows: vehicles.map((v) {
                return DataRow(cells: [
                  DataCell(Text(v.plate, style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primaryBlue))),
                  DataCell(Text(v.loc)),
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
                  DataCell(Text('${v.speed} km/h', style: TextStyle(color: v.speed > 85 ? AppTheme.danger : AppTheme.textPrimary))),
                  DataCell(Text('${v.fuel}%')),
                  DataCell(v.isBlacklisted
                      ? Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: AppTheme.danger, borderRadius: BorderRadius.circular(4)),
                          child: const Text('BLACKLISTED', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                        )
                      : Text('₹${v.fastag}', style: TextStyle(fontWeight: FontWeight.bold, color: v.fastag < 500 ? AppTheme.danger : AppTheme.textPrimary))),
                ]);
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }
}
