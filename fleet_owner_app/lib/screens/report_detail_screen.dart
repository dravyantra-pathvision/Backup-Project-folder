import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:share_plus/share_plus.dart';
import 'package:printing/printing.dart';
import 'package:path_provider/path_provider.dart';
import '../models/engine.dart';
import '../core/theme.dart';
import '../utils/pdf_report_generator.dart';

class ReportDetailScreen extends StatefulWidget {
  final String reportType; // 'fleet_performance', 'fuel_savings', 'driver_performance', 'trip_activity', 'fuel_loss', 'carbon_impact'

  const ReportDetailScreen({super.key, required this.reportType});

  @override
  State<ReportDetailScreen> createState() => _ReportDetailScreenState();
}

class _ReportDetailScreenState extends State<ReportDetailScreen> {
  String _selectedVehicle = 'All Vehicles';
  String _selectedDriver = 'All Drivers';
  bool _isGeneratingPdf = false;

  @override
  Widget build(BuildContext context) {
    return Consumer<DataEngine>(
      builder: (ctx, engine, _) {
        final reportMeta = _getReportMetadata(widget.reportType);

        return Scaffold(
          appBar: AppBar(
            title: Text(reportMeta['title']!, overflow: TextOverflow.ellipsis),
            actions: [
              IconButton(
                icon: const Icon(LucideIcons.share2),
                tooltip: 'Share PDF Report',
                onPressed: _isGeneratingPdf ? null : () => _sharePdf(engine, reportMeta),
              ),
              IconButton(
                icon: const Icon(LucideIcons.download),
                tooltip: 'Download PDF Report',
                onPressed: _isGeneratingPdf ? null : () => _downloadPdf(engine, reportMeta),
              ),
            ],
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildReportHeader(reportMeta, engine),
                const SizedBox(height: 16),
                _buildControlsBar(engine),
                const SizedBox(height: 20),
                _buildSummaryKpis(widget.reportType, engine),
                const SizedBox(height: 20),
                _buildVisualizationSection(widget.reportType, engine),
                const SizedBox(height: 20),
                _buildImportantFindings(widget.reportType, engine),
                const SizedBox(height: 20),
                _buildDetailedTable(widget.reportType, engine),
              ],
            ),
          ),
        );
      },
    );
  }

  Map<String, String> _getReportMetadata(String type) {
    switch (type) {
      case 'fuel_savings':
        return {
          'title': 'Fuel & Savings Report',
          'desc': 'Audited financial savings: verified baseline fuel savings, prevented loss, and identified fuel waste.',
        };
      case 'driver_performance':
        return {
          'title': 'Driver Performance & Safety Report',
          'desc': 'Driver safety rankings, scores, overspeeding violations, idling duration, and attention alerts.',
        };
      case 'trip_activity':
        return {
          'title': 'Trip & Vehicle Activity Report',
          'desc': 'Detailed trip logs, vehicle usage, start/end locations, trip durations, and major in-transit alerts.',
        };
      case 'fuel_loss':
        return {
          'title': 'Fuel Loss / Theft Report',
          'desc': 'Abnormal fuel drops, idling waste, overspeeding fuel impact, and prevented vs unrecovered loss events.',
        };
      case 'carbon_impact':
        return {
          'title': 'Carbon Impact Report',
          'desc': 'ESG environmental summary: verified CO₂ avoided (kg CO₂) and Pure Carbon (C) reduced (kg C) baseline stats.',
        };
      case 'fleet_performance':
      default:
        return {
          'title': 'Fleet Performance Report',
          'desc': 'Complete operational overview: vehicle trips, distance, fuel efficiency, idling, and overspeeding metrics.',
        };
    }
  }

  Widget _buildReportHeader(Map<String, String> meta, DataEngine engine) {
    final company = engine.companyName;
    final nowStr = DateTime.now().toString().split('.')[0];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(meta['title']!, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
                    const SizedBox(height: 4),
                    Text(company, style: const TextStyle(fontSize: 12, color: AppTheme.primaryBlue, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: AppTheme.primaryBlue.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                child: Text(engine.selectedPeriod.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.primaryBlue)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(meta['desc']!, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary, height: 1.35)),
          const SizedBox(height: 8),
          Text('Generated: $nowStr', style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary)),
        ],
      ),
    );
  }

  Widget _buildControlsBar(DataEngine engine) {
    final periods = [
      {'id': 'today', 'label': 'Today'},
      {'id': 'week', 'label': 'This Week'},
      {'id': 'month', 'label': 'This Month'},
      {'id': 'last_month', 'label': 'Last Month'},
    ];

    final vehiclePlates = ['All Vehicles', ...engine.vehicles.map((v) => v.plate)];
    final driverNames = ['All Drivers', ...engine.drivers.map((d) => d.name)];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              ...periods.map((p) {
                final isSel = engine.selectedPeriod == p['id'];
                return Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    label: Text(p['label']!),
                    selected: isSel,
                    selectedColor: AppTheme.primaryBlue,
                    labelStyle: TextStyle(color: isSel ? Colors.white : AppTheme.textPrimary, fontSize: 11),
                    onSelected: (val) {
                      if (val) engine.setPeriod(p['id']!);
                    },
                  ),
                );
              }),
              OutlinedButton.icon(
                onPressed: () async {
                  final range = await showDateRangePicker(
                    context: context,
                    firstDate: DateTime(2023),
                    lastDate: DateTime.now(),
                  );
                  if (range != null) {
                    await engine.setPeriod('custom', start: range.start, end: range.end);
                  }
                },
                icon: const Icon(LucideIcons.calendar, size: 12),
                label: const Text('Custom', style: TextStyle(fontSize: 11)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Wrap(
          spacing: 12,
          runSpacing: 8,
          children: [
            DropdownButton<String>(
              value: _selectedVehicle,
              isDense: true,
              underline: const SizedBox(),
              items: vehiclePlates.map((v) => DropdownMenuItem(value: v, child: Text(v, style: const TextStyle(fontSize: 12)))).toList(),
              onChanged: (val) {
                if (val != null) setState(() => _selectedVehicle = val);
              },
            ),
            DropdownButton<String>(
              value: _selectedDriver,
              isDense: true,
              underline: const SizedBox(),
              items: driverNames.map((d) => DropdownMenuItem(value: d, child: Text(d, style: const TextStyle(fontSize: 12)))).toList(),
              onChanged: (val) {
                if (val != null) setState(() => _selectedDriver = val);
              },
            ),
            if (_selectedVehicle != 'All Vehicles' || _selectedDriver != 'All Drivers')
              TextButton.icon(
                onPressed: () {
                  setState(() {
                    _selectedVehicle = 'All Vehicles';
                    _selectedDriver = 'All Drivers';
                  });
                },
                icon: const Icon(LucideIcons.xCircle, size: 12, color: AppTheme.danger),
                label: const Text('Clear Filters', style: TextStyle(fontSize: 11, color: AppTheme.danger)),
              ),
          ],
        ),
      ],
    );
  }

  List<Trip> _getFilteredTrips(DataEngine engine) {
    return engine.trips.where((t) {
      final matchesVehicle = _selectedVehicle == 'All Vehicles' || t.vehicle == _selectedVehicle;
      final matchesDriver = _selectedDriver == 'All Drivers' || t.driver == _selectedDriver;
      return matchesVehicle && matchesDriver;
    }).toList();
  }

  List<Vehicle> _getFilteredVehicles(DataEngine engine) {
    return engine.vehicles.where((v) {
      final matchesVehicle = _selectedVehicle == 'All Vehicles' || v.plate == _selectedVehicle;
      final matchesDriver = _selectedDriver == 'All Drivers' || v.driver == _selectedDriver;
      return matchesVehicle && matchesDriver;
    }).toList();
  }

  List<Driver> _getFilteredDrivers(DataEngine engine) {
    return engine.drivers.where((d) {
      final matchesDriver = _selectedDriver == 'All Drivers' || d.name == _selectedDriver;
      final matchesVehicle = _selectedVehicle == 'All Vehicles' || d.vehicle == _selectedVehicle;
      return matchesDriver && matchesVehicle;
    }).toList();
  }

  // ---------------------------------------------------------------------------
  // KPI METRICS
  // ---------------------------------------------------------------------------
  Widget _buildSummaryKpis(String type, DataEngine engine) {
    final filteredVehicles = _getFilteredVehicles(engine);
    final filteredDrivers = _getFilteredDrivers(engine);
    final filteredTrips = _getFilteredTrips(engine);

    switch (type) {
      case 'fuel_savings':
        final sw = engine.savingsWalletData;
        final price = (engine.fleetStats != null && engine.fleetStats!.fuelConsumedL > 0) ? (engine.fleetStats!.fuelCostRupees / engine.fleetStats!.fuelConsumedL) : 96.0;
        final vRs = sw?.verifiedSavingsRupees ?? engine.savings.toDouble();
        final pRs = sw?.fuelLossPreventedRupees ?? 0.0;
        final wRs = sw?.identifiedWasteRupees ?? engine.fleetStats?.totalLossRupees ?? (engine.loss.toDouble() * price);
        final fuelL = sw?.verifiedSavingsLiters ?? engine.savingsLiters.toDouble();

        return _buildKpiGrid([
          _kpiBox('Verified Savings', '₹${vRs.toStringAsFixed(0)}', '${fuelL.toStringAsFixed(1)} L vs baseline', AppTheme.success),
          _kpiBox('Prevented Loss', '₹${pRs.toStringAsFixed(0)}', 'Intervened fuel theft', AppTheme.primaryBlue),
          _kpiBox('Identified Waste', '₹${wRs.toStringAsFixed(0)}', 'Potential room to save', AppTheme.warning),
        ]);

      case 'driver_performance':
        final totalDrivers = filteredDrivers.length;
        final avgScore = totalDrivers > 0 ? (filteredDrivers.fold<double>(0.0, (s, d) => s + d.score) / totalDrivers) : 0.0;
        final totalSpeeding = filteredTrips.fold<int>(0, (s, t) => s + (t.speedingFuelLoss > 0 ? 1 : 0));
        final reqAttention = filteredDrivers.where((d) => d.score < 70).length;

        return _buildKpiGrid([
          _kpiBox('Monitored Drivers', '$totalDrivers', 'Active drivers', AppTheme.primaryBlue),
          _kpiBox('Avg Safety Score', '${avgScore.toStringAsFixed(0)}/100', 'Fleet average', AppTheme.success),
          _kpiBox('Overspeed Evts', '$totalSpeeding', 'Total incidents', AppTheme.warning),
          _kpiBox('Requires Attention', '$reqAttention', 'Score < 70', AppTheme.danger),
        ]);

      case 'trip_activity':
        final totalTrips = filteredTrips.length;
        final totalDist = filteredTrips.fold<double>(0.0, (s, t) => s + t.distance);
        final activeV = filteredVehicles.where((v) => v.status.toLowerCase() == 'moving').length;
        final avgDist = totalTrips > 0 ? (totalDist / totalTrips) : 0.0;

        return _buildKpiGrid([
          _kpiBox('Total Trips', '$totalTrips', 'Completed trips', AppTheme.primaryBlue),
          _kpiBox('Total Distance', '${totalDist.toStringAsFixed(0)} km', 'Fleet odometer', AppTheme.success),
          _kpiBox('Active Moving', '$activeV vehicles', 'Currently on road', AppTheme.primaryBlue),
          _kpiBox('Avg Trip Dist', '${avgDist.toStringAsFixed(1)} km', 'Per trip average', AppTheme.warning),
        ]);

      case 'fuel_loss':
        final sw = engine.savingsWalletData;
        final price = (engine.fleetStats != null && engine.fleetStats!.fuelConsumedL > 0) ? (engine.fleetStats!.fuelCostRupees / engine.fleetStats!.fuelConsumedL) : 96.0;
        final totalLossRs = sw?.identifiedWasteRupees ?? engine.fleetStats?.totalLossRupees ?? (engine.loss.toDouble() * price);
        final totalLossL = sw?.identifiedWasteLiters ?? engine.loss.toDouble();
        final pRs = sw?.fuelLossPreventedRupees ?? 0.0;
        final pL = sw?.fuelLossPreventedLiters ?? 0.0;
        final theftEvts = sw?.theftEvents ?? 0;

        return _buildKpiGrid([
          _kpiBox('Identified Waste', '₹${totalLossRs.toStringAsFixed(0)}', '${totalLossL.toStringAsFixed(1)} L total waste', AppTheme.warning),
          _kpiBox('Prevented Loss', '₹${pRs.toStringAsFixed(0)}', '${pL.toStringAsFixed(1)} L prevented', AppTheme.primaryBlue),
          _kpiBox('Theft Drop Evts', '$theftEvts', 'Abnormal drops', AppTheme.danger),
        ]);

      case 'carbon_impact':
        final sw = engine.savingsWalletData;
        final fuelSavedL = sw?.verifiedSavingsLiters ?? engine.savingsLiters.toDouble();
        final co2Avoided = fuelSavedL * 2.68;
        final carbonReduced = co2Avoided * (12.0 / 44.0);

        return _buildKpiGrid([
          _kpiBox('Verified Fuel Saved', '${fuelSavedL.toStringAsFixed(1)} L', 'Baseline fuel reduction', AppTheme.success),
          _kpiBox('CO₂ Avoided', '${co2Avoided.toStringAsFixed(1)} kg CO₂', '2.68 kg CO₂ per Liter', AppTheme.primaryBlue),
          _kpiBox('Pure Carbon Reduced', '${carbonReduced.toStringAsFixed(1)} kg C', '12/44 molar fraction', const Color(0xFF27AE60)),
        ]);

      case 'fleet_performance':
      default:
        final totalV = filteredVehicles.length;
        final activeV = filteredVehicles.where((v) => v.status.toLowerCase() != 'stopped').length;
        final dist = filteredTrips.fold<double>(0.0, (s, t) => s + t.distance);
        final fuel = filteredTrips.fold<double>(0.0, (s, t) => s + t.fuelUsed);
        final avgMil = fuel > 0 ? (dist / fuel) : 4.0;

        return _buildKpiGrid([
          _kpiBox('Total Fleet Vehicles', '$totalV', '$activeV active on road', AppTheme.primaryBlue),
          _kpiBox('Distance Covered', '${dist.toStringAsFixed(0)} km', 'Total fleet distance', AppTheme.success),
          _kpiBox('Fuel Consumed', '${fuel.toStringAsFixed(0)} L', 'Total litres used', AppTheme.warning),
          _kpiBox('Fleet Efficiency', '${avgMil.toStringAsFixed(1)} km/L', 'Average mileage', AppTheme.primaryBlue),
        ]);
    }
  }

  Widget _buildKpiGrid(List<Widget> cards) {
    if (cards.length == 4) {
      return Column(
        children: [
          Row(children: [Expanded(child: cards[0]), const SizedBox(width: 8), Expanded(child: cards[1])]),
          const SizedBox(height: 8),
          Row(children: [Expanded(child: cards[2]), const SizedBox(width: 8), Expanded(child: cards[3])]),
        ],
      );
    }
    if (cards.length == 3) {
      return Column(
        children: [
          Row(children: [Expanded(child: cards[0]), const SizedBox(width: 8), Expanded(child: cards[1])]),
          const SizedBox(height: 8),
          SizedBox(width: double.infinity, child: cards[2]),
        ],
      );
    }
    return Row(
      children: cards.map((c) => Expanded(child: Padding(padding: const EdgeInsets.only(right: 6), child: c))).toList(),
    );
  }

  Widget _kpiBox(String title, String val, String sub, Color color) {
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
          Text(title, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 6),
          Text(val, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color), maxLines: 1, overflow: TextOverflow.ellipsis),
          const SizedBox(height: 2),
          Text(sub, style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary), maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // VISUALIZATION CHART
  // ---------------------------------------------------------------------------
  Widget _buildVisualizationSection(String type, DataEngine engine) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_getChartTitle(type), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 16),
            SizedBox(
              height: 180,
              child: _buildChart(type, engine),
            ),
          ],
        ),
      ),
    );
  }

  String _getChartTitle(String type) {
    switch (type) {
      case 'fuel_savings': return 'Baseline vs Current Efficiency Comparison (km/L)';
      case 'driver_performance': return 'Top Driver Safety Scores';
      case 'trip_activity': return 'Distance Covered Per Trip (km)';
      case 'fuel_loss': return 'Identified Waste Breakdown (Litres)';
      case 'carbon_impact': return 'CO₂ Avoided Contribution By Vehicle (kg CO₂)';
      case 'fleet_performance':
      default: return 'Fleet Distance Covered Trend';
    }
  }

  Widget _buildChart(String type, DataEngine engine) {
    final filteredTrips = _getFilteredTrips(engine);
    final trips = filteredTrips.take(6).toList();
    if (trips.isEmpty) {
      return const Center(child: Text('No trip chart data available for period/filter', style: TextStyle(color: AppTheme.textSecondary)));
    }

    final spots = List.generate(trips.length, (i) => FlSpot(i.toDouble(), trips[i].distance));

    return LineChart(
      LineChartData(
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            color: AppTheme.primaryBlue,
            dotData: const FlDotData(show: true),
            belowBarData: BarAreaData(show: true, color: AppTheme.primaryBlue.withOpacity(0.08)),
          ),
        ],
        titlesData: FlTitlesData(
          topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 38,
              getTitlesWidget: (value, meta) {
                if (value == meta.min || value == meta.max) return const SizedBox.shrink();
                String text = value >= 1000 ? '${(value / 1000).toStringAsFixed(1)}K' : value.toStringAsFixed(0);
                return Text(text, style: const TextStyle(fontSize: 9, color: AppTheme.textSecondary));
              },
            ),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 22,
              getTitlesWidget: (value, meta) {
                final i = value.toInt();
                if (i >= 0 && i < trips.length) return Text('T${i + 1}', style: const TextStyle(fontSize: 10));
                return const Text('');
              },
            ),
          ),
        ),
        gridData: const FlGridData(show: true),
        borderData: FlBorderData(show: false),
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // IMPORTANT FINDINGS (DYNAMIC CALCULATED INSIGHTS)
  // ---------------------------------------------------------------------------
  Widget _buildImportantFindings(String type, DataEngine engine) {
    final findings = _generateFindings(type, engine);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppTheme.primaryBlue.withOpacity(0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppTheme.primaryBlue.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(LucideIcons.lightbulb, color: AppTheme.primaryBlue, size: 16),
              SizedBox(width: 6),
              Text('Calculated Operational Findings', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppTheme.primaryBlue)),
            ],
          ),
          const SizedBox(height: 8),
          ...findings.map((f) => Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('• ', style: TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primaryBlue)),
                    Expanded(child: Text(f, style: const TextStyle(fontSize: 12, color: AppTheme.textPrimary))),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  List<String> _generateFindings(String type, DataEngine engine) {
    final list = <String>[];
    final sw = engine.savingsWalletData;
    final filteredDrivers = _getFilteredDrivers(engine);
    final filteredTrips = _getFilteredTrips(engine);
    final filteredVehicles = _getFilteredVehicles(engine);

    switch (type) {
      case 'fuel_savings':
        final price = (engine.fleetStats != null && engine.fleetStats!.fuelConsumedL > 0) ? (engine.fleetStats!.fuelCostRupees / engine.fleetStats!.fuelConsumedL) : 96.0;
        final vRs = sw?.verifiedSavingsRupees ?? engine.savings.toDouble();
        final pRs = sw?.fuelLossPreventedRupees ?? 0.0;
        final wRs = sw?.identifiedWasteRupees ?? engine.fleetStats?.totalLossRupees ?? (engine.loss.toDouble() * price);
        list.add('DravYantra generated ₹${vRs.toStringAsFixed(0)} in verified fuel savings compared against completed vehicle baselines.');
        list.add('Intervened security protocols prevented ₹${pRs.toStringAsFixed(0)} in abnormal fuel drops and theft attempts.');
        list.add('Identified driver waste totals ₹${wRs.toStringAsFixed(0)} across idling and speeding, representing potential room for further savings.');
        break;

      case 'driver_performance':
        final lowScoreDrivers = filteredDrivers.where((d) => d.score < 70).toList();
        if (lowScoreDrivers.isNotEmpty) {
          list.add('${lowScoreDrivers.length} driver(s) (${lowScoreDrivers.map((d) => d.name).join(', ')}) scored below 70 and require immediate safety intervention.');
        } else {
          list.add('All monitored fleet drivers maintained safe driving scores above the 70 threshold.');
        }
        final topDriver = filteredDrivers.isNotEmpty ? (List<Driver>.from(filteredDrivers)..sort((a, b) => b.score.compareTo(a.score))).first : null;
        if (topDriver != null) {
          list.add('Driver ${topDriver.name} recorded the highest safety score of ${topDriver.score}/100.');
        }
        break;

      case 'trip_activity':
        final totalDist = filteredTrips.fold<double>(0.0, (s, t) => s + t.distance);
        list.add('Fleet completed ${filteredTrips.length} trips covering a total distance of ${totalDist.toStringAsFixed(0)} km.');
        final maxTrip = filteredTrips.isNotEmpty ? (List<Trip>.from(filteredTrips)..sort((a, b) => b.distance.compareTo(a.distance))).first : null;
        if (maxTrip != null) {
          list.add('Longest trip was performed by Vehicle ${maxTrip.vehicle} covering ${maxTrip.distance.toStringAsFixed(1)} km.');
        }
        break;

      case 'fuel_loss':
        final idleL = sw?.idleWasteLiters ?? (engine.idleRupees / 95.0);
        list.add('Excess vehicle idling accounted for ${idleL.toStringAsFixed(1)} Litres of identified fuel waste.');
        final pRs = sw?.fuelLossPreventedRupees ?? 0.0;
        list.add('Confirmed prevention actions successfully protected ₹${pRs.toStringAsFixed(0)} from abnormal fuel drops.');
        break;

      case 'carbon_impact':
        final fuelSavedL = sw?.verifiedSavingsLiters ?? engine.savingsLiters.toDouble();
        final co2Avoided = fuelSavedL * 2.68;
        final carbonReduced = co2Avoided * (12.0 / 44.0);
        list.add('Verified baseline fuel savings of ${fuelSavedL.toStringAsFixed(1)} Litres directly prevented ${co2Avoided.toStringAsFixed(1)} kg CO₂ emissions.');
        list.add('Pure Carbon (C) elemental reduction achieved: ${carbonReduced.toStringAsFixed(1)} kg C based on stoichiometric stoichiometry (12/44 fraction).');
        break;

      case 'fleet_performance':
      default:
        final totalV = filteredVehicles.length;
        final dist = filteredTrips.fold<double>(0.0, (s, t) => s + t.distance);
        final fuel = filteredTrips.fold<double>(0.0, (s, t) => s + t.fuelUsed);
        final avgMil = fuel > 0 ? (dist / fuel) : 4.0;
        list.add('Fleet operating efficiency averaged ${avgMil.toStringAsFixed(1)} km/L across $totalV vehicles.');
        list.add('Total operational distance completed: ${dist.toStringAsFixed(0)} km with ${fuel.toStringAsFixed(0)} Litres of fuel consumed.');
        break;
    }

    return list;
  }

  // ---------------------------------------------------------------------------
  // DETAILED TABLE
  // ---------------------------------------------------------------------------
  Widget _buildDetailedTable(String type, DataEngine engine) {
    final headers = _getTableHeaders(type);
    final rows = _getTableRows(type, engine);

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Detailed Report Ledger', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            const SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: DataTable(
                headingTextStyle: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textSecondary, fontSize: 12),
                dataTextStyle: const TextStyle(fontSize: 12),
                columns: headers.map((h) => DataColumn(label: Text(h))).toList(),
                rows: rows.map((r) => DataRow(cells: r.map((c) => DataCell(Text(c))).toList())).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<String> _getTableHeaders(String type) {
    switch (type) {
      case 'fuel_savings':
        return ['Vehicle', 'Baseline Status', 'Baseline km/L', 'Current km/L', 'Distance', 'Fuel Used', 'Verified Savings (₹)', 'Prevented Loss (₹)', 'Identified Waste (₹)'];
      case 'driver_performance':
        return ['Driver Name', 'Vehicle', 'Score', 'Distance', 'Trips', 'Avg Mileage', 'Idling (min)', 'Speeding Evts', 'Status'];
      case 'trip_activity':
        return ['Trip ID', 'Vehicle', 'Driver', 'Start Loc', 'End Loc', 'Distance', 'Duration (min)', 'Fuel Used', 'Mileage'];
      case 'fuel_loss':
        return ['Vehicle', 'Idling Waste (₹)', 'Speeding Waste (₹)', 'Theft Loss (₹)', 'Total Waste (₹)', 'Prevented Loss (₹)'];
      case 'carbon_impact':
        return ['Vehicle', 'Verified Saved (L)', 'CO₂ Avoided (kg CO₂)', 'Carbon Reduced (kg C)'];
      case 'fleet_performance':
      default:
        return ['Vehicle', 'Trips', 'Distance (km)', 'Fuel Used (L)', 'Efficiency (km/L)', 'Idling (min)', 'Overspeed Evts'];
    }
  }

  List<List<String>> _getTableRows(String type, DataEngine engine) {
    final sw = engine.savingsWalletData;
    final filteredVehicles = _getFilteredVehicles(engine);
    final filteredDrivers = _getFilteredDrivers(engine);
    final filteredTrips = _getFilteredTrips(engine);

    switch (type) {
      case 'fuel_savings':
        if (sw != null && sw.vehicleBreakdown.isNotEmpty) {
          final items = sw.vehicleBreakdown.where((item) =>
            (_selectedVehicle == 'All Vehicles' || item.registrationNumber == _selectedVehicle)
          ).toList();
          return items.map((item) => [
                item.registrationNumber,
                item.baselineStatus.toUpperCase(),
                '${item.baselineEfficiency.toStringAsFixed(1)} km/L',
                '${item.currentEfficiency.toStringAsFixed(1)} km/L',
                '${item.distance.toStringAsFixed(0)} km',
                '${item.fuelConsumed.toStringAsFixed(1)} L',
                '₹${item.fuelSavedRupees.toStringAsFixed(0)}',
                '₹${item.fuelLossPreventedRupees.toStringAsFixed(0)}',
                '₹${item.identifiedWasteRupees.toStringAsFixed(0)}',
              ]).toList();
        }
        return filteredVehicles.map((v) => [
              v.plate,
              v.odo > 500 ? 'COMPLETED' : 'COLLECTING',
              '4.0 km/L',
              '${(v.mil > 0 ? v.mil : 4.0).toStringAsFixed(1)} km/L',
              '${(v.odo).toStringAsFixed(0)} km',
              '${v.fuel.toStringAsFixed(1)} L',
              '₹0',
              '₹0',
              '₹0',
            ]).toList();

      case 'driver_performance':
        return filteredDrivers.map((d) => [
              d.name,
              d.vehicle.isNotEmpty ? d.vehicle : 'Unassigned',
              '${d.score}/100',
              '${(d.trips * 120).toStringAsFixed(0)} km',
              '${d.trips}',
              '${d.mil.toStringAsFixed(1)} km/L',
              '${d.idle.round()}',
              '${d.overSpeed}',
              d.score >= 80 ? 'EXCELLENT' : (d.score >= 70 ? 'GOOD' : 'NEEDS ATTENTION'),
            ]).toList();

      case 'trip_activity':
        return filteredTrips.map((t) => [
              t.id,
              t.vehicle,
              t.driver,
              t.from,
              t.to,
              '${t.distance.toStringAsFixed(1)} km',
              '${t.idleDuration + 45}',
              '${t.fuelUsed.toStringAsFixed(1)} L',
              '${t.currentMileage.toStringAsFixed(1)} km/L',
            ]).toList();

      case 'fuel_loss':
        return filteredVehicles.map((v) => [
              v.plate,
              '₹${(v.idle * 15).toStringAsFixed(0)}',
              '₹0',
              '₹0',
              '₹${(v.idle * 15).toStringAsFixed(0)}',
              '₹0',
            ]).toList();

      case 'carbon_impact':
        final allItems = sw?.vehicleBreakdown ?? [];
        final items = allItems.where((item) =>
          (_selectedVehicle == 'All Vehicles' || item.registrationNumber == _selectedVehicle)
        ).toList();
        if (items.isNotEmpty) {
          return items.map((item) {
            final savedL = item.fuelSavedLiters;
            final co2 = savedL * 2.68;
            final carbon = co2 * (12.0 / 44.0);
            return [
              item.registrationNumber,
              '${savedL.toStringAsFixed(1)} L',
              '${co2.toStringAsFixed(1)} kg CO₂',
              '${carbon.toStringAsFixed(1)} kg C',
            ];
          }).toList();
        }
        return filteredVehicles.map((v) => [
              v.plate,
              '0.0 L',
              '0.0 kg CO₂',
              '0.0 kg C',
            ]).toList();

      case 'fleet_performance':
      default:
        return filteredVehicles.map((v) => [
              v.plate,
              '${(v.odo / 100).round()}',
              '${v.odo} km',
              '${v.fuel.toStringAsFixed(1)} L',
              '${v.mil.toStringAsFixed(1)} km/L',
              '${v.idle.round()} min',
              '0',
            ]).toList();
    }
  }

  // ---------------------------------------------------------------------------
  // DOWNLOAD & SHARE HANDLERS
  // ---------------------------------------------------------------------------
  Future<void> _sharePdf(DataEngine engine, Map<String, String> meta) async {
    setState(() => _isGeneratingPdf = true);
    try {
      final pdfBytes = await _generatePdfBytes(engine, meta);
      final dir = await getTemporaryDirectory();
      final file = File('${dir.path}/dravyantra_${widget.reportType}.pdf');
      await file.writeAsBytes(pdfBytes);

      await Share.shareXFiles([XFile(file.path)], text: 'DravYantra Official Business Report: ${meta['title']}');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to share PDF: $e')));
      }
    } finally {
      if (mounted) setState(() => _isGeneratingPdf = false);
    }
  }

  Future<void> _downloadPdf(DataEngine engine, Map<String, String> meta) async {
    setState(() => _isGeneratingPdf = true);
    try {
      final pdfBytes = await _generatePdfBytes(engine, meta);
      await Printing.sharePdf(bytes: pdfBytes, filename: 'dravyantra_${widget.reportType}.pdf');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to download PDF: $e')));
      }
    } finally {
      if (mounted) setState(() => _isGeneratingPdf = false);
    }
  }

  Future<Uint8List> _generatePdfBytes(DataEngine engine, Map<String, String> meta) async {
    final headers = _getTableHeaders(widget.reportType);
    final rows = _getTableRows(widget.reportType, engine);
    final findings = _generateFindings(widget.reportType, engine);

    final kpis = <Map<String, String>>[
      {'label': 'Selected Period', 'value': engine.selectedPeriod.toUpperCase()},
      {'label': 'Vehicle Filter', 'value': _selectedVehicle},
      {'label': 'Driver Filter', 'value': _selectedDriver},
    ];

    switch (widget.reportType) {
      case 'fuel_savings':
        final sw = engine.savingsWalletData;
        final vRs = sw?.verifiedSavingsRupees ?? engine.savings.toDouble();
        final pRs = sw?.fuelLossPreventedRupees ?? 0.0;
        final wRs = sw?.identifiedWasteRupees ?? (engine.loss.toDouble() * 95.0);
        kpis.addAll([
          {'label': 'Verified Savings', 'value': '₹${vRs.toStringAsFixed(0)}'},
          {'label': 'Prevented Loss', 'value': '₹${pRs.toStringAsFixed(0)}'},
          {'label': 'Identified Waste', 'value': '₹${wRs.toStringAsFixed(0)}'},
        ]);
        break;
      case 'driver_performance':
        final drivers = _getFilteredDrivers(engine);
        final avgScore = drivers.isNotEmpty ? (drivers.fold<double>(0.0, (s, d) => s + d.score) / drivers.length) : 0.0;
        kpis.addAll([
          {'label': 'Monitored Drivers', 'value': '${drivers.length}'},
          {'label': 'Avg Safety Score', 'value': '${avgScore.toStringAsFixed(0)}/100'},
        ]);
        break;
      case 'trip_activity':
        final trips = _getFilteredTrips(engine);
        final totalDist = trips.fold<double>(0.0, (s, t) => s + t.distance);
        kpis.addAll([
          {'label': 'Total Trips', 'value': '${trips.length}'},
          {'label': 'Total Distance', 'value': '${totalDist.toStringAsFixed(0)} km'},
        ]);
        break;
      case 'fuel_loss':
        final sw = engine.savingsWalletData;
        final totalLossRs = sw?.identifiedWasteRupees ?? (engine.loss * 95.0);
        kpis.addAll([
          {'label': 'Identified Waste', 'value': '₹${totalLossRs.toStringAsFixed(0)}'},
          {'label': 'Prevented Loss', 'value': '₹${(sw?.fuelLossPreventedRupees ?? 0.0).toStringAsFixed(0)}'},
        ]);
        break;
      case 'carbon_impact':
        final sw = engine.savingsWalletData;
        final fuelSavedL = sw?.verifiedSavingsLiters ?? engine.savingsLiters.toDouble();
        final co2Avoided = fuelSavedL * 2.68;
        final carbonReduced = co2Avoided * (12.0 / 44.0);
        kpis.addAll([
          {'label': 'CO₂ Avoided', 'value': '${co2Avoided.toStringAsFixed(1)} kg CO₂'},
          {'label': 'Carbon Reduced', 'value': '${carbonReduced.toStringAsFixed(1)} kg C'},
        ]);
        break;
      case 'fleet_performance':
      default:
        final vehicles = _getFilteredVehicles(engine);
        final trips = _getFilteredTrips(engine);
        final dist = trips.fold<double>(0.0, (s, t) => s + t.distance);
        final fuel = trips.fold<double>(0.0, (s, t) => s + t.fuelUsed);
        final avgMil = fuel > 0 ? (dist / fuel) : 4.0;
        kpis.addAll([
          {'label': 'Vehicles Count', 'value': '${vehicles.length}'},
          {'label': 'Total Distance', 'value': '${dist.toStringAsFixed(0)} km'},
          {'label': 'Fleet Mileage', 'value': '${avgMil.toStringAsFixed(1)} km/L'},
        ]);
        break;
    }

    return PdfReportGenerator.generatePdf(
      title: meta['title']!,
      periodLabel: engine.selectedPeriod,
      companyName: engine.companyName,
      summaryKpis: kpis,
      findings: findings,
      tableHeaders: headers,
      tableRows: rows,
    );
  }
}
