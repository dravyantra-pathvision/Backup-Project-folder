import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:share_plus/share_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'dart:io';
import '../models/engine.dart';
import '../core/theme.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  String _dateRange = 'Last 30 Days';
  bool _isExporting = false;

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 5,
      child: Consumer<DataEngine>(
        builder: (ctx, engine, _) {
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildHeader(engine),
                const SizedBox(height: 16),
                _buildKpis(engine),
                const SizedBox(height: 16),
                _buildTabBar(),
                const SizedBox(height: 16),
                SizedBox(
                  height: 600,
                  child: _buildTabBarView(engine),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildHeader(DataEngine engine) {
    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 16,
      runSpacing: 16,
      children: [
        const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Fleet Analytics', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            Text('Performance insights, cost analysis, and trends', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          ],
        ),
        Wrap(
          spacing: 8,
          children: [
            OutlinedButton.icon(
              onPressed: () async {
                final range = await showDialog<String>(
                  context: context,
                  builder: (ctx) => SimpleDialog(
                    title: const Text('Select Date Range'),
                    children: ['Last 7 Days', 'Last 30 Days', 'Last 90 Days', 'This Year']
                        .map((r) => SimpleDialogOption(child: Text(r), onPressed: () => Navigator.pop(ctx, r)))
                        .toList(),
                  ),
                );
                if (range != null) setState(() => _dateRange = range);
              },
              icon: const Icon(LucideIcons.calendar, size: 14),
              label: Text(_dateRange),
            ),
            _isExporting
                ? const SizedBox(width: 36, height: 36, child: CircularProgressIndicator(strokeWidth: 2))
                : OutlinedButton.icon(
                    onPressed: () => _exportPdf(engine),
                    icon: const Icon(LucideIcons.download, size: 14),
                    label: const Text('Export PDF'),
                  ),
          ],
        ),
      ],
    );
  }

  Future<void> _exportPdf(DataEngine engine) async {
    setState(() => _isExporting = true);
    try {
      final pdf = pw.Document();
      final now = DateTime.now();
      final dateStr = '${now.day}/${now.month}/${now.year}';

      // Compute analytics
      final completedTrips = engine.trips.where((t) {
        if (t.tripCompleted != true) return false;
        try {
          final tripDate = DateTime.parse(t.date);
          if (_dateRange == 'This Year') {
            return tripDate.year == now.year;
          } else {
            int days = 30;
            if (_dateRange == 'Last 7 Days') days = 7;
            else if (_dateRange == 'Last 90 Days') days = 90;
            return now.difference(tripDate).inDays <= days;
          }
        } catch (_) {
          return true; // Fallback for trips without valid date
        }
      }).toList();
      final totalKm = completedTrips.fold(0.0, (s, t) => s + t.distance);
      final totalFuel = completedTrips.fold(0.0, (s, t) => s + t.fuelUsed);
      final avgMileage = totalFuel > 0 ? totalKm / totalFuel : 0.0;
      final totalIdleHrs = completedTrips.fold(0, (s, t) => s + t.idleDuration) / 3600.0;
      final totalFuelCost = engine.spend.toDouble();

      pdf.addPage(pw.MultiPage(
        pageFormat: PdfPageFormat.a4,
        header: (context) => pw.Text('DravYantra Fleet Analytics — $dateStr',
            style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 18)),
        build: (context) => [
          pw.SizedBox(height: 16),
          pw.Text('Summary KPIs', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 14)),
          pw.SizedBox(height: 8),
          pw.Table.fromTextArray(
            headers: ['Metric', 'Value'],
            data: [
              ['Total Fleet Distance', '${totalKm.toStringAsFixed(0)} km'],
              ['Total Fuel Used', '${totalFuel.toStringAsFixed(0)} L'],
              ['Avg Fleet Mileage', '${avgMileage.toStringAsFixed(2)} km/L'],
              ['Total Idle Hours', '${totalIdleHrs.toStringAsFixed(1)} hrs'],
              ['Total Fuel Cost', '₹${totalFuelCost.toStringAsFixed(0)}'],
              ['Active Vehicles', '${engine.vehicles.where((v) => v.status == "Running").length}'],
              ['Total Drivers', '${engine.drivers.length}'],
            ],
          ),
          pw.SizedBox(height: 24),
          pw.Text('Top Trips by Distance', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 14)),
          pw.SizedBox(height: 8),
          pw.Table.fromTextArray(
            headers: ['Vehicle', 'Driver', 'Route', 'Distance', 'Fuel Used', 'Status'],
            data: completedTrips.take(20).map((t) => [
              t.vehicle, t.driver,
              '${t.from} → ${t.to}',
              '${t.distance.toStringAsFixed(0)} km',
              '${t.fuelUsed.toStringAsFixed(1)} L',
              t.status,
            ]).toList(),
          ),
        ],
      ));

      final bytes = await pdf.save();
      final dir = await getTemporaryDirectory();
      final safeDateStr = dateStr.replaceAll('/', '-');
      final file = File('${dir.path}/fleet_analytics_$safeDateStr.pdf');
      await file.writeAsBytes(bytes);

      await Share.shareXFiles([XFile(file.path)], text: 'DravYantra Fleet Analytics Report');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Export failed: $e'), backgroundColor: AppTheme.danger));
      }
    } finally {
      if (mounted) setState(() => _isExporting = false);
    }
  }

  Widget _buildKpis(DataEngine engine) {
    final completedTrips = engine.trips.where((t) => t.tripCompleted == true).toList();
    final totalKm = completedTrips.fold(0.0, (s, t) => s + t.distance);
    final totalFuel = completedTrips.fold(0.0, (s, t) => s + t.fuelUsed);
    final avgMileage = totalFuel > 0 ? (totalKm / totalFuel) : engine.avgMil;
    final totalIdleMins = completedTrips.fold(0, (s, t) => s + t.idleDuration) / 60.0;
    final totalIdlePct = completedTrips.isNotEmpty
        ? (totalIdleMins / (completedTrips.length * 480) * 100).clamp(0, 100)
        : engine.idle;
    final totalFuelCostK = (engine.spend / 100000.0);

    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _kpiCard('Total Fleet km', _formatNum(totalKm.round()), '${completedTrips.length} completed trips', AppTheme.primaryBlue)),
            const SizedBox(width: 12),
            Expanded(child: _kpiCard('Fleet Avg km/L', avgMileage.toStringAsFixed(1), 'km per liter', AppTheme.success)),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: _kpiCard('Fleet Idle %', '${totalIdlePct.toStringAsFixed(1)}%', 'avg idling', AppTheme.warning)),
            const SizedBox(width: 12),
            Expanded(child: _kpiCard('Total Fuel Cost', '₹${totalFuelCostK.toStringAsFixed(1)}L', 'total spend', AppTheme.danger)),
          ],
        ),
      ],
    );
  }

  String _formatNum(int n) {
    if (n >= 100000) return '${(n / 100000).toStringAsFixed(1)}L';
    if (n >= 1000) return '${(n / 1000).toStringAsFixed(1)}K';
    return n.toString();
  }

  Widget _kpiCard(String title, String value, String subtitle, Color color) {
    return Container(
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
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color), overflow: TextOverflow.ellipsis),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
        ],
      ),
    );
  }

  Widget _buildTabBar() {
    return const TabBar(
      isScrollable: true,
      tabs: [
        Tab(text: 'Fuel'),
        Tab(text: 'Mileage'),
        Tab(text: 'Idle'),
        Tab(text: 'Driver'),
        Tab(text: 'Compliance'),
      ],
    );
  }

  Widget _buildTabBarView(DataEngine engine) {
    return TabBarView(
      children: [
        _buildFuelTab(engine),
        _buildMileageTab(engine),
        _buildIdleTab(engine),
        _buildDriverTab(engine),
        _buildComplianceTab(engine),
      ],
    );
  }

  // Build spots from real trip data grouped by month
  List<FlSpot> _buildMonthlySpots(DataEngine engine, double Function(Trip) getValue) {
    final now = DateTime.now();
    final Map<int, double> monthMap = {};
    for (final t in engine.trips) {
      try {
        final d = DateTime.tryParse(t.date);
        if (d == null) continue;
        final mIndex = (now.month - d.month + 12) % 12;
        if (mIndex > 4) continue;
        final slot = 4 - mIndex;
        monthMap[slot] = (monthMap[slot] ?? 0) + getValue(t);
      } catch (_) {}
    }
    if (monthMap.isEmpty) {
      return [const FlSpot(0, 0), const FlSpot(1, 0), const FlSpot(2, 0), const FlSpot(3, 0), const FlSpot(4, 0)];
    }
    return List.generate(5, (i) => FlSpot(i.toDouble(), monthMap[i] ?? 0));
  }

  List<String> _lastFiveMonthLabels() {
    final now = DateTime.now();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return List.generate(5, (i) {
      final m = (now.month - 4 + i - 1 + 12) % 12;
      return months[m];
    });
  }

  LineChart _buildLineChart(List<FlSpot> spots, Color color, List<String> labels) {
    return LineChart(
      LineChartData(
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            color: color,
            dotData: const FlDotData(show: true),
            belowBarData: BarAreaData(show: true, color: color.withOpacity(0.08)),
          ),
        ],
        titlesData: FlTitlesData(
          show: true,
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              getTitlesWidget: (value, meta) {
                final i = value.toInt();
                if (i >= 0 && i < labels.length) return Text(labels[i], style: const TextStyle(fontSize: 10));
                return const Text('');
              },
            ),
          ),
          leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
        ),
        gridData: const FlGridData(show: true),
        borderData: FlBorderData(show: false),
      ),
    );
  }

  Widget _buildFuelTab(DataEngine engine) {
    final labels = _lastFiveMonthLabels();
    final costSpots = _buildMonthlySpots(engine, (t) => t.fuelUsed * 100.0);
    // Top stations from fuel logs
    final stationMap = <String, double>{};
    for (final f in engine.fuelLogs) {
      stationMap[f.station] = (stationMap[f.station] ?? 0) + f.cost;
    }
    final topStations = stationMap.entries.toList()..sort((a, b) => b.value.compareTo(a.value));

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Fuel Cost Trend (Monthly)', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              SizedBox(height: 200, child: _buildLineChart(costSpots, AppTheme.primaryBlue, labels)),
              const SizedBox(height: 24),
              const Text('Top Station Spend', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              topStations.isEmpty
                  ? const Text('No fuel data yet', style: TextStyle(color: AppTheme.textSecondary))
                  : _buildDataTable(
                      ['Station', 'Spend'],
                      topStations.take(5).map((e) => [e.key, '₹${e.value.toStringAsFixed(0)}']).toList(),
                    ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMileageTab(DataEngine engine) {
    final labels = _lastFiveMonthLabels();
    final mileageSpots = _buildMonthlySpots(engine, (t) => t.currentMileage > 0 ? t.currentMileage : t.defaultMileage);
    final sortedByMileage = List<Trip>.from(engine.trips.where((t) => t.currentMileage > 0))
      ..sort((a, b) => b.currentMileage.compareTo(a.currentMileage));

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Fleet Mileage Trend (km/L)', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              SizedBox(height: 200, child: _buildLineChart(mileageSpots, AppTheme.success, labels)),
              const SizedBox(height: 24),
              const Text('Top Performing Vehicles', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              sortedByMileage.isEmpty
                  ? const Text('No mileage data yet', style: TextStyle(color: AppTheme.textSecondary))
                  : _buildDataTable(
                      ['Vehicle', 'Mileage'],
                      sortedByMileage.take(5).map((t) => [t.vehicle, '${t.currentMileage.toStringAsFixed(1)} km/L']).toList(),
                    ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildIdleTab(DataEngine engine) {
    final labels = _lastFiveMonthLabels();
    final idleSpots = _buildMonthlySpots(engine, (t) => t.idleDuration / 3600.0);
    final sortedByIdle = List<Trip>.from(engine.trips)..sort((a, b) => b.idleDuration.compareTo(a.idleDuration));

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Idle Hours Trend', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              SizedBox(height: 200, child: _buildLineChart(idleSpots, AppTheme.warning, labels)),
              const SizedBox(height: 24),
              const Text('Highest Idling Vehicles', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              sortedByIdle.isEmpty
                  ? const Text('No idle data yet', style: TextStyle(color: AppTheme.textSecondary))
                  : _buildDataTable(
                      ['Vehicle', 'Idle Hours'],
                      sortedByIdle.take(5).map((t) => [
                        t.vehicle,
                        '${(t.idleDuration / 3600).toStringAsFixed(1)} hrs',
                      ]).toList(),
                    ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDriverTab(DataEngine engine) {
    final sortedDrivers = List<Driver>.from(engine.drivers)..sort((a, b) => b.score.compareTo(a.score));

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Driver Performance Scores', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              sortedDrivers.isEmpty
                  ? const Text('No driver data yet', style: TextStyle(color: AppTheme.textSecondary))
                  : Column(
                      children: sortedDrivers.take(8).map((d) {
                        final scoreColor = d.score >= 80 ? AppTheme.success : d.score >= 60 ? AppTheme.warning : AppTheme.danger;
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Row(
                            children: [
                              CircleAvatar(
                                radius: 18,
                                backgroundColor: AppTheme.primaryBlue.withOpacity(0.1),
                                child: Text(d.name.isNotEmpty ? d.name[0] : '?', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.primaryBlue)),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(d.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                                    const SizedBox(height: 4),
                                    LinearProgressIndicator(
                                      value: d.score / 100.0,
                                      backgroundColor: Colors.grey.shade200,
                                      color: scoreColor,
                                      minHeight: 6,
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              Text('${d.score}', style: TextStyle(fontWeight: FontWeight.bold, color: scoreColor, fontSize: 15)),
                            ],
                          ),
                        );
                      }).toList(),
                    ),
              const SizedBox(height: 24),
              const Text('Driver Statistics', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              sortedDrivers.isEmpty
                  ? const SizedBox.shrink()
                  : _buildDataTable(
                      ['Driver', 'Score', 'Trips', 'Rating'],
                      sortedDrivers.take(6).map((d) => [
                        d.name, '${d.score}', '${d.trips}', '${d.rating.toStringAsFixed(1)}⭐',
                      ]).toList(),
                    ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildComplianceTab(DataEngine engine) {
    // Find vehicles with expiring docs in next 30 days
    final now = DateTime.now();
    final expiringDocs = <Map<String, String>>[];

    for (final v in engine.vehicles) {
      void checkDoc(String docName, String dateStr) {
        if (dateStr.isEmpty) return;
        try {
          // Parse date in format dd/MM/yyyy or yyyy-MM-dd
          DateTime? date;
          if (dateStr.contains('/')) {
            final parts = dateStr.split('/');
            date = DateTime(int.parse(parts[2]), int.parse(parts[1]), int.parse(parts[0]));
          } else {
            date = DateTime.tryParse(dateStr);
          }
          if (date == null) return;
          final diff = date.difference(now).inDays;
          if (diff <= 60) {
            expiringDocs.add({
              'vehicle': v.plate,
              'document': docName,
              'expiry': 'In $diff days',
              'urgent': diff <= 15 ? 'YES' : 'NO',
            });
          }
        } catch (_) {}
      }
      checkDoc('Insurance', v.insurance);
      checkDoc('PUC', v.puc);
      checkDoc('Permit', v.permit);
      checkDoc('Service Due', v.nextService);
    }

    // Driver license expiry
    for (final d in engine.drivers) {
      try {
        final parts = d.licExp.split('/');
        if (parts.length == 3) {
          final date = DateTime(int.parse(parts[2]), int.parse(parts[1]), int.parse(parts[0]));
          final diff = date.difference(now).inDays;
          if (diff <= 60) {
            expiringDocs.add({
              'vehicle': d.name,
              'document': 'Driving License',
              'expiry': 'In $diff days',
              'urgent': diff <= 15 ? 'YES' : 'NO',
            });
          }
        }
      } catch (_) {}
    }

    expiringDocs.sort((a, b) {
      final aNum = int.tryParse(a['expiry']?.replaceAll(RegExp(r'[^0-9]'), '') ?? '999') ?? 999;
      final bNum = int.tryParse(b['expiry']?.replaceAll(RegExp(r'[^0-9]'), '') ?? '999') ?? 999;
      return aNum.compareTo(bNum);
    });

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Text('Expiring Documents', style: TextStyle(fontWeight: FontWeight.bold)),
                  const Spacer(),
                  if (expiringDocs.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(color: AppTheme.danger.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                      child: Text('${expiringDocs.length} expiring', style: const TextStyle(color: AppTheme.danger, fontSize: 11, fontWeight: FontWeight.bold)),
                    ),
                ],
              ),
              const SizedBox(height: 16),
              expiringDocs.isEmpty
                  ? const Column(
                      children: [
                        Icon(LucideIcons.checkCircle, color: AppTheme.success, size: 40),
                        SizedBox(height: 8),
                        Text('All documents are up to date!', style: TextStyle(color: AppTheme.success, fontWeight: FontWeight.w600)),
                      ],
                    )
                  : _buildDataTable(
                      ['Vehicle/Driver', 'Document', 'Expiry', 'Urgent'],
                      expiringDocs.map((d) => [d['vehicle']!, d['document']!, d['expiry']!, d['urgent']!]).toList(),
                    ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDataTable(List<String> columns, List<List<String>> rows) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: DataTable(
        headingTextStyle: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textSecondary, fontSize: 12),
        dataTextStyle: const TextStyle(fontSize: 12),
        columnSpacing: 20,
        columns: columns.map((c) => DataColumn(label: Text(c))).toList(),
        rows: rows.map((r) => DataRow(cells: r.map((cell) => DataCell(Text(cell, overflow: TextOverflow.ellipsis))).toList())).toList(),
      ),
    );
  }
}
