import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../models/engine.dart';
import '../core/theme.dart';

class FuelLossScreen extends StatefulWidget {
  const FuelLossScreen({super.key});

  @override
  State<FuelLossScreen> createState() => _FuelLossScreenState();
}

class _FuelLossScreenState extends State<FuelLossScreen> {
  Future<void> _selectCustomDateRange(DataEngine engine) async {
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2023),
      lastDate: DateTime.now(),
      initialDateRange: engine.customPeriodStart != null && engine.customPeriodEnd != null
          ? DateTimeRange(start: engine.customPeriodStart!, end: engine.customPeriodEnd!)
          : DateTimeRange(start: DateTime.now().subtract(const Duration(days: 7)), end: DateTime.now()),
    );
    if (range != null) {
      await engine.setPeriod('custom', start: range.start, end: range.end);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<DataEngine>(
      builder: (ctx, engine, _) {
        final stats = engine.fleetStats;
        final price = (stats != null && stats.fuelConsumedL > 0) ? (stats.fuelCostRupees / stats.fuelConsumedL) : 96.0;
        final idleLossRs = stats?.idleLossRupees ?? 0.0;
        final idleLossL = stats?.idleLossLiters ?? (price > 0 ? (idleLossRs / price) : 0.0);

        final speedingLossRs = stats?.speedingLossRupees ?? 0.0;
        final speedingLossL = stats?.speedingLossLiters ?? (price > 0 ? (speedingLossRs / price) : 0.0);

        final theftLossRs = stats?.theftLossRupees ?? 0.0;
        final theftLossL = stats?.theftLossLiters ?? (price > 0 ? (theftLossRs / price) : 0.0);

        final totalLossRs = stats?.totalLossRupees ?? (idleLossRs + speedingLossRs + theftLossRs);
        final totalLossL = stats?.totalLossLiters ?? (idleLossL + speedingLossL + theftLossL);

        // Vehicle-wise breakdown calculated from trips
        final vehicleLossMap = <String, Map<String, double>>{};
        for (final t in engine.trips) {
          final idleRs = t.idleMoneyWasted;
          final idleL = price > 0 ? (t.idleMoneyWasted / price) : 0.0;

          final speedL = t.speedingFuelLoss;
          final speedRs = t.speedingMoneyLoss > 0 ? t.speedingMoneyLoss : (t.speedingFuelLoss * price);

          final theftL = t.theftFuelLoss;
          final theftRs = t.theftMoneyLoss > 0 ? t.theftMoneyLoss : (t.theftFuelLoss * price);

          final totalRs = idleRs + speedRs + theftRs;
          final totalL = idleL + speedL + theftL;

          if (totalRs > 0 || totalL > 0) {
            final curr = vehicleLossMap[t.vehicle] ?? {'idleRs': 0.0, 'idleL': 0.0, 'speedRs': 0.0, 'speedL': 0.0, 'theftRs': 0.0, 'theftL': 0.0, 'totalRs': 0.0, 'totalL': 0.0};
            vehicleLossMap[t.vehicle] = {
              'idleRs': curr['idleRs']! + idleRs,
              'idleL': curr['idleL']! + idleL,
              'speedRs': curr['speedRs']! + speedRs,
              'speedL': curr['speedL']! + speedL,
              'theftRs': curr['theftRs']! + theftRs,
              'theftL': curr['theftL']! + theftL,
              'totalRs': curr['totalRs']! + totalRs,
              'totalL': curr['totalL']! + totalL,
            };
          }
        }

        final vehicleLossList = vehicleLossMap.entries.toList()
          ..sort((a, b) => b.value['totalRs']!.compareTo(a.value['totalRs']!));

        return Scaffold(
          appBar: AppBar(
            title: const Text('Fuel Loss & Waste Audit'),
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeader(),
                const SizedBox(height: 16),
                _buildPeriodSelector(engine),
                const SizedBox(height: 16),
                _buildKpiGrid(idleLossL, idleLossRs, speedingLossL, speedingLossRs, theftLossL, theftLossRs, totalLossL, totalLossRs),
                const SizedBox(height: 24),
                const Text('Vehicle-wise Fuel Loss Breakdown', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 8),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: vehicleLossList.isEmpty
                        ? const Padding(
                            padding: EdgeInsets.all(24.0),
                            child: Center(child: Text('No vehicle fuel loss recorded for the selected period.', style: TextStyle(color: AppTheme.textSecondary))),
                          )
                        : SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: DataTable(
                              headingTextStyle: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textSecondary, fontSize: 12),
                              dataTextStyle: const TextStyle(fontSize: 12),
                              columns: const [
                                DataColumn(label: Text('Vehicle')),
                                DataColumn(label: Text('Idling Loss')),
                                DataColumn(label: Text('Speeding Loss')),
                                DataColumn(label: Text('Theft Loss')),
                                DataColumn(label: Text('Total Fuel Loss')),
                              ],
                              rows: vehicleLossList.map((e) {
                                final v = e.value;
                                return DataRow(cells: [
                                  DataCell(Text(e.key, style: const TextStyle(fontWeight: FontWeight.bold))),
                                  DataCell(Text('${v['idleL']!.toStringAsFixed(1)} L (₹${v['idleRs']!.toStringAsFixed(0)})', style: const TextStyle(color: AppTheme.warning))),
                                  DataCell(Text('${v['speedL']!.toStringAsFixed(1)} L (₹${v['speedRs']!.toStringAsFixed(0)})', style: const TextStyle(color: AppTheme.warning))),
                                  DataCell(Text('${v['theftL']!.toStringAsFixed(1)} L (₹${v['theftRs']!.toStringAsFixed(0)})', style: const TextStyle(color: AppTheme.danger, fontWeight: FontWeight.bold))),
                                  DataCell(Text('${v['totalL']!.toStringAsFixed(1)} L (₹${v['totalRs']!.toStringAsFixed(0)})', style: const TextStyle(color: AppTheme.danger, fontWeight: FontWeight.bold))),
                                ]);
                              }).toList(),
                            ),
                          ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildHeader() {
    return const Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Fuel Loss & Waste Cause Analysis', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        SizedBox(height: 4),
        Text('Detailed breakdown of fuel loss by cause (Idling, Overspeeding, and Fuel Theft)', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
      ],
    );
  }

  Widget _buildPeriodSelector(DataEngine engine) {
    final periods = [
      {'id': 'today', 'label': 'Today'},
      {'id': 'week', 'label': 'This Week'},
      {'id': 'month', 'label': 'This Month'},
      {'id': 'last_month', 'label': 'Last Month'},
      {'id': 'custom', 'label': 'Custom'},
    ];

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: periods.map((p) {
          final isSelected = engine.selectedPeriod == p['id'];
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(p['label']!),
              selected: isSelected,
              selectedColor: AppTheme.primaryBlue,
              labelStyle: TextStyle(
                color: isSelected ? Colors.white : AppTheme.textPrimary,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                fontSize: 12,
              ),
              onSelected: (selected) {
                if (selected) {
                  if (p['id'] == 'custom') {
                    _selectCustomDateRange(engine);
                  } else {
                    engine.setPeriod(p['id']!);
                  }
                }
              },
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildKpiGrid(double idleL, double idleRs, double speedL, double speedRs, double theftL, double theftRs, double totalL, double totalRs) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _kpiCard('Excess Idling Loss', '${idleL.toStringAsFixed(1)} L', '₹${idleRs.toStringAsFixed(0)} wasted', AppTheme.warning, LucideIcons.timer)),
            const SizedBox(width: 12),
            Expanded(child: _kpiCard('Overspeeding Loss', '${speedL.toStringAsFixed(1)} L', '₹${speedRs.toStringAsFixed(0)} wasted', AppTheme.warning, LucideIcons.gauge)),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: _kpiCard('Fuel Theft Loss', '${theftL.toStringAsFixed(1)} L', '₹${theftRs.toStringAsFixed(0)} loss', AppTheme.danger, LucideIcons.alertOctagon)),
            const SizedBox(width: 12),
            Expanded(child: _kpiCard('Total Fuel Loss', '${totalL.toStringAsFixed(1)} L', '₹${totalRs.toStringAsFixed(0)} total waste', AppTheme.danger, LucideIcons.alertTriangle)),
          ],
        ),
      ],
    );
  }

  Widget _kpiCard(String title, String value, String subtitle, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 15, color: color),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary, fontWeight: FontWeight.w600),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color), maxLines: 1, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 4),
          Text(subtitle, style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.bold), maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }
}
