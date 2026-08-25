import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../core/theme.dart';
import 'package:provider/provider.dart';
import '../models/engine.dart';
import 'package:lucide_icons/lucide_icons.dart';

class FuelCalculationDetailsScreen extends StatelessWidget {
  final String metric;

  const FuelCalculationDetailsScreen({super.key, required this.metric});

  @override
  Widget build(BuildContext context) {
    final engine = context.watch<DataEngine>();
    final isFuelLoss = metric == 'Fuel Loss';

    // Calculate totals across all trips
    final double idleLossRupees = engine.trips.fold(0.0, (sum, t) => sum + t.idleMoneyWasted);
    final double idleLossLiters = engine.trips.fold(0.0, (sum, t) => sum + t.idleFuelWasted);

    final double speedingLossRupees = engine.trips.fold(0.0, (sum, t) => sum + t.speedingMoneyLoss);
    final double speedingLossLiters = engine.trips.fold(0.0, (sum, t) => sum + t.speedingFuelLoss);

    final double theftLossRupees = engine.trips.fold(0.0, (sum, t) => sum + t.theftMoneyLoss);
    final double theftLossLiters = engine.trips.fold(0.0, (sum, t) => sum + t.theftFuelLoss);

    final double inefficiencyLossRupees = engine.trips.fold(0.0, (sum, t) => sum + (t.fuelWasted * (t.fuelPrice > 0 ? t.fuelPrice : 92.0)));
    final double inefficiencyLossLiters = engine.trips.fold(0.0, (sum, t) => sum + t.fuelWasted);

    final double totalLossRupees = (idleLossRupees + speedingLossRupees + theftLossRupees + inefficiencyLossRupees) > 0
        ? (idleLossRupees + speedingLossRupees + theftLossRupees + inefficiencyLossRupees)
        : engine.loss;
    final double totalLossLiters = (idleLossLiters + speedingLossLiters + theftLossLiters + inefficiencyLossLiters) > 0
        ? (idleLossLiters + speedingLossLiters + theftLossLiters + inefficiencyLossLiters)
        : engine.lossLiters.toDouble();

    final double totalSpendRupees = engine.trips.fold(0.0, (sum, t) => sum + (t.fuelUsed * (t.fuelPrice > 0 ? t.fuelPrice : 92.0))) > 0
        ? engine.trips.fold(0.0, (sum, t) => sum + (t.fuelUsed * (t.fuelPrice > 0 ? t.fuelPrice : 92.0)))
        : engine.spend.toDouble();
    final double totalSpendLiters = engine.trips.fold(0.0, (sum, t) => sum + t.fuelUsed) > 0
        ? engine.trips.fold(0.0, (sum, t) => sum + t.fuelUsed)
        : engine.spendLiters.toDouble();

    final wastedTrips = [...engine.trips]
      ..sort((a, b) {
        final wasteA = a.idleMoneyWasted + a.speedingMoneyLoss + a.theftMoneyLoss + (a.fuelWasted * (a.fuelPrice > 0 ? a.fuelPrice : 92.0));
        final wasteB = b.idleMoneyWasted + b.speedingMoneyLoss + b.theftMoneyLoss + (b.fuelWasted * (b.fuelPrice > 0 ? b.fuelPrice : 92.0));
        return wasteB.compareTo(wasteA);
      });

    final spendTrips = [...engine.trips]
      ..sort((a, b) => b.distance.compareTo(a.distance));

    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(LucideIcons.arrowLeft),
          tooltip: 'Back',
          onPressed: () {
            if (context.canPop()) {
              context.pop();
            } else {
              context.go('/fuel');
            }
          },
        ),
        title: Text('$metric Breakdown'),
        backgroundColor: Colors.white,
        foregroundColor: AppTheme.textPrimary,
        elevation: 0,
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top Summary Card
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: isFuelLoss ? AppTheme.danger.withOpacity(0.08) : AppTheme.primaryBlue.withOpacity(0.08),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: isFuelLoss ? AppTheme.danger.withOpacity(0.2) : AppTheme.primaryBlue.withOpacity(0.2),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isFuelLoss ? AppTheme.danger : AppTheme.primaryBlue,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      isFuelLoss ? LucideIcons.trendingDown : LucideIcons.fuel,
                      color: Colors.white, size: 24,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isFuelLoss ? 'Total Fuel Loss' : 'Total Fuel Spend',
                          style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 2),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(
                            isFuelLoss
                                ? '₹${totalLossRupees.toStringAsFixed(2)}  (${totalLossLiters.toStringAsFixed(2)} L)'
                                : '₹${totalSpendRupees.toStringAsFixed(2)}  (${totalSpendLiters.toStringAsFixed(2)} L)',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: isFuelLoss ? AppTheme.danger : AppTheme.primaryBlue,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            if (isFuelLoss) ...[
              const SizedBox(height: 20),
              const Text('Loss Category Breakdown (Every Rupee)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              const SizedBox(height: 12),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
                childAspectRatio: 1.6,
                children: [
                  _categoryCard('Idle Wastage', idleLossRupees, idleLossLiters, LucideIcons.clock, Colors.orange),
                  _categoryCard('Rash Driving', speedingLossRupees, speedingLossLiters, LucideIcons.zap, Colors.red),
                  _categoryCard('Low Mileage', inefficiencyLossRupees, inefficiencyLossLiters, LucideIcons.trendingDown, Colors.purple),
                  _categoryCard('Fuel Theft', theftLossRupees, theftLossLiters, LucideIcons.alertTriangle, Colors.deepOrange),
                ],
              ),
            ],

            const SizedBox(height: 24),

            Text(
              isFuelLoss ? 'Itemized Trip Fuel Loss Records' : 'Trip Fuel Spend Records',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
            const SizedBox(height: 16),

            if (isFuelLoss) ...[
              if (wastedTrips.isEmpty)
                _emptyState('No fuel loss recorded yet.\nRun the simulation to generate telemetry data.')
              else
                ...wastedTrips.map((t) => _tripLossCard(t)),
            ] else ...[
              if (spendTrips.isEmpty)
                _emptyState('No trip fuel spend data yet.\nRun the simulation to generate telemetry data.')
              else
                ...spendTrips.map((t) => _tripSpendCard(t)),
            ],
          ],
        ),
      ),
    );
  }

  Widget _categoryCard(String title, double rupees, double liters, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withOpacity(0.2)),
        boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 4)],
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(title, style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary, fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 1),
                FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerLeft,
                  child: Text('₹${rupees.toStringAsFixed(1)}', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: color)),
                ),
                Text('${liters.toStringAsFixed(2)} L', style: const TextStyle(fontSize: 9, color: AppTheme.textSecondary)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _emptyState(String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          const Icon(LucideIcons.inbox, size: 40, color: AppTheme.textSecondary),
          const SizedBox(height: 12),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppTheme.textSecondary, fontSize: 14, height: 1.5),
          ),
        ],
      ),
    );
  }

  Widget _tripLossCard(Trip t) {
    final double price = t.fuelPrice > 0 ? t.fuelPrice : 100.0;
    final double ineffLossRupees = t.fuelWasted * price;
    final double totalLossRupees = t.idleMoneyWasted + t.speedingMoneyLoss + t.theftMoneyLoss + ineffLossRupees;
    final double totalLossLiters = t.idleFuelWasted + t.speedingFuelLoss + t.theftFuelLoss + t.fuelWasted;

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppTheme.danger.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(LucideIcons.alertTriangle, color: AppTheme.danger, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${t.vehicle}  •  ${t.id}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      Text(
                        'Driver: ${t.driver}  •  Status: ${t.status.toUpperCase()}',
                        style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '₹${totalLossRupees.toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.danger,
                      ),
                    ),
                    Text(
                      '${totalLossLiters.toStringAsFixed(2)} L',
                      style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                    ),
                  ],
                ),
              ],
            ),
            const Divider(height: 16),
            const Text('Rupee Loss Itemization:', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textSecondary)),
            const SizedBox(height: 6),
            Wrap(
              spacing: 8,
              runSpacing: 6,
              children: [
                _lossItemChip('💤 Idle', t.idleMoneyWasted, t.idleFuelWasted, Colors.orange),
                _lossItemChip('🚀 Rash Driving', t.speedingMoneyLoss, t.speedingFuelLoss, Colors.red),
                _lossItemChip('📉 Low Mileage', ineffLossRupees, t.fuelWasted, Colors.purple),
                _lossItemChip('🚨 Fuel Theft', t.theftMoneyLoss, t.theftFuelLoss, Colors.deepOrange),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _lossItemChip(String label, double rupees, double liters, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withOpacity(0.08),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withOpacity(0.2)),
      ),
      child: Text(
        '$label: ₹${rupees.toStringAsFixed(1)} (${liters.toStringAsFixed(2)}L)',
        style: TextStyle(fontSize: 11, color: color, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _tripSpendCard(Trip t) {
    final double fuelPrice = t.fuelPrice > 0 ? t.fuelPrice : 92.0;
    final double tripSpendRupees = t.fuelUsed > 0 ? t.fuelUsed * fuelPrice : (t.distance > 0 && t.defaultMileage > 0 ? (t.distance / t.defaultMileage) * fuelPrice : 0.0);
    final double tripFuelLiters = t.fuelUsed > 0 ? t.fuelUsed : (t.distance > 0 && t.defaultMileage > 0 ? t.distance / t.defaultMileage : 0.0);

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 0,
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppTheme.primaryBlue.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(LucideIcons.fuel, color: AppTheme.primaryBlue, size: 18),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${t.vehicle}  •  ${t.id}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Driver: ${t.driver}',
                    style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                  ),
                  Text(
                    '${t.distance.toStringAsFixed(1)} km  •  Status: ${t.status.toUpperCase()}',
                    style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '₹${tripSpendRupees.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontWeight: FontWeight.bold, fontSize: 16, color: AppTheme.primaryBlue,
                  ),
                ),
                Text(
                  '${tripFuelLiters.toStringAsFixed(2)} L',
                  style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

