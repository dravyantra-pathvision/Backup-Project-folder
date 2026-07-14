import 'dart:math';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:file_picker/file_picker.dart';
import 'package:file_saver/file_saver.dart';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:path_provider/path_provider.dart';
import 'package:csv/csv.dart';
import 'package:share_plus/share_plus.dart';
import 'package:permission_handler/permission_handler.dart';
import '../models/engine.dart';
import '../core/theme.dart';
import '../core/dialogs.dart';
import '../models/city.dart';
import 'city_search_screen.dart';
import '../widgets/animated_widgets.dart';

class TripsScreen extends StatefulWidget {
  const TripsScreen({super.key});

  @override
  State<TripsScreen> createState() => _TripsScreenState();
}

class _TripsScreenState extends State<TripsScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  Trip? _selectedTrip;
  String _selectedFilter = 'All';

  Color _tripStatusColor(String status) {
    final normalized = status.trim().toLowerCase().replaceAll('_', ' ');
    if (normalized == 'completed') return AppTheme.ecoGreen;
    if (normalized == 'running') return Colors.blue;
    if (normalized == 'idle') return Colors.orange;
    if (normalized == 'pending' || normalized == 'not started') return Colors.orange;
    if (normalized == 'cancelled') return AppTheme.danger;
    return AppTheme.warning;
  }

  @override
  Widget build(BuildContext context) {
    final engine = context.watch<DataEngine>();
    final trips = engine.trips;
    final filteredTrips = trips.where((t) {
      if (_selectedFilter == 'All') return true;
      if (_selectedFilter == 'Assigned') {
        return t.status == 'pending' || t.status == 'not started';
      }
      if (_selectedFilter == 'Started') {
        return t.status == 'running' || t.status == 'idle';
      }
      if (_selectedFilter == 'Completed') {
        return t.status == 'completed' || t.tripCompleted == true;
      }
      return true;
    }).toList();
    // If another screen requested a trip to be highlighted, handle it once
    final String? highlighted = engine.highlightedTripId;
    if (highlighted != null && highlighted.isNotEmpty) {
      Trip? found;
      try {
        found = trips.firstWhere((t) => t.id == highlighted);
      } catch (e) {
        found = null;
      }
      if (found != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          setState(() => _selectedTrip = found);
          _scaffoldKey.currentState?.openEndDrawer();
          // clear request so we don't reopen repeatedly
          engine.highlightTrip(null);
        });
      }
    }
    final activeSelectedTrip = _selectedTrip == null
      ? null
      : trips.firstWhere(
        (trip) => trip.id == _selectedTrip!.id,
        orElse: () => _selectedTrip!,
        );

    int running = trips.where((t) => t.status == 'running').length;
    int completed = trips.where((t) => t.status == 'completed').length;
    int pending = trips.where((t) => t.status == 'pending').length;

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: Colors.transparent,
      endDrawer: () {
        if (activeSelectedTrip == null) return null;
        return _TripDetailDrawer(
          trip: activeSelectedTrip,
          onClose: () => Navigator.pop(context),
          onStatusUpdate: (status) {
            engine.updateTripStatus(activeSelectedTrip.id, status);
            Navigator.pop(context);
          },
        );
      }(),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
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
                    Text('Trip Management', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                    Text('Schedule, track, and optimize fleet journeys', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                  ],
                ),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.ecoGreen, foregroundColor: Colors.white),
                  onPressed: () => _showTripForm(context, engine), 
                  icon: const Icon(LucideIcons.plus, size: 14), 
                  label: const Text('New Trip')
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildAllKpis(trips, trips.length, running, completed, pending),
            const SizedBox(height: 16),
            _buildFilters(),
            const SizedBox(height: 16),
            _buildTripsGrid(context, filteredTrips),
          ],
        ),
      ),
    );
  }

  Widget _buildAllKpis(List<Trip> trips, int total, int running, int completed, int pending) {
    final engine = Provider.of<DataEngine>(context);
    final double totalFuelUsedLiters = trips.fold<double>(0.0, (sum, t) {
      if (t.status == 'pending' || t.status == 'not started') return sum;
      final dist = t.distance * t.progress;
      final mileage = t.defaultMileage > 0 ? t.defaultMileage : 4.0;
      return sum + (dist / mileage);
    });

    final int totalFuelWastedLiters = engine.lossLiters; // int liters from summary
    final double totalMoneyWasted = engine.loss; // double rupees from summary


    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: [
        _kpiCard('Total Trips', '$total', 'all time', AppTheme.ecoGreen),
        _kpiCard('Live Tracking', '$running', 'on road', Colors.blue),
        _kpiCard('Successful', '$completed', 'delivered', Colors.deepPurple),
        _kpiCard('Fuel Used', '${totalFuelUsedLiters.toStringAsFixed(1)} L', 'all trips', AppTheme.primaryBlue),
        _kpiCard('Fuel Wasted', '${totalFuelWastedLiters.toString()} L', 'all trips', AppTheme.danger),
        _kpiCard('Money Wasted', '₹${totalMoneyWasted.toStringAsFixed(2)}', 'all trips', AppTheme.danger),
      ],
    );
  }

  Widget _kpiCard(String title, String value, String subtitle, Color color) {
    return Container(
      width: 150,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withOpacity(0.1)),
        boxShadow: [BoxShadow(color: color.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
          const SizedBox(height: 8),
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
        ],
      ),
    );
  }

  Widget _buildTripsGrid(BuildContext context, List<Trip> trips) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 500,
        mainAxisSpacing: 16,
        crossAxisSpacing: 16,
        mainAxisExtent: 220,
      ),
      itemCount: trips.length,
      itemBuilder: (context, index) {
        final t = trips[index];
        final color = _tripStatusColor(t.status);

        return FadeSlideIn(
          index: index,
          child: AnimatedTapButton(
            onTap: () {
              setState(() => _selectedTrip = t);
              _scaffoldKey.currentState?.openEndDrawer();
              final engine = context.read<DataEngine>();
              engine.refreshData().then((_) {
                if (mounted && _selectedTrip?.id == t.id) {
                  final refreshedTrip = engine.trips.firstWhere(
                    (trip) => trip.id == t.id,
                    orElse: () => t,
                  );
                  setState(() => _selectedTrip = refreshedTrip);
                }
              });
            },
            child: Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(color: color.withOpacity(0.15)),
              ),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(6)),
                              child: Text(t.id, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: color)),
                            ),
                            if (t.delayMinutes > 0) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(color: AppTheme.danger, borderRadius: BorderRadius.circular(4)),
                                child: Text('DELAY ${t.delayMinutes}M', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                              ),
                            ],
                          ],
                        ),
                        Row(
                          children: [
                            if (t.status != 'completed' && t.tripCompleted != true) ...[
                              AnimatedTapButton(
                                onTap: () {
                                  showDialog(
                                    context: context,
                                    builder: (ctx) => _TripFormDialog(engine: context.read<DataEngine>(), trip: t),
                                  );
                                },
                                child: const Padding(
                                  padding: EdgeInsets.all(6),
                                  child: Icon(LucideIcons.edit2, size: 14, color: AppTheme.textSecondary),
                                ),
                              ),
                              const SizedBox(width: 4),
                            ],
                            _Badge(label: t.status.toUpperCase(), color: color),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text('${t.from != null && t.from.isNotEmpty ? t.from : '—'} → ${t.to != null && t.to.isNotEmpty ? t.to : '—'}', style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(LucideIcons.user, size: 12, color: AppTheme.textSecondary),
                        const SizedBox(width: 4),
                        Flexible(child: Text(t.driver, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary), overflow: TextOverflow.ellipsis)),
                        const SizedBox(width: 12),
                        const Icon(LucideIcons.truck, size: 12, color: AppTheme.textSecondary),
                        const SizedBox(width: 4),
                        Flexible(child: Text(t.vehicle, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary), overflow: TextOverflow.ellipsis)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Spacer(),
                    if (t.status == 'running') ...[
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Trip Progress', style: TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                          Text('${(t.progress * 100).toInt()}%', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.blue)),
                        ],
                      ),
                      const SizedBox(height: 6),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(4),
                        child: LinearProgressIndicator(value: t.progress, backgroundColor: Colors.blue.withOpacity(0.1), color: Colors.blue, minHeight: 6),
                      ),
                    ] else ...[
                      Row(
                        children: [
                          const Icon(LucideIcons.box, size: 12, color: AppTheme.textSecondary),
                          const SizedBox(width: 6),
                          Text(t.load, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildFilters() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: _selectedFilter,
          icon: const Icon(LucideIcons.filter, size: 16, color: AppTheme.textSecondary),
          elevation: 16,
          style: const TextStyle(color: AppTheme.textPrimary, fontSize: 13, fontWeight: FontWeight.bold),
          onChanged: (String? newValue) {
            if (newValue != null) {
              setState(() {
                _selectedFilter = newValue;
              });
            }
          },
          items: <String>['All', 'Assigned', 'Started', 'Completed']
              .map<DropdownMenuItem<String>>((String value) {
            return DropdownMenuItem<String>(
              value: value,
              child: Text('Filter Trips: $value'),
            );
          }).toList(),
        ),
      ),
    );
  }

  void _showTripForm(BuildContext context, DataEngine engine) {
    showDialog(
      context: context,
      builder: (context) => _TripFormDialog(engine: engine),
    );
  }
}

class _TripFormDialog extends StatefulWidget {
  final DataEngine engine;
  final Trip? trip;
  const _TripFormDialog({required this.engine, this.trip});

  @override
  State<_TripFormDialog> createState() => _TripFormDialogState();
}

class _TripFormDialogState extends State<_TripFormDialog> {
  final _formKey = GlobalKey<FormState>();
  String? _selectedVehicle;
  String? _selectedDriver;
  final _fromCtrl = TextEditingController();
  final _toCtrl = TextEditingController();
  final _ewayCtrl = TextEditingController();
  bool _ewayUploaded = false;
  bool _ewayUploading = false;
  String? _ewayFileUrl;
  City? _fromCity;
  City? _toCity;
  double? _calculatedDistance;
  bool _isCalculatingDistance = false;

  Future<void> _updateDistance() async {
    if (_fromCity != null && _toCity != null) {
      final lat1 = _fromCity!.latitude;
      final lon1 = _fromCity!.longitude;
      final lat2 = _toCity!.latitude;
      final lon2 = _toCity!.longitude;

      if (lat1 != null && lon1 != null && lat2 != null && lon2 != null) {
        setState(() => _isCalculatingDistance = true);

        try {
          final uri = Uri.parse('http://router.project-osrm.org/route/v1/driving/$lon1,$lat1;$lon2,$lat2?overview=false');
          final response = await http.get(uri);
          
          if (response.statusCode == 200) {
            final data = jsonDecode(response.body);
            if (data['routes'] != null && data['routes'].isNotEmpty) {
              final distanceMeters = data['routes'][0]['distance'];
              setState(() {
                _calculatedDistance = double.parse((distanceMeters / 1000.0).toStringAsFixed(1));
                _isCalculatingDistance = false;
              });
              return;
            }
          }
        } catch (e) {
          debugPrint('OSRM API Error: $e');
        }

        // Fallback: Haversine distance
        const r = 6371.0; // Earth radius in km
        final dLat = (lat2 - lat1) * (pi / 180.0);
        final dLon = (lon2 - lon1) * (pi / 180.0);
        final a = sin(dLat / 2) * sin(dLat / 2) +
            cos(lat1 * (pi / 180.0)) * cos(lat2 * (pi / 180.0)) * sin(dLon / 2) * sin(dLon / 2);
        final c = 2 * atan2(sqrt(a), sqrt(1 - a));
        setState(() {
          _calculatedDistance = double.parse((r * c).toStringAsFixed(1));
          _isCalculatingDistance = false;
        });
      } else {
        // Fallback distance calculation
        final fromHash = _fromCity!.name.hashCode;
        final toHash = _toCity!.name.hashCode;
        final dist = (fromHash - toHash).abs() % 600 + 150;
        setState(() {
          _calculatedDistance = dist.toDouble();
          _isCalculatingDistance = false;
        });
      }
    }
  }

  @override
  void initState() {
    super.initState();
    if (widget.trip != null) {
      _selectedVehicle = widget.trip!.vehicle;
      _selectedDriver = widget.trip!.driver;
      _fromCtrl.text = widget.trip!.from;
      _toCtrl.text = widget.trip!.to;
      _ewayCtrl.text = widget.trip!.ewayBill;
      _ewayUploaded = widget.trip!.ewayBill.isNotEmpty;
      _ewayFileUrl = widget.trip!.ewayBillUrl;
      _calculatedDistance = widget.trip!.distance;
    }
    // Fetch available lists (do not overwrite master lists) so we can mark unavailable items
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final availDrivers = await widget.engine.fetchAvailableDrivers();
      final availVehicles = await widget.engine.fetchAvailableVehicles();
      setState(() {
        _availableDriverNames = availDrivers.map((d) => d.name.trim().toLowerCase()).toSet();
        _availableVehiclePlates = availVehicles.map((v) => v.plate.trim().toUpperCase()).toSet();
      });
    });
  }

  Set<String> _availableDriverNames = {};
  Set<String> _availableVehiclePlates = {};

  List<City> _getRecentCities() {
    final trips = widget.engine.trips;
    final Map<String, City> uniqueCities = {};
    for (final t in trips.reversed) {
      if (t.from.isNotEmpty && !uniqueCities.containsKey(t.from)) {
        uniqueCities[t.from] = City(name: t.from, state: '', latitude: null, longitude: null);
      }
      if (t.to.isNotEmpty && !uniqueCities.containsKey(t.to)) {
        uniqueCities[t.to] = City(name: t.to, state: '', latitude: null, longitude: null);
      }
      if (uniqueCities.length > 5) break;
    }
    return uniqueCities.values.toList();
  }

  Widget _buildUploadRow(String label, bool isUploaded, bool isUploading, VoidCallback onUpload) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final showInline = constraints.maxWidth > 350;
          final button = ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: isUploaded ? AppTheme.success.withOpacity(0.1) : null,
              foregroundColor: isUploaded ? AppTheme.success : null,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            ),
            icon: isUploading
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : Icon(isUploaded ? LucideIcons.checkCircle : LucideIcons.upload, size: 16),
            label: Text(
              isUploading ? 'Uploading...' : isUploaded ? 'Uploaded' : 'Upload File',
              style: const TextStyle(fontSize: 12),
            ),
            onPressed: isUploading ? null : onUpload,
          );

          if (showInline) {
            return Row(
              children: [
                Expanded(child: Text(label, style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary))),
                const SizedBox(width: 8),
                button,
              ],
            );
          } else {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(label, style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary)),
                const SizedBox(height: 6),
                button,
              ],
            );
          }
        },
      ),
    );
  }

  Future<void> _pickAndUpload(String docType) async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.any,
        withData: true,
      );
      if (result == null || result.files.isEmpty) return;

      final file = result.files.first;
      var bytes = file.bytes;
      if (bytes == null && file.path != null) {
        bytes = await File(file.path!).readAsBytes();
      }
      if (bytes == null) return;

      final fileName = 'eway_${_ewayCtrl.text.trim().isNotEmpty ? _ewayCtrl.text.trim() : DateTime.now().millisecondsSinceEpoch.toString()}.${file.extension}';

      setState(() {
        if (docType == 'eway') _ewayUploading = true;
      });

      // Upload via backend
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${widget.engine.baseUrl}/api/upload?bucket=trip_docs'),
      );
      final user = FirebaseAuth.instance.currentUser;
      final token = await user?.getIdToken();
      request.headers['Authorization'] = 'Bearer $token';
      request.files.add(http.MultipartFile.fromBytes(
        'file',
        bytes,
        filename: fileName,
      ));
      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode != 200) {
        throw Exception('Server error: ${response.body}');
      }

      final Map<String, dynamic> responseData = json.decode(response.body);
      final String url = responseData['url'] ?? '';

      setState(() {
        if (docType == 'eway') { _ewayFileUrl = url; _ewayUploaded = true; _ewayUploading = false; }
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('e-Way Bill uploaded successfully!'), backgroundColor: AppTheme.success),
        );
      }
    } catch (e) {
      setState(() {
        if (docType == 'eway') _ewayUploading = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e'), backgroundColor: AppTheme.danger),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // Build vehicle items: exclude vehicles already assigned to active trips
    final allVehicles = widget.engine.vehicles.toList();
    final assignedVehiclePlates = widget.engine.trips.where((t) => t.tripCompleted != true && t.status != 'completed' && t.vehicle.isNotEmpty).map((t) => t.vehicle.trim().toUpperCase()).toSet();
    final displayedVehicles = allVehicles.where((v) {
      final plate = v.plate.trim().toUpperCase();
      if (widget.trip != null && widget.trip!.vehicle == v.plate) return true;
      if (_availableVehiclePlates.isNotEmpty && !_availableVehiclePlates.contains(plate)) return false;
      if (assignedVehiclePlates.contains(plate)) return false;
      return true;
    }).toList();

    // Build driver items: exclude drivers assigned to active trips
    final allDrivers = widget.engine.drivers.toList();
    final assignedDriverNames = widget.engine.trips.where((t) => t.tripCompleted != true && t.status != 'completed' && t.driver.isNotEmpty).map((t) => t.driver.trim().toLowerCase()).toSet();
    final displayedDrivers = allDrivers.where((d) {
      final name = d.name.trim().toLowerCase();
      if (widget.trip != null && widget.trip!.driver == d.name) return true;
      if (_availableDriverNames.isNotEmpty && !_availableDriverNames.contains(name)) return false;
      if (assignedDriverNames.contains(name)) return false;
      return true;
    }).toList();

    return AlertDialog(
      title: Text(widget.trip == null ? 'Schedule New Trip' : 'Edit Trip Details'),
      content: SizedBox(
        width: min(500, MediaQuery.of(context).size.width * 0.9),
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                DropdownButtonFormField<String>(
                  value: _selectedVehicle,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Select Vehicle'),
                  items: displayedVehicles.map((v) {
                    return DropdownMenuItem<String>(
                      value: v.plate,
                      child: Text('${v.plate} (${v.type})', overflow: TextOverflow.ellipsis),
                    );
                  }).toList(),
                  onChanged: (val) => setState(() => _selectedVehicle = val),
                  validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _selectedDriver,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Select Driver'),
                  items: displayedDrivers.map((d) {
                    return DropdownMenuItem<String>(
                      value: d.name,
                      child: Text(d.name, overflow: TextOverflow.ellipsis),
                    );
                  }).toList(),
                  onChanged: (val) => setState(() => _selectedDriver = val),
                  validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          TextFormField(
                            controller: _fromCtrl,
                            readOnly: true,
                            onTap: () async {
                              final City? selected = await Navigator.push<City>(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => CitySearchScreen(
                                    title: 'Leaving From',
                                    recentCities: _getRecentCities(),
                                  ),
                                ),
                              );
                              if (selected != null) {
                                setState(() {
                                  _fromCity = selected;
                                  _fromCtrl.text = selected.name;
                                  _updateDistance();
                                });
                              }
                            },
                            decoration: InputDecoration(
                              hintText: 'Leaving From',
                              hintStyle: TextStyle(color: Colors.grey.shade500, fontSize: 15),
                              prefixIcon: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Icon(LucideIcons.navigation, size: 20, color: Colors.grey.shade700),
                              ),
                              border: InputBorder.none,
                              contentPadding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
                            ),
                            validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                          ),
                          Divider(height: 1, thickness: 1, color: Colors.grey.shade200, indent: 16, endIndent: 16),
                          TextFormField(
                            controller: _toCtrl,
                            readOnly: true,
                            onTap: () async {
                              final City? selected = await Navigator.push<City>(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => CitySearchScreen(
                                    title: 'Going To',
                                    recentCities: _getRecentCities(),
                                  ),
                                ),
                              );
                              if (selected != null) {
                                setState(() {
                                  _toCity = selected;
                                  _toCtrl.text = selected.name;
                                  _updateDistance();
                                });
                              }
                            },
                            decoration: InputDecoration(
                              hintText: 'Going To',
                              hintStyle: TextStyle(color: Colors.grey.shade500, fontSize: 15),
                              prefixIcon: Padding(
                                padding: const EdgeInsets.all(12),
                                child: Icon(LucideIcons.mapPin, size: 20, color: Colors.grey.shade700),
                              ),
                              border: InputBorder.none,
                              contentPadding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
                            ),
                            validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                          ),
                        ],
                      ),
                    ),
                    Positioned(
                      right: -6,
                      top: 0,
                      bottom: 0,
                      child: Center(
                        child: GestureDetector(
                          onTap: () {
                            setState(() {
                              final tmpCity = _fromCity;
                              _fromCity = _toCity;
                              _toCity = tmpCity;

                              final tmp = _fromCtrl.text;
                              _fromCtrl.text = _toCtrl.text;
                              _toCtrl.text = tmp;
                              _updateDistance();
                            });
                          },
                          child: Container(
                            width: 36,
                            height: 36,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                              border: Border.all(color: Colors.grey.shade300),
                              boxShadow: [
                                BoxShadow(color: Colors.black.withOpacity(0.06), blurRadius: 4, offset: const Offset(0, 2)),
                              ],
                            ),
                            child: Icon(LucideIcons.arrowUpDown, size: 16, color: Colors.grey.shade700),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                if (_isCalculatingDistance || _calculatedDistance != null) ...[
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: AppTheme.ecoGreen.withOpacity(0.05),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: AppTheme.ecoGreen.withOpacity(0.2)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.route, size: 20, color: AppTheme.ecoGreen),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Text(
                            'Calculated Distance', 
                            style: TextStyle(color: AppTheme.textSecondary),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 8),
                        if (_isCalculatingDistance)
                          const SizedBox(
                            width: 16, 
                            height: 16, 
                            child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.ecoGreen)
                          )
                        else
                          Text(
                            '$_calculatedDistance km', 
                            style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.ecoGreen, fontSize: 16),
                          ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                TextFormField(
                  controller: _ewayCtrl,
                  decoration: const InputDecoration(labelText: 'e-Way Bill Number'),
                  keyboardType: TextInputType.number,
                  maxLength: 12,
                  validator: (v) {
                    if (v == null || v.isEmpty) return null;
                    if (v.length != 12) return 'Must be exactly 12 digits';
                    if (!RegExp(r'^\d+$').hasMatch(v)) return 'Must be numeric';
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                _buildUploadRow('e-Way Bill Document', _ewayUploaded, _ewayUploading, () => _pickAndUpload('eway')),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel', style: TextStyle(color: AppTheme.textSecondary))),
        ElevatedButton(
          onPressed: () async {
            if (_formKey.currentState!.validate()) {
              if (widget.trip == null) {
                widget.engine.addTrip(Trip(
                  id: 'TRP-${DateTime.now().millisecondsSinceEpoch.toString().substring(5)}',
                  vehicle: _selectedVehicle ?? '',
                  driver: _selectedDriver ?? '',
                  from: _fromCtrl.text,
                  to: _toCtrl.text,
                  load: 'General Cargo',
                  client: 'New Client',
                  status: 'not started', // Keep status default as not started!
                  ewayBill: _ewayCtrl.text,
                  ewayBillUrl: _ewayFileUrl ?? '',
                  date: DateTime.now().toString().split(' ')[0],
                  progress: 0.0,
                  distance: _calculatedDistance ?? 0.0,
                  waypoints: [],
                  tollCount: 0,
                  liveSpeed: 0.0,
                  power: false,
                  idleDuration: 0,
                  tripCompleted: false,
                ));
                widget.engine.assignVehicle(_selectedDriver!, _selectedVehicle!);
              } else {
                widget.engine.updateTrip(widget.trip!.copyWith(
                  vehicle: _selectedVehicle,
                  driver: _selectedDriver,
                  from: _fromCtrl.text,
                  to: _toCtrl.text,
                  ewayBill: _ewayCtrl.text,
                  ewayBillUrl: _ewayFileUrl ?? widget.trip!.ewayBillUrl,
                  distance: _calculatedDistance,
                ));
              }
              if (mounted) {
                await DialogUtils.showSuccessAnimation(context, widget.trip == null ? 'Trip Created!' : 'Trip Updated!');
                if (mounted) Navigator.pop(context);
              }
            }
          },
          style: ElevatedButton.styleFrom(backgroundColor: AppTheme.ecoGreen, foregroundColor: Colors.white),
          child: Text(widget.trip == null ? 'Dispatch' : 'Save'),
        ),
      ],
    );
  }
}

class _TripDetailDrawer extends StatelessWidget {
  final Trip trip;
  final VoidCallback onClose;
  final Function(String) onStatusUpdate;

  const _TripDetailDrawer({
    required this.trip, 
    required this.onClose, 
    required this.onStatusUpdate,
  });

  String _generateCsv(String idleFuelLitersText, double idleMoney, double speedingFuelLoss, double speedingMoneyLoss, double theftFuel, double theftMoney) {
    List<List<dynamic>> rows = [
      ['Trip Report'],
      ['ID', trip.id],
      ['Status', trip.status],
      ['From', trip.from],
      ['To', trip.to],
      ['Vehicle', trip.vehicle],
      ['Driver', trip.driver],
      ['Client', trip.client],
      ['Load', trip.load],
      ['e-Way Bill', trip.ewayBill],
      ['Date', trip.date],
      ['Distance (km)', trip.distance],
      ['Fuel Used (L)', ((trip.distance * trip.progress) / (trip.defaultMileage > 0 ? trip.defaultMileage : 4.0)).toStringAsFixed(1)],
      ['Default Mileage (km/l)', trip.defaultMileage.toStringAsFixed(1)],
      ['Current Mileage (km/l)', trip.currentMileage.toStringAsFixed(1)],
      ['Fuel Saved (L)', trip.fuelSaved.toStringAsFixed(1)],
      ['Money Saved (INR)', trip.moneySaved.toStringAsFixed(2)],
      ['Money Wasted (INR)', trip.moneyWasted.toStringAsFixed(2)],
      ['Fuel Wasted (L)', trip.fuelWasted.toStringAsFixed(1)],
      ['Tolls Passed', trip.tollCount],
      ['Idle Fuel Wasted', idleFuelLitersText],
      ['Idle Money Wasted (INR)', idleMoney.toStringAsFixed(2)],
      ['Speeding Fuel Loss (L)', speedingFuelLoss.toStringAsFixed(2)],
      ['Speeding Money Loss (INR)', speedingMoneyLoss.toStringAsFixed(2)],
      ['Theft Fuel Loss (L)', theftFuel.toStringAsFixed(2)],
      ['Theft Money Loss (INR)', theftMoney.toStringAsFixed(2)],
    ];
    return const ListToCsvConverter().convert(rows);
  }

  @override
  Widget build(BuildContext context) {
    final normalized = trip.status.trim().toLowerCase().replaceAll('_', ' ');
    final color = normalized == 'completed'
      ? AppTheme.ecoGreen
      : normalized == 'running'
        ? Colors.blue
        : normalized == 'idle' || normalized == 'pending' || normalized == 'not started'
          ? Colors.orange
          : normalized == 'cancelled'
            ? AppTheme.danger
            : AppTheme.warning;

    final int hours = trip.idleDuration ~/ 3600;
    final int minutes = (trip.idleDuration % 3600) ~/ 60;
    final int seconds = trip.idleDuration % 60;
    final String idleStr = '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';

    // All trip status values are sourced from the trips table record for this trip.
    final double idleMoney = trip.idleMoneyWasted;
    // Idle Fuel Wasted must be taken from the trip's `idle_money_wasted` column
    // and displayed as `idle_money_wasted / 100` (liters) per spec.
    final String idleFuelLitersText = '${trip.idleFuelWasted.toStringAsFixed(2)} L';
    final double speedingFuelLoss = trip.speedingFuelLoss;
    final double speedingMoneyLoss = speedingFuelLoss * 100.0;
    final double theftFuel = trip.theftFuelLoss;
    final double theftMoney = trip.theftMoneyLoss;

    return Drawer(
      width: 450,
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
                    Text(trip.id, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                    Row(
                      children: [
                        IconButton(
                          icon: const Icon(LucideIcons.trash2, color: Colors.white),
                          onPressed: () async {
                            final engine = Provider.of<DataEngine>(context, listen: false);
                            final confirm = await showDialog<bool>(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('Delete Trip'),
                                content: const Text('Are you sure you want to delete this trip? This action cannot be undone.'),
                                actions: [
                                  TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                                  ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
                                ],
                              ),
                            );
                            if (confirm == true) {
                              final success = await engine.removeTrip(trip.id);
                              if (success) {
                                if (Navigator.canPop(context)) Navigator.pop(context); // close drawer
                                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${trip.id} deleted')));
                              } else {
                                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Failed to delete ${trip.id}')));
                              }
                            }
                          },
                        ),
                        if (normalized == 'completed') ...[
                          IconButton(
                            icon: const Icon(LucideIcons.download, color: Colors.white),
                            onPressed: () async {
                              final csv = _generateCsv(idleFuelLitersText, idleMoney, speedingFuelLoss, speedingMoneyLoss, theftFuel, theftMoney);
                              try {
                                String? path = await FileSaver.instance.saveAs(
                                  name: 'trip_${trip.id}',
                                  ext: 'csv',
                                  bytes: Uint8List.fromList(utf8.encode(csv)),
                                  mimeType: MimeType.csv,
                                );

                                if (context.mounted && path != null) {
                                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Saved to: $path')));
                                }
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error saving: $e')));
                                }
                              }
                            },
                          ),
                          IconButton(
                            icon: const Icon(LucideIcons.share2, color: Colors.white),
                            onPressed: () async {
                              final csv = _generateCsv(idleFuelLitersText, idleMoney, speedingFuelLoss, speedingMoneyLoss, theftFuel, theftMoney);
                              try {
                                final dir = await getTemporaryDirectory();
                                final path = '${dir.path}/trip_${trip.id}.csv';
                                final file = File(path);
                                await file.writeAsString(csv);
                                await Share.shareXFiles([XFile(path)], text: 'Trip Report ${trip.id}');
                              } catch (e) {
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error generating report: $e')));
                                }
                              }
                            },
                          ),
                        ] else
                          IconButton(onPressed: onClose, icon: const Icon(Icons.close, color: Colors.white)),
                      ],
                    ),
                  ],
                ),
                  Text('${trip.from != null && trip.from.isNotEmpty ? trip.from : '—'} → ${trip.to != null && trip.to.isNotEmpty ? trip.to : '—'}', style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 16)),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: Colors.white.withOpacity(0.5)),
                  ),
                  child: Text(
                    trip.status.toUpperCase(),
                    style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                const Text('TRIP INFORMATION', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textSecondary)),
                const SizedBox(height: 16),
                _InfoRow(label: 'Client', value: trip.client, icon: LucideIcons.briefcase),
                _InfoRow(label: 'Load Description', value: trip.load, icon: LucideIcons.box),
                _InfoRow(label: 'e-Way Bill', value: trip.ewayBill, icon: LucideIcons.fileText),
                _InfoRow(label: 'Date', value: trip.date, icon: LucideIcons.calendar),
                _InfoRow(label: 'Total Distance', value: '${trip.distance} km', icon: Icons.route),
                _InfoRow(label: 'Distance Covered', value: '${(trip.distance * trip.progress).toStringAsFixed(1)} km', icon: LucideIcons.navigation),
                _InfoRow(label: 'Remaining Distance', value: '${(trip.distance * (1.0 - trip.progress)).toStringAsFixed(1)} km', icon: LucideIcons.map),
                _InfoRow(
                  label: 'Fuel Used', 
                  value: '${(trip.status == 'pending' || trip.status == 'not started') ? '0.0' : ((trip.distance * trip.progress) / (trip.defaultMileage > 0 ? trip.defaultMileage : 4.0)).toStringAsFixed(1)} L', 
                  icon: LucideIcons.fuel,
                ),
                _InfoRow(label: 'Default Mileage', value: '${trip.defaultMileage.toStringAsFixed(1)} km/l', icon: LucideIcons.gauge),
                _InfoRow(label: 'Current Mileage', value: '${trip.currentMileage.toStringAsFixed(1)} km/l', icon: LucideIcons.activity),
                _InfoRow(label: 'Fuel Saved', value: '${trip.fuelSaved.toStringAsFixed(1)} L', icon: LucideIcons.feather),
                _InfoRow(label: 'Money Saved', value: '₹${trip.moneySaved.toStringAsFixed(2)}', icon: LucideIcons.coins),
                _InfoRow(label: 'Money Wasted', value: '₹${trip.moneyWasted.toStringAsFixed(2)}', icon: LucideIcons.x),
                _InfoRow(label: 'Fuel Wasted', value: '${trip.fuelWasted.toStringAsFixed(1)} L', icon: LucideIcons.droplets),
                _InfoRow(label: 'Tolls Passed', value: '${trip.tollCount}', icon: LucideIcons.creditCard),
                const Divider(height: 32),
                const Text('IDLE STATUS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textSecondary)),
                const SizedBox(height: 16),
                _InfoRow(label: 'Idle Fuel Wasted', value: idleFuelLitersText, icon: LucideIcons.droplets),
                _InfoRow(label: 'Idle Money Wasted', value: '₹${idleMoney.toStringAsFixed(2)}', icon: LucideIcons.coins),
                const Divider(height: 32),
                const Text('OVERSPEEDING STATUS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textSecondary)),
                const SizedBox(height: 16),
                _InfoRow(label: 'Speeding Fuel Loss', value: '${speedingFuelLoss.toStringAsFixed(2)} L', icon: LucideIcons.rocket),
                _InfoRow(label: 'Speeding Money Loss', value: '₹${speedingMoneyLoss.toStringAsFixed(2)}', icon: LucideIcons.trendingDown),
                const Divider(height: 32),
                const Text('FUEL THEFT STATUS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textSecondary)),
                const SizedBox(height: 16),
                _InfoRow(label: 'Theft Fuel Loss', value: '${theftFuel.toStringAsFixed(2)} L', icon: LucideIcons.shield),
                _InfoRow(label: 'Theft Money Loss', value: '₹${theftMoney.toStringAsFixed(2)}', icon: LucideIcons.shieldOff),
                const Divider(height: 32),
                const Text('ASSETS ASSIGNED', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textSecondary)),
                const SizedBox(height: 16),
                 _InfoRow(label: 'Vehicle', value: trip.vehicle, icon: LucideIcons.truck),
                 _InfoRow(label: 'Driver', value: trip.driver, icon: LucideIcons.user),
                 if (trip.ewayBillUrl.isNotEmpty) ...[
                   const Divider(height: 32),
                   const Text('E-WAY BILL DOCUMENT', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textSecondary)),
                   const SizedBox(height: 16),
                   ClipRRect(
                     borderRadius: BorderRadius.circular(8),
                     child: Image.network(
                       trip.ewayBillUrl,
                       height: 200,
                       width: double.infinity,
                       fit: BoxFit.cover,
                       errorBuilder: (context, error, stackTrace) {
                         return Container(
                           height: 100,
                           color: Colors.grey.shade100,
                           alignment: Alignment.center,
                           child: const Text('Cannot load e-Way Bill image', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                         );
                       },
                     ),
                   ),
                 ],
                const Divider(height: 48),
                if (trip.status == 'pending' || trip.status == 'not started')
                  ElevatedButton(
                    onPressed: () => onStatusUpdate('running'),
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.blue, foregroundColor: Colors.white, minimumSize: const Size(double.infinity, 50)),
                    child: const Text('Start Trip'),
                  ),
                if (trip.status == 'running' || trip.status == 'idle') ...[
                  ElevatedButton(
                    onPressed: () => onStatusUpdate('paused'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppTheme.warning, foregroundColor: Colors.white, minimumSize: const Size(double.infinity, 50)),
                    child: const Text('Stop Vehicle (Pause Trip)'),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: () => onStatusUpdate('completed'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppTheme.ecoGreen, foregroundColor: Colors.white, minimumSize: const Size(double.infinity, 50)),
                    child: const Text('Mark as Completed'),
                  ),
                ],
                if (trip.status == 'paused') ...[
                  ElevatedButton(
                    onPressed: () => onStatusUpdate('running'),
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.blue, foregroundColor: Colors.white, minimumSize: const Size(double.infinity, 50)),
                    child: const Text('Resume Trip'),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: () => onStatusUpdate('completed'),
                    style: ElevatedButton.styleFrom(backgroundColor: AppTheme.ecoGreen, foregroundColor: Colors.white, minimumSize: const Size(double.infinity, 50)),
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
}

class _Badge extends StatelessWidget {
  final String label;
  final Color color;
  final Color? textColor;
  const _Badge({required this.label, required this.color, this.textColor});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(4), border: Border.all(color: color.withOpacity(0.2))),
      child: Text(label, style: TextStyle(color: textColor ?? color, fontSize: 10, fontWeight: FontWeight.bold)),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? valueColor;
  const _InfoRow({required this.label, required this.value, required this.icon, this.valueColor});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppTheme.textSecondary),
          const SizedBox(width: 12),
          Expanded(child: Text(label, style: const TextStyle(color: AppTheme.textSecondary))),
          Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: valueColor ?? AppTheme.textPrimary)),
        ],
      ),
    );
  }
}

class _TripStatusCard extends StatelessWidget {
  final String title;
  final Color accent;
  final List<Widget> children;
  final double width;
  const _TripStatusCard({required this.title, required this.accent, required this.children, this.width = 300});
  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      child: Card(
        color: AppTheme.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(color: accent, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 8),
                  Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
                ],
              ),
              const SizedBox(height: 12),
              ...children,
            ],
          ),
        ),
      ),
    );
  }
}
