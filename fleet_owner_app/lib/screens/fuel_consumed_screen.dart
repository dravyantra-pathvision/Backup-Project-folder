import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../models/engine.dart';
import '../core/theme.dart';

class FuelConsumedScreen extends StatefulWidget {
  const FuelConsumedScreen({super.key});

  @override
  State<FuelConsumedScreen> createState() => _FuelConsumedScreenState();
}

class _FuelConsumedScreenState extends State<FuelConsumedScreen> {
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

        // Vehicle-wise fuel consumption map from trips
        final vehicleFuelMap = <String, Map<String, double>>{};
        for (final t in engine.trips) {
          final vMil = engine.vehicles.where((v) => v.plate == t.vehicle).map((v) => v.mil).firstWhere((m) => m > 0, orElse: () => 4.0);
          final effectiveMil = vMil > 0 ? vMil : (t.defaultMileage > 0 ? t.defaultMileage : 4.0);
          final fuelUsed = t.fuelUsed > 0 ? t.fuelUsed : (t.distance > 0 ? t.distance / effectiveMil : 0.0);

          final curr = vehicleFuelMap[t.vehicle] ?? {'fuel': 0.0, 'dist': 0.0};
          vehicleFuelMap[t.vehicle] = {
            'fuel': curr['fuel']! + fuelUsed,
            'dist': curr['dist']! + t.distance,
          };
        }

        // Add registered vehicles if missing
        for (final v in engine.vehicles) {
          if (!vehicleFuelMap.containsKey(v.plate)) {
            vehicleFuelMap[v.plate] = {'fuel': 0.0, 'dist': 0.0};
          }
        }

        final double totalConsumedL = vehicleFuelMap.values.fold<double>(0.0, (sum, v) => sum + v['fuel']!);
        final double totalKm = vehicleFuelMap.values.fold<double>(0.0, (sum, v) => sum + v['dist']!);
        final double totalCostRs = stats?.fuelCostRupees ?? (totalConsumedL * engine.alertSettings.fuelPricePerLiter);
        final double avgEfficiency = totalConsumedL > 0 ? (totalKm / totalConsumedL) : 0.0;

        final vehicleFuelList = vehicleFuelMap.entries.toList()
          ..sort((a, b) => b.value['fuel']!.compareTo(a.value['fuel']!));

        return Scaffold(
          appBar: AppBar(
            title: const Text('Fuel Consumption Details'),
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
                _buildKpiGrid(totalConsumedL, totalCostRs, totalKm, avgEfficiency),
                const SizedBox(height: 24),
                const Text('Vehicle-wise Fuel Consumption Breakdown', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 8),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: vehicleFuelList.isEmpty
                        ? const Padding(
                            padding: EdgeInsets.all(24.0),
                            child: Center(child: Text('No vehicle fuel consumption recorded for the selected period.', style: TextStyle(color: AppTheme.textSecondary))),
                          )
                        : SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: DataTable(
                              headingTextStyle: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textSecondary, fontSize: 12),
                              dataTextStyle: const TextStyle(fontSize: 12),
                              columns: const [
                                DataColumn(label: Text('Vehicle')),
                                DataColumn(label: Text('Distance (km)')),
                                DataColumn(label: Text('Fuel Consumed (L)')),
                                DataColumn(label: Text('Fuel Efficiency (km/L)')),
                                DataColumn(label: Text('Est. Spend (₹)')),
                              ],
                              rows: vehicleFuelList.map((e) {
                                final fL = e.value['fuel']!;
                                final dKm = e.value['dist']!;
                                final eff = fL > 0 ? (dKm / fL) : 0.0;
                                final spend = fL * engine.alertSettings.fuelPricePerLiter;
                                return DataRow(cells: [
                                  DataCell(Text(e.key, style: const TextStyle(fontWeight: FontWeight.bold))),
                                  DataCell(Text('${dKm.toStringAsFixed(0)} km')),
                                  DataCell(Text('${fL.toStringAsFixed(1)} L', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primaryBlue))),
                                  DataCell(Text('${eff.toStringAsFixed(1)} km/L', style: TextStyle(color: eff >= 3.5 ? AppTheme.success : AppTheme.warning, fontWeight: FontWeight.bold))),
                                  DataCell(Text('₹${spend.toStringAsFixed(0)}')),
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
        Text('Vehicle-wise Fuel Consumption', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        SizedBox(height: 4),
        Text('Total fleet fuel usage, distance driven, and mileage efficiency per vehicle', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
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

  Widget _buildKpiGrid(double consumedL, double costRs, double distKm, double avgMileage) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _kpiCard('Total Fuel Consumed', '${consumedL.toStringAsFixed(1)} L', 'Volume consumed', AppTheme.primaryBlue, LucideIcons.fuel)),
            const SizedBox(width: 8),
            Expanded(child: _kpiCard('Total Fuel Spend', '₹${costRs.toStringAsFixed(0)}', 'Est fuel expenditure', AppTheme.danger, LucideIcons.dollarSign)),
          ],
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(child: _kpiCard('Total Distance', '${distKm.toStringAsFixed(0)} km', 'Distance covered', AppTheme.primaryBlue, LucideIcons.navigation)),
            const SizedBox(width: 8),
            Expanded(child: _kpiCard('Fleet Avg Efficiency', '${avgMileage.toStringAsFixed(1)} km/L', 'Distance per liter', AppTheme.success, LucideIcons.gauge)),
          ],
        ),
      ],
    );
  }

  Widget _kpiCard(String title, String value, String subtitle, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
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
              Icon(icon, size: 14, color: color),
              const SizedBox(width: 4),
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
          const SizedBox(height: 6),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(value, style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: color)),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
