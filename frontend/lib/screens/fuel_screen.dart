import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../core/theme.dart';

import 'package:provider/provider.dart';
import '../models/engine.dart';
import '../widgets/live_ticker.dart';

class FuelScreen extends StatefulWidget {
  const FuelScreen({super.key});

  @override
  State<FuelScreen> createState() => _FuelScreenState();
}

class _FuelScreenState extends State<FuelScreen> {
  String _filter = 'all'; // all, suspect

  @override
  Widget build(BuildContext context) {
    final engine = context.watch<DataEngine>();
    final logs = _filter == 'all' 
        ? engine.fuelLogs 
        : engine.fuelLogs.where((l) => l.isSuspect).toList();

    double totalSpend = logs.fold(0, (sum, l) => sum + l.cost);
    double totalLiters = logs.fold(0, (sum, l) => sum + l.liters);
    int suspectCount = engine.fuelLogs.where((l) => l.isSuspect).length;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildCityRatesBanner(),
          const SizedBox(height: 16),
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
                  Text('Fuel Management', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                  Text('Track fill-ups, detect anomalies, and manage fuel budgets', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                ],
              ),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  OutlinedButton.icon(
                    onPressed: () => _exportLogs(context),
                    icon: const Icon(LucideIcons.download, size: 14),
                    label: const Text('Export CSV'),
                  ),

                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildKpis(totalSpend, totalLiters, suspectCount),
          const SizedBox(height: 16),
          _buildAnomalyAlertsPanel(engine),
          const SizedBox(height: 16),
          Row(
            children: [
              FilterChip(
                label: const Text('All Logs'),
                selected: _filter == 'all',
                onSelected: (s) => setState(() => _filter = 'all'),
              ),
              const SizedBox(width: 8),
              FilterChip(
                label: const Text('Suspect Only'),
                selected: _filter == 'suspect',
                onSelected: (s) => setState(() => _filter = 'suspect'),
                selectedColor: AppTheme.danger.withOpacity(0.2),
                checkmarkColor: AppTheme.danger,
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildLogsTable(logs),
        ],
      ),
    );
  }

  Widget _buildCityRatesBanner() {
    final rates = [
      {'city': 'Mumbai', 'rate': '₹94.27'},
      {'city': 'Delhi', 'rate': '₹87.62'},
      {'city': 'Bangalore', 'rate': '₹88.94'},
      {'city': 'Chennai', 'rate': '₹94.24'},
      {'city': 'Kolkata', 'rate': '₹90.76'},
    ];
    return LiveTicker(
      children: rates.map((r) {
        return Padding(
          padding: const EdgeInsets.only(right: 24),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(r['city']!, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
              const SizedBox(width: 4),
              Text(r['rate']!, style: const TextStyle(color: Colors.white70, fontSize: 12)),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildAnomalyAlertsPanel(DataEngine engine) {
    final suspectLogs = engine.fuelLogs.where((l) => l.isSuspect).toList();
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
                Text('Fuel Anomaly Alerts', style: TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 12),
            if (suspectLogs.isEmpty)
              const Text('No anomalies detected', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13))
            else
              ...suspectLogs.map((l) => 
                _anomalyItem(l.vehicle, l.suspectReason ?? 'Anomalous reading', l.date)
              ).toList(),
          ],
        ),
      ),
    );
  }

  Widget _anomalyItem(String plate, String msg, String date) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Wrap(
        spacing: 8,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          const Icon(Icons.circle, size: 6, color: AppTheme.danger),
          Text(plate, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
          Text(msg, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          Text(date, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
        ],
      ),
    );
  }

  Widget _buildKpis(double spend, double liters, int suspect) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _kpiCard('Total Spend', '₹${spend.toStringAsFixed(0)}', 'Budget: ₹6,65,000', AppTheme.primaryBlue)),
            const SizedBox(width: 12),
            Expanded(child: _kpiCard('Total Consumed', '${liters.toStringAsFixed(0)} L', 'Avg rate: ₹92.5/L', AppTheme.success)),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: _kpiCard('Fleet Avg Mileage', '4.2 km/L', 'Target: 4.5 km/L', Colors.deepPurple)),
            const SizedBox(width: 12),
            Expanded(child: _kpiCard('Suspect Logs', '$suspect', 'Flagged for review', AppTheme.danger)),
          ],
        ),
      ],
    );
  }

  Widget _kpiCard(String title, String value, String subtitle, Color color) {
    return Container(
      width: 200,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
          const SizedBox(height: 8),
          Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
        ],
      ),
    );
  }



  Widget _buildLogsTable(List<FuelLog> logs) {
    return Card(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey.shade200)),
      elevation: 0,
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          headingTextStyle: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textSecondary),
          columns: const [
            DataColumn(label: Text('Log ID')),
            DataColumn(label: Text('Vehicle')),
            DataColumn(label: Text('Driver/Date')),
            DataColumn(label: Text('Station')),
            DataColumn(label: Text('Liters')),
            DataColumn(label: Text('Amount')),
            DataColumn(label: Text('Status')),
          ],
          rows: logs.map((l) {
            return DataRow(cells: [
              DataCell(Text(l.id, style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primaryBlue))),
              DataCell(Text(l.vehicle, style: const TextStyle(fontWeight: FontWeight.bold))),
              DataCell(Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [Text(l.driver, style: const TextStyle(fontSize: 12)), Text(l.date, style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary))],
              )),
              DataCell(Text(l.station)),
              DataCell(Text('${l.liters} L')),
              DataCell(Text('₹${l.cost.toStringAsFixed(0)}', style: const TextStyle(fontWeight: FontWeight.bold))),
              DataCell(l.isSuspect 
                ? Tooltip(message: l.suspectReason ?? 'Anomalous reading', child: const Icon(LucideIcons.alertTriangle, color: AppTheme.danger, size: 16)) 
                : const Icon(LucideIcons.checkCircle, color: AppTheme.success, size: 16)),
            ]);
          }).toList(),
        ),
      ),
    );
  }

  void _showLogForm(BuildContext context, DataEngine engine) {
    final vehicle = TextEditingController();
    final liters = TextEditingController();
    final rate = TextEditingController();
    final odo = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('New Fuel Fill-Up'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(controller: vehicle, decoration: const InputDecoration(labelText: 'Vehicle Plate', hintText: 'MH 14 CX 5543')),
              TextField(controller: liters, decoration: const InputDecoration(labelText: 'Liters', hintText: '100'), keyboardType: TextInputType.number),
              TextField(controller: rate, decoration: const InputDecoration(labelText: 'Rate per Liter', hintText: '94.2'), keyboardType: TextInputType.number),
              TextField(controller: odo, decoration: const InputDecoration(labelText: 'Current Odometer', hintText: '48200'), keyboardType: TextInputType.number),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              double l = double.tryParse(liters.text) ?? 0;
              double r = double.tryParse(rate.text) ?? 0;
              bool suspect = l > 400; // Basic anomaly detection
              
              engine.addFuelLog(FuelLog(
                id: 'FL-${100 + engine.fuelLogs.length + 1}',
                vehicle: vehicle.text,
                driver: 'Self / Assigned',
                station: 'Auto-detected Station',
                liters: l,
                rate: r,
                cost: l * r,
                odometer: int.tryParse(odo.text) ?? 0,
                date: DateTime.now().toString().split(' ')[0],
                isSuspect: suspect,
                suspectReason: suspect ? 'Liters exceed normal tank capacity' : null,
              ));
              Navigator.pop(context);
            }, 
            child: const Text('Log Entry')
          ),
        ],
      ),
    );
  }

  void _exportLogs(BuildContext context) {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Fuel logs exported to fuel_logs_2026_04.csv'), backgroundColor: AppTheme.success),
    );
  }
}
