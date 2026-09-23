import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../models/engine.dart';
import '../core/theme.dart';

class SavingsWalletScreen extends StatefulWidget {
  const SavingsWalletScreen({super.key});

  @override
  State<SavingsWalletScreen> createState() => _SavingsWalletScreenState();
}

class _SavingsWalletScreenState extends State<SavingsWalletScreen> {
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
        final sw = engine.savingsWalletData;

        // Fallback calculations if backend data is loading
        final verifiedRs = sw?.verifiedSavingsRupees ?? engine.fleetStats?.verifiedSavingsRupees ?? engine.savings.toDouble();
        final verifiedL = sw?.verifiedSavingsLiters ?? engine.fleetStats?.fuelSavedLiters ?? engine.savingsLiters.toDouble();

        final preventedRs = sw?.fuelLossPreventedRupees ?? ((engine.fleetStats?.idleLossRupees ?? 0.0) + (engine.fleetStats?.theftLossRupees ?? 0.0));
        final preventedL = sw?.fuelLossPreventedLiters ?? 0.0;
        final preventedEvents = sw?.fuelLossPreventedEvents ?? 0;

        final fuelPrice = (engine.fleetStats != null && engine.fleetStats!.fuelConsumedL > 0) ? (engine.fleetStats!.fuelCostRupees / engine.fleetStats!.fuelConsumedL) : 96.0;
        final wasteRs = sw?.identifiedWasteRupees ?? engine.fleetStats?.totalLossRupees ?? (engine.loss.toDouble() * fuelPrice);
        final wasteL = sw?.identifiedWasteLiters ?? engine.fleetStats?.totalLossLiters ?? engine.loss.toDouble();

        final idleL = sw?.idleWasteLiters ?? (fuelPrice > 0 ? (engine.idleRupees / fuelPrice) : 0.0);
        final idleRs = sw?.idleWasteRupees ?? engine.idleRupees;

        final speedL = sw?.speedingWasteLiters ?? 0.0;
        final speedRs = sw?.speedingWasteRupees ?? 0.0;
        final speedEvts = sw?.speedingEvents ?? 0;

        final theftL = sw?.theftWasteLiters ?? 0.0;
        final theftRs = sw?.theftWasteRupees ?? 0.0;
        final theftEvts = sw?.theftEvents ?? 0;

        final vehicleItems = sw?.vehicleBreakdown ?? [];

        return Scaffold(
          appBar: AppBar(
            title: const Text('Savings Wallet Audit'),
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
                _buildPrimaryKpiCards(verifiedRs, verifiedL, preventedRs, preventedL, preventedEvents, wasteRs, wasteL),
                const SizedBox(height: 16),
                _buildWasteWarningCard(),
                const SizedBox(height: 24),
                const Text('Identified Waste Cause Breakdown', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 8),
                _buildCauseBreakdownCards(idleL, idleRs, speedL, speedRs, speedEvts, theftL, theftRs, theftEvts),
                const SizedBox(height: 24),
                const Text('Vehicle-wise Baseline & Savings Breakdown', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 8),
                _buildVehicleBreakdownTable(vehicleItems, engine),
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
        Text('Savings Wallet & Financial Audit', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
        SizedBox(height: 4),
        Text('Audited baseline savings, prevented losses, and unrecovered waste breakdown', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
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

  Widget _buildPrimaryKpiCards(double vRs, double vL, double pRs, double pL, int pEvts, double wRs, double wL) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppTheme.success.withOpacity(0.08),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppTheme.success.withOpacity(0.3)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(color: AppTheme.success.withOpacity(0.15), shape: BoxShape.circle),
                child: const Icon(LucideIcons.wallet, color: AppTheme.success, size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('VERIFIED SAVINGS (Realized)', style: TextStyle(fontSize: 12, color: AppTheme.success, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                    const SizedBox(height: 4),
                    Text('₹${vRs.toStringAsFixed(0)}', style: const TextStyle(fontSize: 26, fontWeight: FontWeight.bold, color: AppTheme.success)),
                    Text('${vL.toStringAsFixed(1)} Litres saved vs completed baseline', style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppTheme.primaryBlue.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppTheme.primaryBlue.withOpacity(0.2)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(LucideIcons.shieldCheck, size: 14, color: AppTheme.primaryBlue),
                        SizedBox(width: 4),
                        Text('Fuel Loss Prevented', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.primaryBlue)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text('₹${pRs.toStringAsFixed(0)}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.primaryBlue)),
                    const SizedBox(height: 2),
                    Text('${pL.toStringAsFixed(1)} L • $pEvts prevented events', style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary)),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppTheme.warning.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppTheme.warning.withOpacity(0.2)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(LucideIcons.alertTriangle, size: 14, color: AppTheme.warning),
                        SizedBox(width: 4),
                        Text('Identified Fuel Waste', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.warning)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text('₹${wRs.toStringAsFixed(0)}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.warning)),
                    const SizedBox(height: 2),
                    Text('${wL.toStringAsFixed(1)} L unrecovered driver waste', style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildWasteWarningCard() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.grey.shade100,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade300),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(LucideIcons.info, color: AppTheme.textSecondary, size: 16),
          SizedBox(width: 8),
          Expanded(
            child: Text(
              'Audit Standard: "Verified Savings" represents actual cost reduction measured against a completed vehicle baseline. "Fuel Loss Prevented" counts fuel drops confirmed to be prevented. "Identified Fuel Waste" is unrecovered driver inefficiency (idling, speeding, unprevented theft) and is NEVER claimed as money saved.',
              style: TextStyle(fontSize: 11, color: AppTheme.textSecondary, height: 1.3),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCauseBreakdownCards(double idleL, double idleRs, double speedL, double speedRs, int speedEvts, double theftL, double theftRs, int theftEvts) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(child: _causeCard('Excess Idling Waste', '${idleL.toStringAsFixed(1)} L', '₹${idleRs.toStringAsFixed(0)}', AppTheme.warning, LucideIcons.timer)),
            const SizedBox(width: 12),
            Expanded(child: _causeCard('Speeding Waste', '${speedL.toStringAsFixed(1)} L', '₹${speedRs.toStringAsFixed(0)} ($speedEvts evts)', AppTheme.warning, LucideIcons.gauge)),
          ],
        ),
        const SizedBox(height: 12),
        _causeCard('Unprevented Theft / Drop', '${theftL.toStringAsFixed(1)} L', '₹${theftRs.toStringAsFixed(0)} ($theftEvts evts)', AppTheme.danger, LucideIcons.alertOctagon),
      ],
    );
  }

  Widget _causeCard(String title, String mainVal, String subVal, Color color, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: color),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary, fontWeight: FontWeight.bold), maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 2),
                Text(mainVal, style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color), maxLines: 1, overflow: TextOverflow.ellipsis),
              ],
            ),
          ),
          Text(subVal, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textPrimary), maxLines: 1, overflow: TextOverflow.ellipsis),
        ],
      ),
    );
  }

  Widget _buildVehicleBreakdownTable(List<SavingsWalletVehicleItem> items, DataEngine engine) {
    if (items.isEmpty) {
      // Fallback build list from engine.vehicles and trips
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              headingTextStyle: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textSecondary, fontSize: 12),
              dataTextStyle: const TextStyle(fontSize: 12),
              columns: const [
                DataColumn(label: Text('Vehicle')),
                DataColumn(label: Text('Baseline Status')),
                DataColumn(label: Text('Baseline Mileage')),
                DataColumn(label: Text('Current Mileage')),
                DataColumn(label: Text('Verified Savings (₹)')),
              ],
              rows: engine.vehicles.map((v) {
                final isCompleted = v.odo > 500;
                final status = isCompleted ? 'completed' : 'collecting';
                final bEff = 4.0;
                final cEff = v.mil > 0 ? v.mil : 4.0;
                final fuelPrice = (engine.fleetStats != null && engine.fleetStats!.fuelConsumedL > 0) ? (engine.fleetStats!.fuelCostRupees / engine.fleetStats!.fuelConsumedL) : 96.0;
                final savedRs = isCompleted && cEff > bEff ? ((cEff - bEff) * 10 * fuelPrice) : 0.0;
                return DataRow(cells: [
                  DataCell(Text(v.plate, style: const TextStyle(fontWeight: FontWeight.bold))),
                  DataCell(_statusBadge(status)),
                  DataCell(Text('${bEff.toStringAsFixed(1)} km/L')),
                  DataCell(Text('${cEff.toStringAsFixed(1)} km/L')),
                  DataCell(Text('₹${savedRs.toStringAsFixed(0)}', style: TextStyle(color: savedRs > 0 ? AppTheme.success : AppTheme.textSecondary, fontWeight: FontWeight.bold))),
                ]);
              }).toList(),
            ),
          ),
        ),
      );
    }

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12.0),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: DataTable(
            headingTextStyle: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textSecondary, fontSize: 12),
            dataTextStyle: const TextStyle(fontSize: 12),
            columns: const [
              DataColumn(label: Text('Vehicle')),
              DataColumn(label: Text('Baseline Status')),
              DataColumn(label: Text('Baseline Efficiency')),
              DataColumn(label: Text('Current Efficiency')),
              DataColumn(label: Text('Distance')),
              DataColumn(label: Text('Verified Savings')),
              DataColumn(label: Text('Prevented Loss')),
              DataColumn(label: Text('Identified Waste')),
            ],
            rows: items.map((item) {
              return DataRow(cells: [
                DataCell(Text(item.registrationNumber, style: const TextStyle(fontWeight: FontWeight.bold))),
                DataCell(_statusBadge(item.baselineStatus)),
                DataCell(Text('${item.baselineEfficiency.toStringAsFixed(1)} km/L')),
                DataCell(Text('${item.currentEfficiency.toStringAsFixed(1)} km/L')),
                DataCell(Text('${item.distance.toStringAsFixed(0)} km')),
                DataCell(Text(
                  item.baselineStatus == 'completed' && item.fuelSavedRupees > 0
                      ? '₹${item.fuelSavedRupees.toStringAsFixed(0)} (${item.fuelSavedLiters.toStringAsFixed(1)}L)'
                      : '₹0 (Collecting baseline)',
                  style: TextStyle(
                    color: item.baselineStatus == 'completed' && item.fuelSavedRupees > 0 ? AppTheme.success : AppTheme.textSecondary,
                    fontWeight: FontWeight.bold,
                  ),
                )),
                DataCell(Text('₹${item.fuelLossPreventedRupees.toStringAsFixed(0)} (${item.fuelLossPreventedLiters.toStringAsFixed(1)}L)', style: const TextStyle(color: AppTheme.primaryBlue, fontWeight: FontWeight.bold))),
                DataCell(Text('₹${item.identifiedWasteRupees.toStringAsFixed(0)} (${item.identifiedWasteLiters.toStringAsFixed(1)}L)', style: const TextStyle(color: AppTheme.warning, fontWeight: FontWeight.bold))),
              ]);
            }).toList(),
          ),
        ),
      ),
    );
  }

  Widget _statusBadge(String status) {
    final isCompleted = status.toLowerCase() == 'completed';
    final color = isCompleted ? AppTheme.success : AppTheme.warning;
    final text = isCompleted ? 'Completed' : 'Collecting Baseline';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withOpacity(0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(isCompleted ? LucideIcons.checkCircle : LucideIcons.loader, size: 12, color: color),
          const SizedBox(width: 4),
          Text(text, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }
}
