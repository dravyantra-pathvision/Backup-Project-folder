import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:io';
import '../models/engine.dart';
import '../core/theme.dart';
import '../core/dialogs.dart';
import 'package:fl_chart/fl_chart.dart';
import '../widgets/animated_widgets.dart';

class DriversScreen extends StatefulWidget {
  const DriversScreen({super.key});

  @override
  State<DriversScreen> createState() => _DriversScreenState();
}

class _DriversScreenState extends State<DriversScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  Driver? _detailDriver;
  final ScrollController _tableScrollController = ScrollController();

  @override
  Widget build(BuildContext context) {
    final engine = context.watch<DataEngine>();
    final drivers = engine.drivers;
    final sortedDrivers = List<Driver>.from(drivers)..sort((a, b) => b.score.compareTo(a.score));
    final atRisk = drivers.where((d) => d.score < 60).toList();
    
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: Colors.transparent,
      endDrawer: _detailDriver != null 
        ? _DriverDetailDrawer(
            driver: _detailDriver!, 
            onClose: () => Navigator.pop(context),
            onDeactivate: () {
              engine.deactivateDriver(_detailDriver!.id);
              Navigator.pop(context);
            },
          ) 
        : null,
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
                    Text('Driver Management', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                    Text('Performance scores, compliance & licensing', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                  ],
                ),
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white),
                  onPressed: () => _showDriverForm(context, engine), 
                  icon: const Icon(LucideIcons.plus, size: 14), 
                  label: const Text('Add Driver')
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildKpis(drivers),
            const SizedBox(height: 16),
            TweenAnimationBuilder<double>(
              tween: Tween<double>(begin: 0.0, end: 1.0),
              duration: const Duration(milliseconds: 600),
              curve: Curves.easeOutCubic,
              builder: (context, val, child) {
                return Transform.translate(
                  offset: Offset(0, 20 * (1.0 - val)),
                  child: Opacity(opacity: val, child: child),
                );
              },
              child: _buildLeaderboardTable(context, sortedDrivers),
            ),
            const SizedBox(height: 16),
            _buildCoachingSuggestions(atRisk),
          ],
        ),
      ),
    );
  }

  Widget _buildKpis(List<Driver> drivers) {
    final engine = context.read<DataEngine>();
    bool isAssigned(Driver d) => d.vehicle.isNotEmpty && d.vehicle != 'None' && d.vehicle != 'Unassigned';
    int onDuty = drivers.where((d) {
      if (!d.isActive) return false;
      // consider driver active if they have an active trip (by id or name)
      final hasActiveTrip = engine.trips.any((t) {
        final driverKey = (t.driver ?? '').toString().trim().toLowerCase();
        final matchId = d.id.trim().toLowerCase();
        final matchName = d.name.trim().toLowerCase();
        final activeByStatus = (t.tripCompleted != true) && (t.status != 'completed') && (t.status != 'cancelled');
        return activeByStatus && (driverKey == matchId || driverKey == matchName);
      });
      return hasActiveTrip || isAssigned(d);
    }).length;
    int atRisk = drivers.where((d) => d.score < 60 && d.isActive).length;
    int avgScore = drivers.isEmpty ? 0 : drivers.map((d) => d.score).reduce((a, b) => a + b) ~/ drivers.length;

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          _kpiCard('Total Drivers', '${drivers.length}', 'enrolled', AppTheme.primaryBlue),
          const SizedBox(width: 12),
          _kpiCard('On Duty Now', '$onDuty', 'active', AppTheme.success),
        ],
      ),
    );
  }

  Widget _kpiCard(String title, String value, String subtitle, Color color) {
    return Container(
      width: 150,
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
          Text(value, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: color)),
          const SizedBox(height: 4),
          Text(subtitle, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
        ],
      ),
    );
  }

  Widget _buildLeaderboardTable(BuildContext context, List<Driver> drivers) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final engine = context.read<DataEngine>();
          return Scrollbar(
            controller: _tableScrollController,
            thumbVisibility: true,
            child: SingleChildScrollView(
              controller: _tableScrollController,
              scrollDirection: Axis.horizontal,
              child: ConstrainedBox(
                constraints: BoxConstraints(minWidth: constraints.maxWidth),
                child: DataTable(
                  columnSpacing: 20,
                  horizontalMargin: 12,
                  headingTextStyle: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textSecondary),
                  columns: const [
                    DataColumn(label: Text('Rank')),
                    DataColumn(label: Text('Name')),
                    DataColumn(label: Text('Score')),
                    DataColumn(label: Text('Trips')),
                    DataColumn(label: Text('View / Edit / Remove')),
                  ],
                  rows: drivers.asMap().entries.map((entry) {
                    final index = entry.key;
                    final d = entry.value;
                    return DataRow(cells: [
                      DataCell(Text('#${index + 1}', style: const TextStyle(fontWeight: FontWeight.bold))),
                      DataCell(Text(d.name)),
                      DataCell(Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(color: (d.score >= 75 ? AppTheme.success : d.score >= 55 ? AppTheme.warning : AppTheme.danger).withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                        child: Text('${d.score}', style: TextStyle(color: d.score >= 75 ? AppTheme.success : d.score >= 55 ? AppTheme.warning : AppTheme.danger, fontWeight: FontWeight.bold)),
                      )),
                      DataCell(Text('${d.trips}')),
                      DataCell(Row(
                        children: [
                          IconButton(
                            icon: const Icon(LucideIcons.eye, size: 18), 
                            onPressed: () {
                              showDialog(
                                context: context,
                                builder: (context) => AlertDialog(
                                  title: Text(d.name),
                                  content: Text('Phone: ${d.phone}\nAge: ${d.age}\nExperience: ${d.exp} years\nLicense: ${d.lic}'),
                                  actions: [
                                    TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
                                  ],
                                ),
                              );
                            }
                          ),
                          IconButton(
                            icon: const Icon(LucideIcons.edit2, size: 18), 
                            onPressed: () => _showDriverForm(context, engine, d: d)
                          ),
                          IconButton(
                            icon: const Icon(LucideIcons.trash2, size: 18, color: AppTheme.danger), 
                            onPressed: () async {
                              final hasStartedTrip = engine.trips.any((t) {
                                final driverKey = (t.driver ?? '').toString().trim().toLowerCase();
                                return (driverKey == d.name.trim().toLowerCase() || driverKey == d.id.trim().toLowerCase()) &&
                                       (t.status == 'running' || t.status == 'idle');
                              });
                              if (hasStartedTrip) {
                                showDialog(
                                  context: context,
                                  builder: (ctx) => AlertDialog(
                                    title: const Text('Driver Assigned to Active Trip'),
                                    content: const Text('This driver is assigned for a trip, first stop the trip and then come back and delete.'),
                                    actions: [
                                      TextButton(
                                        onPressed: () => Navigator.pop(ctx),
                                        child: const Text('Close'),
                                      ),
                                    ],
                                  ),
                                );
                              } else {
                                final confirm = await showDialog<bool>(
                                  context: context,
                                  builder: (ctx) => AlertDialog(
                                    title: const Text('Delete Driver'),
                                    content: Text('Are you sure you want to delete driver ${d.name}?'),
                                    actions: [
                                      TextButton(
                                        onPressed: () => Navigator.pop(ctx, false),
                                        child: const Text('Cancel'),
                                      ),
                                      TextButton(
                                        onPressed: () => Navigator.pop(ctx, true),
                                        child: const Text('Delete', style: TextStyle(color: AppTheme.danger)),
                                      ),
                                    ],
                                  ),
                                );
                                if (confirm == true) {
                                  await engine.removeDriver(d.id);
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('${d.name} removed')),
                                    );
                                  }
                                }
                              }
                            }
                          ),
                        ],
                      )),
                    ]);
                  }).toList(),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildCoachingSuggestions(List<Driver> atRisk) {
    if (atRisk.isEmpty) return const SizedBox.shrink();
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
                Text('Driver Coaching Suggestions', style: TextStyle(fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 12),
            ...atRisk.map((d) {
              String suggestion = 'Needs general coaching.';
              if (d.overSpeed > 5) {
                suggestion = 'Focus on speed control.';
              } else if (d.idle > 20) {
                suggestion = 'Focus on idle reduction.';
              }
              return Padding(
                padding: const EdgeInsets.only(bottom: 8.0),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Padding(
                      padding: EdgeInsets.only(top: 4.0),
                      child: Icon(Icons.circle, size: 8, color: AppTheme.danger),
                    ),
                    const SizedBox(width: 8),
                    Flexible(child: Text(d.name, style: const TextStyle(fontWeight: FontWeight.bold))),
                    const SizedBox(width: 8),
                    const Text('—'),
                    const SizedBox(width: 8),
                    Expanded(child: Text(suggestion, style: const TextStyle(color: AppTheme.textSecondary))),
                  ],
                ),
              );
            }).toList(),
          ],
        ),
      ),
    );
  }

  void _showDriverForm(BuildContext context, DataEngine engine, {Driver? d}) {
    showDialog(
      context: context,
      builder: (context) => _DriverFormDialog(engine: engine, driver: d),
    );
  }
}

class _DriverFormDialog extends StatefulWidget {
  final DataEngine engine;
  final Driver? driver;

  const _DriverFormDialog({required this.engine, this.driver});

  @override
  State<_DriverFormDialog> createState() => _DriverFormDialogState();
}

class _DriverFormDialogState extends State<_DriverFormDialog> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameCtrl;
  late TextEditingController _phoneCtrl;
  late TextEditingController _ageCtrl;
  late TextEditingController _expCtrl;
  late TextEditingController _licCtrl;

  DateTime? _licExpDate;
  String _selectedBloodGroup = 'O+';

  String? _aadharFileUrl;
  String? _licenseFileUrl;

  bool _aadharUploading = false;
  bool _licenseUploading = false;

  bool _aadharUploaded = false;
  bool _licenseUploaded = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.driver?.name ?? '');
    _phoneCtrl = TextEditingController(text: widget.driver?.phone != null && widget.driver!.phone.isNotEmpty ? widget.driver!.phone : '+91 ');
    _ageCtrl = TextEditingController(text: widget.driver?.age.toString() ?? '');
    _expCtrl = TextEditingController(text: widget.driver?.exp.toString() ?? '');
    _licCtrl = TextEditingController(text: widget.driver?.lic ?? '');
    
    if (widget.driver != null) {
      _licExpDate = DateTime.tryParse(widget.driver!.licExp);
      if (widget.driver!.blood.isNotEmpty) {
        _selectedBloodGroup = widget.driver!.blood;
      }
    }
    _aadharFileUrl = widget.driver?.aadharUrl;
    _aadharUploaded = _aadharFileUrl != null && _aadharFileUrl!.isNotEmpty;
    _licenseFileUrl = widget.driver?.licenseUrl;
    _licenseUploaded = _licenseFileUrl != null && _licenseFileUrl!.isNotEmpty;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _ageCtrl.dispose();
    _expCtrl.dispose();
    _licCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate(BuildContext context, DateTime? initial, ValueChanged<DateTime> onPicked) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: initial ?? DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime(2050),
    );
    if (picked != null) {
      onPicked(picked);
    }
  }

  Widget _buildDateRow(String label, DateTime? selectedDate, ValueChanged<DateTime> onPicked) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w500))),
          TextButton.icon(
            icon: const Icon(LucideIcons.calendar, size: 16),
            label: Text(selectedDate != null ? "${selectedDate.year}-${selectedDate.month.toString().padLeft(2, '0')}-${selectedDate.day.toString().padLeft(2, '0')}" : "Select Date"),
            onPressed: () => _pickDate(context, selectedDate, onPicked),
          ),
        ],
      ),
    );
  }

  Widget _buildUploadRow(String label, bool isUploaded, bool isUploading, VoidCallback onUpload) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(fontSize: 13, color: AppTheme.textSecondary))),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: isUploaded ? AppTheme.success.withOpacity(0.1) : null,
              foregroundColor: isUploaded ? AppTheme.success : null,
              elevation: 0,
            ),
            icon: isUploading
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : Icon(isUploaded ? LucideIcons.checkCircle : LucideIcons.upload, size: 16),
            label: Text(isUploading ? 'Uploading...' : isUploaded ? 'Uploaded' : 'Upload File'),
            onPressed: isUploading ? null : onUpload,
          ),
        ],
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

      final driverName = _nameCtrl.text.trim().replaceAll(' ', '_');
      final fileName = '${driverName}_${docType}_${DateTime.now().millisecondsSinceEpoch}.${file.extension}';

      setState(() {
        if (docType == 'aadhar') _aadharUploading = true;
        if (docType == 'license') _licenseUploading = true;
      });

      // Upload via backend (uses service_role key, bypasses RLS)
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${widget.engine.baseUrl}/api/upload?bucket=driver_docs'),
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

      final responseData = response.body;
      final url = RegExp(r'"url":"([^"]+)"').firstMatch(responseData)?.group(1) ?? '';

      setState(() {
        if (docType == 'aadhar') { _aadharFileUrl = url; _aadharUploaded = true; _aadharUploading = false; }
        if (docType == 'license') { _licenseFileUrl = url; _licenseUploaded = true; _licenseUploading = false; }
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$docType uploaded successfully!'), backgroundColor: AppTheme.success),
        );
      }
    } catch (e) {
      setState(() {
        if (docType == 'aadhar') _aadharUploading = false;
        if (docType == 'license') _licenseUploading = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e'), backgroundColor: AppTheme.danger),
        );
      }
    }
  }

  Future<void> _save() async {
    if (_formKey.currentState!.validate()) {
      if (!_aadharUploaded || !_licenseUploaded) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please upload both Aadhar Card and Driving License.'), backgroundColor: AppTheme.danger),
        );
        return;
      }
      if (widget.driver == null) {
        widget.engine.addDriver(Driver(
          id: 'DRV-${DateTime.now().millisecondsSinceEpoch.toString().substring(5)}', 
          name: _nameCtrl.text, 
          phone: _phoneCtrl.text,
          age: int.tryParse(_ageCtrl.text) ?? 30, 
          exp: int.tryParse(_expCtrl.text) ?? 0, 
          lic: _licCtrl.text.isNotEmpty ? _licCtrl.text : 'UNKNOWN', 
          licExp: _licExpDate != null ? _licExpDate!.toIso8601String().split('T').first : '2030-01-01', 
          blood: _selectedBloodGroup, 
          vehicle: '', 
          status: 'idle',
          score: 0, mil: 0, idle: 0, trips: 0, harsh: 0, overSpeed: 0, deviation: 0, fuelEff: 100,
          rating: 5.0, home: 'N/A', onLeave: false,
          imageUrl: _aadharFileUrl ?? _licenseFileUrl,
          aadharUrl: _aadharFileUrl ?? '',
          licenseUrl: _licenseFileUrl ?? '',
        ));
      } else {
        widget.engine.updateDriver(widget.driver!.copyWith(
          name: _nameCtrl.text,
          phone: _phoneCtrl.text,
          age: int.tryParse(_ageCtrl.text) ?? widget.driver!.age,
          exp: int.tryParse(_expCtrl.text) ?? widget.driver!.exp,
          lic: _licCtrl.text.isNotEmpty ? _licCtrl.text : widget.driver!.lic,
          licExp: _licExpDate != null ? _licExpDate!.toIso8601String().split('T').first : widget.driver!.licExp,
          blood: _selectedBloodGroup,
          imageUrl: _aadharFileUrl ?? _licenseFileUrl ?? widget.driver!.imageUrl,
          aadharUrl: _aadharFileUrl ?? widget.driver!.aadharUrl,
          licenseUrl: _licenseFileUrl ?? widget.driver!.licenseUrl,
        ));
      }
      if (mounted) {
        await DialogUtils.showSuccessAnimation(context, widget.driver == null ? 'Driver Added Successfully!' : 'Driver Updated Successfully!');
        if (mounted) Navigator.pop(context);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.driver == null ? 'Add New Driver' : 'Edit Driver'),
      content: SizedBox(
        width: 400,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextFormField(
                  controller: _nameCtrl, 
                  decoration: const InputDecoration(labelText: 'Full Name'),
                  validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _ageCtrl, 
                  decoration: const InputDecoration(labelText: 'Age'),
                  keyboardType: TextInputType.number,
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Required';
                    final age = int.tryParse(v);
                    if (age == null) return 'Invalid number';
                    if (age <= 18) return 'Age must be greater than 18';
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _phoneCtrl, 
                  decoration: const InputDecoration(labelText: 'Phone Number'),
                  keyboardType: TextInputType.phone,
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Required';
                    final regExp = RegExp(r'^\+91 [6-9]\d{9}$');
                    if (!regExp.hasMatch(v)) return 'Must be +91 followed by 10 digits starting with 6-9';
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _expCtrl, 
                        decoration: const InputDecoration(labelText: 'Experience (Years)'),
                        keyboardType: TextInputType.number,
                        validator: (v) {
                          if (v == null || v.isEmpty) return 'Required';
                          if (int.tryParse(v) == null) return 'Invalid number';
                          return null;
                        },
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        decoration: const InputDecoration(labelText: 'Blood Group'),
                        value: _selectedBloodGroup,
                        items: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                        onChanged: (val) => setState(() => _selectedBloodGroup = val!),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _licCtrl, 
                  decoration: const InputDecoration(labelText: 'Driving License Number'),
                  textCapitalization: TextCapitalization.characters,
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Required';
                    if (!RegExp(r'^[A-Z]{2}[ -]?[0-9]{2}[ -]?[0-9]{4}[ -]?[0-9]{7}$', caseSensitive: false).hasMatch(v.trim())) {
                      return 'Invalid DL format (e.g. KA01 20220000000)';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                _buildDateRow('License Expiry Date', _licExpDate, (date) => setState(() => _licExpDate = date)),
                const SizedBox(height: 24),
                const Text('Documents', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const Divider(),
                _buildUploadRow('Aadhar Card', _aadharUploaded, _aadharUploading, () => _pickAndUpload('aadhar')),
                _buildUploadRow('Driving License', _licenseUploaded, _licenseUploading, () => _pickAndUpload('license')),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel', style: TextStyle(color: AppTheme.textSecondary))),
        ElevatedButton(
          onPressed: _save,
          style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white),
          child: const Text('Save Driver')
        ),
      ],
    );
  }
}

class _DriverDetailDrawer extends StatelessWidget {
  final Driver driver;
  final VoidCallback onClose;
  final VoidCallback onDeactivate;

  const _DriverDetailDrawer({required this.driver, required this.onClose, required this.onDeactivate});

  String _normalize(String value) => value.trim().toLowerCase().replaceAll('_', ' ');

  Trip? _activeTripForDriver(DataEngine engine) {
    final driverName = driver.name.trim().toLowerCase();
    for (final trip in engine.trips) {
      final tripDriver = trip.driver.trim().toLowerCase();
      final status = _normalize(trip.status);
      final activeByStatus = status != 'completed' && status != 'cancelled';
      if (trip.tripCompleted != true && activeByStatus && tripDriver == driverName) {
        return trip;
      }
    }
    return null;
  }

  Color _tripStatusColor(String status) {
    final normalized = _normalize(status);
    if (normalized == 'completed') return AppTheme.ecoGreen;
    if (normalized == 'running') return Colors.blue;
    if (normalized == 'idle') return Colors.orange;
    if (normalized == 'pending' || normalized == 'not started') return Colors.orange;
    if (normalized == 'cancelled') return AppTheme.danger;
    return AppTheme.warning;
  }

  bool _isAssignedDriver() {
    return driver.vehicle.isNotEmpty && driver.vehicle != 'None' && driver.vehicle != 'Unassigned';
  }

  String _statusLabelFromTripOrDriver(DataEngine engine) {
    final trip = _activeTripForDriver(engine);
    if (trip != null) {
      return trip.status.replaceAll('_', ' ').toUpperCase();
    }
    if (_isAssignedDriver()) {
      return 'ON DUTY';
    }
    return driver.status.replaceAll('_', ' ').toUpperCase();
  }

  Color _statusColorFromTripOrDriver(DataEngine engine) {
    final trip = _activeTripForDriver(engine);
    if (trip != null) {
      return _tripStatusColor(trip.status);
    }
    if (_isAssignedDriver()) {
      return AppTheme.success;
    }
    return _tripStatusColor(driver.status);
  }

  @override
  Widget build(BuildContext context) {
    final engine = context.watch<DataEngine>();
    final statusLabel = driver.isActive ? _statusLabelFromTripOrDriver(engine) : 'INACTIVE';
    final statusColor = driver.isActive ? _statusColorFromTripOrDriver(engine) : AppTheme.textSecondary;
    return Drawer(
      width: 450,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(24, 60, 24, 24),
            color: AppTheme.primaryBlue,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(driver.name, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                    IconButton(onPressed: onClose, icon: const Icon(Icons.close, color: Colors.white)),
                  ],
                ),
                Text('${driver.id} • ${driver.exp} years experience', style: TextStyle(color: Colors.white.withOpacity(0.8))),
                const SizedBox(height: 16),
                Row(
                  children: [
                    _Badge(label: statusLabel, color: statusColor),
                    const SizedBox(width: 8),
                    _Badge(label: 'Score: ${driver.score}', color: driver.score >= 75 ? AppTheme.success : AppTheme.warning),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                const Text('BEHAVIOUR ANALYSIS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textSecondary)),
                const SizedBox(height: 24),
                SizedBox(
                  height: 200,
                  child: RadarChart(
                    RadarChartData(
                      dataSets: [
                        RadarDataSet(
                          fillColor: AppTheme.primaryBlue.withOpacity(0.2),
                          borderColor: AppTheme.primaryBlue,
                          entryRadius: 3,
                          dataEntries: [
                            RadarEntry(value: driver.fuelEff.toDouble()),
                            RadarEntry(value: (100 - driver.idle)),
                            RadarEntry(value: (100 - driver.harsh * 10).clamp(0, 100).toDouble()),
                            RadarEntry(value: (100 - driver.overSpeed * 10).clamp(0, 100).toDouble()),
                            RadarEntry(value: (100 - driver.deviation * 20).clamp(0, 100).toDouble()),
                          ],
                        ),
                      ],
                      radarBackgroundColor: Colors.transparent,
                      borderData: FlBorderData(show: false),
                      radarBorderData: const BorderSide(color: Colors.transparent),
                      titlePositionPercentageOffset: 0.2,
                      titleTextStyle: const TextStyle(fontSize: 10, color: AppTheme.textSecondary),
                      getTitle: (index, angle) {
                        switch (index) {
                          case 0: return const RadarChartTitle(text: 'Fuel Eff');
                          case 1: return const RadarChartTitle(text: 'Idling');
                          case 2: return const RadarChartTitle(text: 'Safety');
                          case 3: return const RadarChartTitle(text: 'Speed');
                          case 4: return const RadarChartTitle(text: 'Route');
                          default: return const RadarChartTitle(text: '');
                        }
                      },
                      tickCount: 1,
                      ticksTextStyle: const TextStyle(color: Colors.transparent),
                      gridBorderData: const BorderSide(color: Color(0xFFe2e8f0), width: 1),
                    ),
                  ),
                ),
                const Divider(height: 48),
                const Text('DRIVER INFORMATION', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textSecondary)),
                const SizedBox(height: 16),
                _InfoRow(label: 'Phone', value: driver.phone, icon: LucideIcons.phone),
                _InfoRow(label: 'License No', value: driver.lic, icon: LucideIcons.creditCard),
                _InfoRow(label: 'License Expiry', value: driver.licExp, icon: LucideIcons.calendar, color: (() { try { return driver.licExp.isNotEmpty && DateTime.parse(driver.licExp).difference(DateTime.now()).inDays < 60 ? AppTheme.danger : null; } catch (_) { return null; } })()),
                _InfoRow(label: 'Blood Group', value: driver.blood, icon: LucideIcons.droplets),
                _InfoRow(label: 'Home Town', value: driver.home, icon: LucideIcons.home),
                const Divider(height: 48),
                const Text('RECENT TRIPS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textSecondary)),
                const SizedBox(height: 12),
                if (driver.tripHistory.isEmpty)
                  const Text('No recent trip history.', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13))
                else
                  ...driver.tripHistory.map((t) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text('${t.from} → ${t.to}', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                    subtitle: Text('${t.date} • ${t.distance} km', style: const TextStyle(fontSize: 11)),
                    trailing: Text('${t.score}', style: TextStyle(color: t.score >= 80 ? AppTheme.success : AppTheme.warning, fontWeight: FontWeight.bold)),
                  )),
                if (driver.aadharUrl != null && driver.aadharUrl!.isNotEmpty) ...[
                  const Divider(height: 32),
                  const Text('AADHAR DOCUMENT', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textSecondary)),
                  const SizedBox(height: 16),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.network(
                      driver.aadharUrl!,
                      height: 200,
                      width: double.infinity,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) {
                        return Container(
                          height: 100,
                          color: Colors.grey.shade100,
                          alignment: Alignment.center,
                          child: const Text('Cannot load Aadhar image', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                        );
                      },
                    ),
                  ),
                ],
                if (driver.licenseUrl != null && driver.licenseUrl!.isNotEmpty) ...[
                  const Divider(height: 32),
                  const Text('DRIVING LICENSE DOCUMENT', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textSecondary)),
                  const SizedBox(height: 16),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: Image.network(
                      driver.licenseUrl!,
                      height: 200,
                      width: double.infinity,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) {
                        return Container(
                          height: 100,
                          color: Colors.grey.shade100,
                          alignment: Alignment.center,
                          child: const Text('Cannot load License image', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
                        );
                      },
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                OutlinedButton(
                  onPressed: onDeactivate, 
                  style: OutlinedButton.styleFrom(foregroundColor: AppTheme.danger),
                  child: const Text('Deactivate Driver')
                ),
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
  const _Badge({required this.label, required this.color});
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(4), border: Border.all(color: color.withOpacity(0.2))),
      child: Text(label, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold)),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color? color;
  const _InfoRow({required this.label, required this.value, required this.icon, this.color});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Icon(icon, size: 18, color: AppTheme.textSecondary),
          const SizedBox(width: 12),
          Text(label, style: const TextStyle(color: AppTheme.textSecondary)),
          const Spacer(),
          Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: color ?? AppTheme.textPrimary)),
        ],
      ),
    );
  }
}
