import 'package:flutter/material.dart';
import '../core/theme.dart';
import '../models/engine.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'drivers_screen.dart';

class DriverProfileScreen extends StatefulWidget {
  final Driver driver;
  const DriverProfileScreen({super.key, required this.driver});

  @override
  State<DriverProfileScreen> createState() => _DriverProfileScreenState();
}

class _DriverProfileScreenState extends State<DriverProfileScreen> {
  String _filter = 'Recent First';
  Trip? _selectedTrip;
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  Widget build(BuildContext context) {
    final engine = context.watch<DataEngine>();
    final driver = engine.drivers.firstWhere((d) => d.id == widget.driver.id, orElse: () => widget.driver);

    // Get all trips for this driver (match by name)
    var driverTrips = engine.trips
        .where((t) => t.driver.trim().toLowerCase() == widget.driver.name.trim().toLowerCase())
        .toList();

    // Apply filter
    switch (_filter) {
      case 'Recent First':
        driverTrips.sort((a, b) => b.id.compareTo(a.id));
        break;
      case 'Long Distance':
        driverTrips.sort((a, b) => b.distance.compareTo(a.distance));
        break;
      case 'More Money Wasted':
        driverTrips.sort((a, b) => b.idleMoneyWasted.compareTo(a.idleMoneyWasted));
        break;
      case 'Less Money Wasted':
        driverTrips.sort((a, b) => a.idleMoneyWasted.compareTo(b.idleMoneyWasted));
        break;
    }

    // Compute real stats from actual trips
    final int totalTrips = driverTrips.length;
    final double moneySaved = driverTrips.fold(0.0, (sum, t) => sum + t.moneySaved);
    final double moneyWasted = driverTrips.fold(0.0, (sum, t) => sum + t.idleMoneyWasted);
    final int harshBrakes = driver.harsh;

    // Refresh selected trip from latest engine state
    final activeSelectedTrip = _selectedTrip == null
        ? null
        : engine.trips.firstWhere(
            (t) => t.id == _selectedTrip!.id,
            orElse: () => _selectedTrip!,
          );

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: Colors.white,
      endDrawer: activeSelectedTrip != null
          ? _TripDetailMini(
              trip: activeSelectedTrip,
              onClose: () => Navigator.pop(context),
              onStatusUpdate: (status) {
                engine.updateTripStatus(activeSelectedTrip.id, status);
                Navigator.pop(context);
              },
            )
          : null,
      appBar: AppBar(
        title: Text('${driver.name} Profile'),
        backgroundColor: Colors.white,
        foregroundColor: AppTheme.textPrimary,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.edit3),
            tooltip: 'Edit Profile',
            onPressed: () {
              showDialog(
                context: context,
                builder: (context) => DriverFormDialog(
                  engine: engine,
                  driver: driver,
                ),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Center(
              child: Column(
                children: [
                  GestureDetector(
                    onTap: driver.imageUrl != null && driver.imageUrl!.isNotEmpty
                        ? () => _showPhotoViewer(context, driver.imageUrl!, driver.id)
                        : null,
                    child: Hero(
                      tag: 'driver-photo-${driver.id}',
                      child: Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppTheme.primaryBlue.withOpacity(0.1),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: (driver.imageUrl != null && driver.imageUrl!.isNotEmpty)
                            ? Image.network(
                                driver.imageUrl!,
                                width: 80,
                                height: 80,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) {
                                  return const Icon(LucideIcons.user, size: 40, color: AppTheme.primaryBlue);
                                },
                                loadingBuilder: (context, child, loadingProgress) {
                                  if (loadingProgress == null) return child;
                                  return const Center(
                                    child: SizedBox(
                                      width: 24,
                                      height: 24,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primaryBlue),
                                    ),
                                  );
                                },
                              )
                            : const Icon(LucideIcons.user, size: 40, color: AppTheme.primaryBlue),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(driver.name,
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
                  Text(driver.phone,
                      style: const TextStyle(color: AppTheme.textSecondary)),
                  const SizedBox(height: 4),
                  Text('Age: ${driver.age}  •  Exp: ${driver.exp} yrs',
                      style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                  const SizedBox(height: 8),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppTheme.success.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Text(
                      'Driver Score: ${driver.score}',
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, color: AppTheme.success),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Driver Documents Section
            const Text('Documents',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  children: [
                    _docRow('License No.', driver.lic, LucideIcons.fileText),
                    _docRow('Blood Group', driver.blood, LucideIcons.heart),
                    if (driver.home.isNotEmpty && driver.home != 'N/A')
                      _docRow('Hometown / Address', driver.home, LucideIcons.home),
                    _docRow('License Expiry', driver.licExp, LucideIcons.calendar,
                        isExpiring: _isExpiringSoon(driver.licExp)),
                  ],
                ),
              ),
            ),

            const SizedBox(height: 24),

            // Stats from real data
            const Text('Performance Stats',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            Row(
              children: [
                _buildStatCard('Total Trips', '$totalTrips', LucideIcons.map),
                const SizedBox(width: 12),
                _buildStatCard(
                    'Money Saved', '₹${moneySaved.toStringAsFixed(0)}',
                    LucideIcons.trendingUp,
                    color: AppTheme.success),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _buildStatCard(
                    'Money Wasted', '₹${moneyWasted.toStringAsFixed(0)}',
                    LucideIcons.trendingDown,
                    color: AppTheme.danger),
                const SizedBox(width: 12),
                _buildStatCard(
                    'Harsh Brakes', '$harshBrakes', LucideIcons.alertTriangle,
                    color: AppTheme.warning),
              ],
            ),

            const SizedBox(height: 32),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('All Trips',
                    style:
                        TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                DropdownButton<String>(
                  value: _filter,
                  icon: const Icon(LucideIcons.chevronDown, size: 16),
                  underline: const SizedBox(),
                  style: const TextStyle(
                      fontSize: 14,
                      color: AppTheme.primaryBlue,
                      fontWeight: FontWeight.bold),
                  items: [
                    'Recent First',
                    'Long Distance',
                    'More Money Wasted',
                    'Less Money Wasted'
                  ].map((String value) {
                    return DropdownMenuItem<String>(
                      value: value,
                      child: Text(value),
                    );
                  }).toList(),
                  onChanged: (newValue) {
                    if (newValue != null) {
                      setState(() => _filter = newValue);
                    }
                  },
                ),
              ],
            ),
            const SizedBox(height: 16),
            if (driverTrips.isEmpty)
              const Center(
                  child: Text('No trips recorded for this driver.',
                      style: TextStyle(color: AppTheme.textSecondary)))
            else
              ...driverTrips
                  .map((t) => Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: () {
                            setState(() => _selectedTrip = t);
                            _scaffoldKey.currentState?.openEndDrawer();
                          },
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              children: [
                                const Icon(LucideIcons.mapPin,
                                    color: AppTheme.primaryBlue),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                          '${t.vehicle} • ${t.id}',
                                          style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 14)),
                                      const SizedBox(height: 4),
                                      Text(
                                          '${t.from.isNotEmpty ? t.from : "—"} → ${t.to.isNotEmpty ? t.to : "—"}',
                                          style: const TextStyle(
                                              fontSize: 12,
                                              color: AppTheme.textSecondary)),
                                      Text(
                                          'Dist: ${t.distance.toStringAsFixed(1)} km  •  Wasted: ₹${t.idleMoneyWasted.toStringAsFixed(0)}',
                                          style: const TextStyle(
                                              fontSize: 12,
                                              color: AppTheme.textSecondary)),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: _statusColor(t.status)
                                        .withOpacity(0.1),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    t.status.toUpperCase(),
                                    style: TextStyle(
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                        color: _statusColor(t.status)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      )),
          ],
        ),
      ),
    );
  }

  Color _statusColor(String status) {
    final s = status.trim().toLowerCase();
    if (s == 'completed') return AppTheme.success;
    if (s == 'running') return Colors.blue;
    if (s == 'cancelled') return AppTheme.danger;
    return AppTheme.warning;
  }

  bool _isExpiringSoon(String dateStr) {
    if (dateStr.isEmpty) return false;
    try {
      final date = DateTime.parse(dateStr);
      return date.isBefore(DateTime.now().add(const Duration(days: 30)));
    } catch (_) {
      return false;
    }
  }

  Widget _docRow(String label, String value, IconData icon,
      {bool isExpiring = false}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppTheme.textSecondary),
          const SizedBox(width: 12),
          Expanded(
              child: Text(label,
                  style: const TextStyle(color: AppTheme.textSecondary))),
          Text(
            value.isNotEmpty ? value : '—',
            style: TextStyle(
                fontWeight: FontWeight.bold,
                color: isExpiring ? AppTheme.danger : AppTheme.textPrimary),
          ),
          if (isExpiring) ...[
            const SizedBox(width: 4),
            const Icon(LucideIcons.alertCircle,
                size: 14, color: AppTheme.danger),
          ]
        ],
      ),
    );
  }

  Widget _buildStatCard(String label, String val, IconData icon,
      {Color color = AppTheme.primaryBlue}) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: color.withOpacity(0.2)),
          boxShadow: [
            BoxShadow(
                color: color.withOpacity(0.05),
                blurRadius: 10,
                offset: const Offset(0, 4)),
          ],
        ),
        child: Column(
          children: [
            Icon(icon, color: color),
            const SizedBox(height: 8),
            Text(val,
                style: TextStyle(
                    fontSize: 20, fontWeight: FontWeight.bold, color: color)),
            const SizedBox(height: 4),
            Text(label,
                style: const TextStyle(
                    fontSize: 12, color: AppTheme.textSecondary)),
          ],
        ),
      ),
    );
  }
}

// Inline mini trip detail drawer - same as the one in trips_screen but self-contained
class _TripDetailMini extends StatelessWidget {
  final Trip trip;
  final VoidCallback onClose;
  final void Function(String) onStatusUpdate;

  const _TripDetailMini(
      {required this.trip,
      required this.onClose,
      required this.onStatusUpdate});

  @override
  Widget build(BuildContext context) {
    final normalized =
        trip.status.trim().toLowerCase().replaceAll('_', ' ');
    final color = normalized == 'completed'
        ? AppTheme.success
        : normalized == 'running'
            ? Colors.blue
            : normalized == 'cancelled'
                ? AppTheme.danger
                : AppTheme.warning;

    return Drawer(
      width: 420,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(24, 60, 24, 24),
            color: color,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(trip.id,
                        style: const TextStyle(
                            color: Colors.white,
                            fontSize: 22,
                            fontWeight: FontWeight.bold)),
                    IconButton(
                        icon:
                            const Icon(Icons.close, color: Colors.white),
                        onPressed: onClose),
                  ],
                ),
                Text(
                    '${trip.from.isNotEmpty ? trip.from : "—"} → ${trip.to.isNotEmpty ? trip.to : "—"}',
                    style: TextStyle(
                        color: Colors.white.withOpacity(0.85),
                        fontSize: 14)),
                const SizedBox(height: 10),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(
                        color: Colors.white.withOpacity(0.5)),
                  ),
                  child: Text(trip.status.toUpperCase(),
                      style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                _row('Vehicle', trip.vehicle, Icons.local_shipping),
                _row('Driver', trip.driver, Icons.person),
                _row('From', trip.from.isNotEmpty ? trip.from : '—', Icons.location_on),
                _row('To', trip.to.isNotEmpty ? trip.to : '—', Icons.flag),
                _row('Distance', '${trip.distance.toStringAsFixed(1)} km', Icons.route),
                _row('Load', trip.load, Icons.inventory),
                _row('e-Way Bill', trip.ewayBill, Icons.receipt),
                _row('Date', trip.date, Icons.calendar_today),
                const Divider(height: 32),
                _row('Fuel Used',
                    '${((trip.distance * trip.progress) / (trip.defaultMileage > 0 ? trip.defaultMileage : 4.0)).toStringAsFixed(1)} L',
                    Icons.local_gas_station),
                _row('Money Saved', '₹${trip.moneySaved.toStringAsFixed(2)}', Icons.trending_up),
                _row('Money Wasted', '₹${trip.idleMoneyWasted.toStringAsFixed(2)}', Icons.trending_down),
                _row('Idle Fuel Wasted', '${trip.idleFuelWasted.toStringAsFixed(2)} L', Icons.timer_off),
                const Divider(height: 32),
                if (normalized == 'pending' || normalized == 'not started')
                  ElevatedButton(
                    onPressed: () => onStatusUpdate('running'),
                    style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 48)),
                    child: const Text('Start Trip'),
                  ),
                if (normalized == 'running' || normalized == 'idle') ...[
                  ElevatedButton(
                    onPressed: () => onStatusUpdate('paused'),
                    style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.warning,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 48)),
                    child: const Text('Stop Trip'),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: () => onStatusUpdate('completed'),
                    style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.success,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 48)),
                    child: const Text('Mark as Completed'),
                  ),
                ],
                if (normalized == 'paused' ||
                    normalized == 'halted' ||
                    normalized == 'stopped') ...[
                  ElevatedButton(
                    onPressed: () => onStatusUpdate('running'),
                    style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 48)),
                    child: const Text('Resume Trip'),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: () => onStatusUpdate('completed'),
                    style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.success,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 48)),
                    child: const Text('Mark as Completed'),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppTheme.textSecondary),
          const SizedBox(width: 12),
          Expanded(
              child: Text(label,
                  style: const TextStyle(color: AppTheme.textSecondary))),
          Text(value,
              style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

// ─── Photo Viewer ────────────────────────────────────────────────────────────

void _showPhotoViewer(BuildContext context, String imageUrl, String driverId) {
  Navigator.of(context).push(
    PageRouteBuilder(
      opaque: false,
      barrierDismissible: true,
      barrierColor: Colors.transparent,
      pageBuilder: (_, __, ___) => _PhotoViewerOverlay(
        imageUrl: imageUrl,
        heroTag: 'driver-photo-$driverId',
      ),
      transitionsBuilder: (_, animation, __, child) => FadeTransition(
        opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
        child: child,
      ),
      transitionDuration: const Duration(milliseconds: 280),
    ),
  );
}

class _PhotoViewerOverlay extends StatefulWidget {
  final String imageUrl;
  final String heroTag;
  const _PhotoViewerOverlay({required this.imageUrl, required this.heroTag});

  @override
  State<_PhotoViewerOverlay> createState() => _PhotoViewerOverlayState();
}

class _PhotoViewerOverlayState extends State<_PhotoViewerOverlay>
    with SingleTickerProviderStateMixin {
  late AnimationController _bgController;
  late Animation<double> _bgOpacity;
  final TransformationController _transformController = TransformationController();

  @override
  void initState() {
    super.initState();
    _bgController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    );
    _bgOpacity = CurvedAnimation(parent: _bgController, curve: Curves.easeOut);
    _bgController.forward();
  }

  @override
  void dispose() {
    _bgController.dispose();
    _transformController.dispose();
    super.dispose();
  }

  void _close() {
    _bgController.reverse().then((_) {
      if (mounted) Navigator.of(context).pop();
    });
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _close,
      child: AnimatedBuilder(
        animation: _bgOpacity,
        builder: (_, child) => Container(
          color: Colors.black.withOpacity(0.92 * _bgOpacity.value),
          child: child,
        ),
        child: Stack(
          children: [
            // Pinch-to-zoom photo centered
            Center(
              child: Hero(
                tag: widget.heroTag,
                child: InteractiveViewer(
                  transformationController: _transformController,
                  panEnabled: true,
                  scaleEnabled: true,
                  minScale: 0.8,
                  maxScale: 4.0,
                  child: Image.network(
                    widget.imageUrl,
                    fit: BoxFit.contain,
                    loadingBuilder: (_, child, loadingProgress) {
                      if (loadingProgress == null) return child;
                      return const SizedBox(
                        width: 80,
                        height: 80,
                        child: Center(
                          child: CircularProgressIndicator(color: Colors.white),
                        ),
                      );
                    },
                    errorBuilder: (_, __, ___) => const Icon(
                      Icons.broken_image_rounded,
                      color: Colors.white54,
                      size: 80,
                    ),
                  ),
                ),
              ),
            ),
            // X close button — top right
            SafeArea(
              child: Align(
                alignment: Alignment.topRight,
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: GestureDetector(
                    onTap: _close,
                    child: Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.18),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.close_rounded,
                        color: Colors.white,
                        size: 20,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            // Hint text at bottom
            Positioned(
              bottom: 36,
              left: 0,
              right: 0,
              child: Center(
                child: Text(
                  'Pinch to zoom  •  Tap to close',
                  style: TextStyle(
                    color: Colors.white.withOpacity(0.45),
                    fontSize: 12,
                    letterSpacing: 0.3,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
