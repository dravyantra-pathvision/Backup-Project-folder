import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;
import '../models/engine.dart';
import '../core/theme.dart';

class VehiclesScreen extends StatefulWidget {
  const VehiclesScreen({super.key});

  @override
  State<VehiclesScreen> createState() => _VehiclesScreenState();
}

class _VehiclesScreenState extends State<VehiclesScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  Vehicle? _detailVehicle;
  String _searchQuery = '';
  String _selectedStatus = 'All';
  final ScrollController _filterScrollController = ScrollController();
  final ScrollController _tableScrollController = ScrollController();
  // KPI animation state: controls staggered entrance of cards
  final List<bool> _kpiVisible = [false, false, false, false];
  bool _kpiAnimationStarted = false;

  @override
  void initState() {
    super.initState();
    // start staggered animation once when screen is created
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_kpiAnimationStarted) {
        _kpiAnimationStarted = true;
        for (var i = 0; i < _kpiVisible.length; i++) {
          Future.delayed(Duration(milliseconds: 200 * i), () {
            if (mounted) setState(() => _kpiVisible[i] = true);
          });
        }
      }
    });
  }

  Color _statusColor(String status, {required bool isActive}) {
    if (!isActive) return AppTheme.textSecondary;
    final normalized = status.trim().toLowerCase().replaceAll('_', ' ');
    if (normalized == 'completed') return AppTheme.ecoGreen;
    if (normalized == 'running') return Colors.blue;
    if (normalized == 'idle' || normalized == 'pending' || normalized == 'not started') return Colors.orange;
    if (normalized == 'cancelled') return AppTheme.danger;
    if (normalized == 'offline') return AppTheme.textSecondary;
    return AppTheme.textSecondary;
  }

  @override
  Widget build(BuildContext context) {
    final engine = context.watch<DataEngine>();
    final vehicles = engine.vehicles;
    
    final filteredVehicles = vehicles.where((v) {
      final matchesSearch = v.plate.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          v.driver.toLowerCase().contains(_searchQuery.toLowerCase());
          
        final isAssigned = v.driver.isNotEmpty && v.driver != 'Unassigned' && v.driver != 'None';
        final isOffline = v.status == 'offline';
      
      final matchesStatus = _selectedStatus == 'All' ||
          (_selectedStatus == 'Running' && isAssigned && v.status == 'running') ||
          (_selectedStatus == 'Idle' && isAssigned && v.status == 'idle') ||
          (_selectedStatus == 'Offline' && isOffline);
          
      return matchesSearch && matchesStatus;
    }).toList();
    
    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: Colors.transparent,
      endDrawer: _detailVehicle != null 
        ? _VehicleDetailDrawer(
            vehicle: _detailVehicle!, 
            onClose: () => Navigator.pop(context),
            onDeactivate: () {
              engine.deactivateVehicle(_detailVehicle!.plate);
              Navigator.pop(context);
            },
          ) 
        : null,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            LayoutBuilder(
              builder: (context, constraints) {
                bool isNarrow = constraints.maxWidth < 600;
                return Wrap(
                  alignment: WrapAlignment.spaceBetween,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  spacing: 16,
                  runSpacing: 16,
                  children: [
                    SizedBox(
                      width: isNarrow ? constraints.maxWidth : null,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text('Fleet Vehicles', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                          const Text('Manage and monitor all vehicles', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                        ],
                      ),
                    ),
                    SizedBox(
                      width: isNarrow ? constraints.maxWidth : null,
                      child: Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        alignment: isNarrow ? WrapAlignment.start : WrapAlignment.end,
                        children: [
                          OutlinedButton.icon(onPressed: () {}, icon: const Icon(LucideIcons.download, size: 14), label: const Text('Export')),
                          ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white),
                            onPressed: () => _showVehicleForm(context, engine), 
                            icon: const Icon(LucideIcons.plus, size: 14), 
                            label: const Text('Add Vehicle')
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              }
            ),
            const SizedBox(height: 16),
            _buildKpis(vehicles),
            const SizedBox(height: 16),
            _buildFilters(),
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
              child: _buildVehicleTable(context, engine, filteredVehicles),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilters() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextField(
          decoration: const InputDecoration(
            labelText: 'Search by plate or driver',
            prefixIcon: Icon(Icons.search),
            border: OutlineInputBorder(),
          ),
          onChanged: (val) => setState(() => _searchQuery = val),
        ),
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: ['All', 'Running', 'Idle', 'Offline'].map((status) {
              return Padding(
                padding: const EdgeInsets.only(right: 8.0),
                child: ChoiceChip(
                  label: Text(status),
                  selected: _selectedStatus == status,
                  onSelected: (selected) {
                    if (selected) {
                      setState(() => _selectedStatus = status);
                    }
                  },
                ),
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildKpis(List<Vehicle> vehicles) {
    int running = vehicles.where((v) => v.status == 'running' && v.isActive).length;
    int idle = vehicles.where((v) => v.status == 'idle' && v.isActive).length;
    int offline = vehicles.where((v) => v.status == 'offline' && v.isActive).length;
    int alerts = vehicles.where((v) => v.alerts.isNotEmpty && v.isActive).length;
    int avgHealth = vehicles.isEmpty ? 0 : vehicles.map((v) => v.health).reduce((a, b) => a + b) ~/ vehicles.length;

    return LayoutBuilder(
      builder: (context, constraints) {
        // two columns grid layout: compute width so two cards fit per row
        final gap = 12.0;
        final cardWidth = (constraints.maxWidth - gap) / 2;
        final cards = [
          _kpiCard('Total Fleet', '${vehicles.length}', 'vehicles', AppTheme.primaryBlue),
          _kpiCard('Running Now', '$running', 'of ${vehicles.length}', AppTheme.success),
          _kpiCard('Idle / Stopped', '$idle', 'parked', AppTheme.warning),
          _kpiCard('Offline', '$offline', 'unassigned', AppTheme.textSecondary),
        ];

        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: List.generate(cards.length, (i) {
            // staggered entrance: slide up + fade in
            final visible = i < _kpiVisible.length ? _kpiVisible[i] : true;
            return SizedBox(
              width: cardWidth < 150 ? 150 : cardWidth,
              child: AnimatedOpacity(
                duration: const Duration(milliseconds: 350),
                opacity: visible ? 1.0 : 0.0,
                child: AnimatedSlide(
                  duration: const Duration(milliseconds: 350),
                  offset: visible ? Offset.zero : const Offset(0, 0.08),
                  child: ExcludeSemantics(
                    excluding: !visible,
                    child: cards[i],
                  ),
                ),
              ),
            );
          }),
        );
      },
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

  Widget _buildVehicleTable(BuildContext context, DataEngine engine, List<Vehicle> vehicles) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: LayoutBuilder(
        builder: (context, constraints) {
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
                  DataColumn(label: Text('Reg. Plate')),
                  DataColumn(label: Text('Driver')),
                  DataColumn(label: Text('Status/Loc')),
                  DataColumn(label: Text('Fuel %')),
                  DataColumn(label: Text('Avg. Mileage')),
                  DataColumn(label: Text('Compliance')),
                  DataColumn(label: Text('Health')),
                  DataColumn(label: Text('View / Edit / Remove')),
                ],
                rows: vehicles.map((v) {
                  final statusLabel = v.isActive ? v.status.replaceAll('_', ' ').toUpperCase() : 'DEACTIVATED';
                  final statusColor = _statusColor(v.status, isActive: v.isActive);
                  bool isExpired = (() { try { final d = v.nextService; return d.isNotEmpty && DateTime.now().isAfter(DateTime.parse(d)); } catch (_) { return false; } })();
                  return DataRow(
                    color: MaterialStateProperty.resolveWith((states) => v.isActive ? null : Colors.grey.shade100),
                    cells: [
                      DataCell(Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(v.plate, style: TextStyle(fontWeight: FontWeight.bold, color: v.isActive ? AppTheme.primaryBlue : AppTheme.textSecondary)),
                          Text(v.model, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                        ],
                      )),
                      DataCell(Text(v.driver)),
                      DataCell(Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(statusLabel, style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: statusColor)),
                          Text(v.loc, style: const TextStyle(fontSize: 11)),
                        ],
                      )),
                      DataCell(Text('${v.fuel}%')),
                      DataCell(Text('${v.mil} km/L')),
                      DataCell(Row(
                        children: [
                          _CompIcon(icon: LucideIcons.shieldCheck, color: AppTheme.success, tooltip: 'Insurance Valid'),
                          _CompIcon(icon: LucideIcons.fileText, color: isExpired ? AppTheme.danger : AppTheme.success, tooltip: 'Service Due: ${v.nextService}'),
                        ],
                      )),
                      DataCell(Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(color: (calculateHealth(v.year) > 70 ? AppTheme.success : AppTheme.warning).withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                        child: Text('${calculateHealth(v.year)}%', style: TextStyle(color: calculateHealth(v.year) > 70 ? AppTheme.success : AppTheme.warning, fontWeight: FontWeight.bold, fontSize: 12)),
                      )),
                      DataCell(Row(
                        children: [
                          IconButton(
                            icon: const Icon(LucideIcons.eye, size: 18), 
                            onPressed: () {
                              setState(() => _detailVehicle = v);
                              _scaffoldKey.currentState?.openEndDrawer();
                            }
                          ),
                          IconButton(
                            icon: const Icon(LucideIcons.edit2, size: 18), 
                            onPressed: () => _showVehicleForm(context, engine, v: v)
                          ),
                          IconButton(
                            icon: const Icon(LucideIcons.trash2, size: 18, color: AppTheme.danger), 
                            onPressed: () async {
                              final hasStartedTrip = engine.trips.any((t) =>
                                  t.vehicle.trim().toUpperCase() == v.plate.trim().toUpperCase() &&
                                  (t.status == 'running' || t.status == 'idle'));
                              if (hasStartedTrip) {
                                showDialog(
                                  context: context,
                                  builder: (ctx) => AlertDialog(
                                    title: const Text('Vehicle Assigned to Active Trip'),
                                    content: const Text('This vehicle is assigned for a trip, first stop the trip and then come back and delete.'),
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
                                    title: const Text('Delete Vehicle'),
                                    content: Text('Are you sure you want to delete vehicle ${v.plate}?'),
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
                                  await engine.removeVehicle(v.plate);
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text('${v.plate} removed')),
                                    );
                                  }
                                }
                              }
                            }
                          ),
                        ],
                      )),
                    ],
                  );
                }).toList(),
              ),
            ),
          ),
        );
        },
      ),
    );
  }

  void _showVehicleForm(BuildContext context, DataEngine engine, {Vehicle? v}) {
    showDialog(
      context: context,
      builder: (context) => _VehicleFormDialog(engine: engine, vehicle: v),
    );
  }
}

class _VehicleFormDialog extends StatefulWidget {
  final DataEngine engine;
  final Vehicle? vehicle;

  const _VehicleFormDialog({required this.engine, this.vehicle});

  @override
  State<_VehicleFormDialog> createState() => _VehicleFormDialogState();
}

class _VehicleFormDialogState extends State<_VehicleFormDialog> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _plateCtrl;
  late TextEditingController _modelCtrl;
  
  DateTime? _rcRegDate;
  DateTime? _rcExpDate;
  DateTime? _insExpDate;
  DateTime? _pucExpDate;

  String? _rcFileUrl;
  String? _insFileUrl;
  String? _pucFileUrl;

  bool _rcUploading = false;
  bool _insUploading = false;
  bool _pucUploading = false;

  bool _rcUploaded = false;
  bool _insUploaded = false;
  bool _pucUploaded = false;

  @override
  void initState() {
    super.initState();
    _plateCtrl = TextEditingController(text: widget.vehicle?.plate ?? '');
    _modelCtrl = TextEditingController(text: widget.vehicle?.model ?? '');
    
    if (widget.vehicle != null) {
      _insExpDate = DateTime.tryParse(widget.vehicle!.insurance);
      _pucExpDate = DateTime.tryParse(widget.vehicle!.puc);
      _rcFileUrl = widget.vehicle!.rcUrl;
      _insFileUrl = widget.vehicle!.insuranceUrl;
      _pucFileUrl = widget.vehicle!.pucUrl;
      _rcUploaded = _rcFileUrl != null && _rcFileUrl!.isNotEmpty;
      _insUploaded = _insFileUrl != null && _insFileUrl!.isNotEmpty;
      _pucUploaded = _pucFileUrl != null && _pucFileUrl!.isNotEmpty;
    }
  }

  @override
  void dispose() {
    _plateCtrl.dispose();
    _modelCtrl.dispose();
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
      final bytes = file.bytes;
      if (bytes == null) return;

      final plate = _plateCtrl.text.trim().toUpperCase().replaceAll(' ', '_');
      final fileName = '${plate}_${docType}_${DateTime.now().millisecondsSinceEpoch}.${file.extension}';

      setState(() {
        if (docType == 'rc') _rcUploading = true;
        if (docType == 'insurance') _insUploading = true;
        if (docType == 'puc') _pucUploading = true;
      });

      // Upload via backend (uses service_role key, bypasses RLS)
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${widget.engine.baseUrl}/api/upload?bucket=vehicle_docs'),
      );
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
      // Parse URL from JSON response {"url": "..."}
      final url = RegExp(r'"url":"([^"]+)"').firstMatch(responseData)?.group(1) ?? '';

      setState(() {
        if (docType == 'rc') { _rcFileUrl = url; _rcUploaded = true; _rcUploading = false; }
        if (docType == 'insurance') { _insFileUrl = url; _insUploaded = true; _insUploading = false; }
        if (docType == 'puc') { _pucFileUrl = url; _pucUploaded = true; _pucUploading = false; }
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$docType uploaded successfully!'), backgroundColor: AppTheme.success),
        );
      }
    } catch (e) {
      setState(() {
        if (docType == 'rc') _rcUploading = false;
        if (docType == 'insurance') _insUploading = false;
        if (docType == 'puc') _pucUploading = false;
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
      if (widget.vehicle == null) {
        await widget.engine.addVehicle(Vehicle(
          plate: _plateCtrl.text.toUpperCase(), 
          model: _modelCtrl.text, 
          year: _rcRegDate?.year ?? 2024, 
          type: 'HCV', 
          status: 'offline', 
          driver: 'Unassigned',
          loc: 'Depot', 
          speed: 0, 
          fuel: 100, 
          mil: 0, 
          idle: 0, 
          fastag: 0, 
          health: 100, 
          odo: 0,
          nextService: '2025-01-01', 
          insurance: _insExpDate != null ? _insExpDate!.toIso8601String().split('T').first : '2025-01-01', 
          permit: '2025-01-01', 
          puc: _pucExpDate != null ? _pucExpDate!.toIso8601String().split('T').first : '2025-01-01',
          lastFill: 'N/A', 
          alerts: [], 
          lat: 19.0760, 
          lng: 72.8777,
          imageUrl: _rcFileUrl ?? _insFileUrl ?? _pucFileUrl,
          rcUrl: _rcFileUrl,
          insuranceUrl: _insFileUrl,
          pucUrl: _pucFileUrl,
        ));
      } else {
        await widget.engine.updateVehicle(widget.vehicle!.copyWith(
          model: _modelCtrl.text,
          insurance: _insExpDate != null ? _insExpDate!.toIso8601String().split('T').first : widget.vehicle!.insurance,
          puc: _pucExpDate != null ? _pucExpDate!.toIso8601String().split('T').first : widget.vehicle!.puc,
          imageUrl: _rcFileUrl ?? _insFileUrl ?? _pucFileUrl ?? widget.vehicle!.imageUrl,
          rcUrl: _rcFileUrl ?? widget.vehicle!.rcUrl,
          insuranceUrl: _insFileUrl ?? widget.vehicle!.insuranceUrl,
          pucUrl: _pucFileUrl ?? widget.vehicle!.pucUrl,
        )); 
      }
      await widget.engine.refreshData();
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.vehicle == null ? 'Add New Vehicle' : 'Edit Vehicle'),
      content: SizedBox(
        width: 500,
        child: Form(
          key: _formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextFormField(
                  controller: _plateCtrl,
                  decoration: const InputDecoration(labelText: 'Registration Plate (e.g. MH 01 AB 1234)'),
                  validator: (value) {
                    if (value == null || value.isEmpty) return 'Required';
                    if (!RegExp(r'^[A-Za-z]{2} \d{2} [A-Za-z]{1,2} \d{4}$').hasMatch(value)) {
                      return 'Invalid format. Use XX NN XX NNNN (e.g. DL 11 AA 1234)';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _modelCtrl,
                  decoration: const InputDecoration(labelText: 'Vehicle Model (e.g. Tata Prima)'),
                  validator: (value) => value == null || value.isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 24),
                const Text('Compliance Documents', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const Divider(),
                
                _buildDateRow('RC Registration Date', _rcRegDate, (date) => setState(() => _rcRegDate = date)),

                _buildUploadRow('RC Document', _rcUploaded, _rcUploading, () => _pickAndUpload('rc')),
                
                const Divider(height: 16),
                
                _buildDateRow('Insurance Expiry Date', _insExpDate, (date) => setState(() => _insExpDate = date)),
                _buildUploadRow('Insurance Certificate', _insUploaded, _insUploading, () => _pickAndUpload('insurance')),
                
                const Divider(height: 16),
                
                _buildDateRow('PUC Expiry Date', _pucExpDate, (date) => setState(() => _pucExpDate = date)),
                _buildUploadRow('PUC Certificate', _pucUploaded, _pucUploading, () => _pickAndUpload('puc')),
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
          child: const Text('Save Vehicle')
        ),
      ],
    );
  }
}

class _CompIcon extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String tooltip;
  const _CompIcon({required this.icon, required this.color, required this.tooltip});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 8.0),
      child: Tooltip(
        message: tooltip,
        child: Icon(icon, color: color, size: 16),
      ),
    );
  }
}

int calculateHealth(int regYear) {
  final currentYear = DateTime.now().year;
  final age = currentYear - regYear;
  const totalLifespan = 15;
  
  if (age <= 0) return 100;
  if (age >= totalLifespan) return 60; 
  
  final health = 100 - ((age / totalLifespan) * (100 - 60)).round();
  return health;
}

class _VehicleDetailDrawer extends StatelessWidget {
  final Vehicle vehicle;
  final VoidCallback onClose;
  final VoidCallback onDeactivate;

  const _VehicleDetailDrawer({required this.vehicle, required this.onClose, required this.onDeactivate});

  Color _statusColor(String status, {required bool isActive}) {
    if (!isActive) return AppTheme.textSecondary;
    final normalized = status.trim().toLowerCase().replaceAll('_', ' ');
    if (normalized == 'completed') return AppTheme.ecoGreen;
    if (normalized == 'running') return Colors.blue;
    if (normalized == 'idle' || normalized == 'pending' || normalized == 'not started') return Colors.orange;
    if (normalized == 'cancelled') return AppTheme.danger;
    if (normalized == 'offline') return AppTheme.textSecondary;
    return AppTheme.textSecondary;
  }

  @override
  Widget build(BuildContext context) {
    return Drawer(
      width: 400,
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
                    Text(vehicle.plate, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold)),
                    IconButton(onPressed: onClose, icon: const Icon(Icons.close, color: Colors.white)),
                  ],
                ),
                Text('${vehicle.model} • ${vehicle.type}', style: TextStyle(color: Colors.white.withOpacity(0.8))),
                const SizedBox(height: 16),
                Row(
                  children: [
                    _Badge(label: vehicle.isActive ? vehicle.status.replaceAll('_', ' ').toUpperCase() : 'INACTIVE', color: _statusColor(vehicle.status, isActive: vehicle.isActive)),
                    const SizedBox(width: 8),
                    _Badge(label: 'Health: ${calculateHealth(vehicle.year)}%', color: calculateHealth(vehicle.year) > 70 ? AppTheme.success : AppTheme.warning),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(24),
              children: [
                const Text('COMPLIANCE & DOCUMENTS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textSecondary)),
                const SizedBox(height: 16),
                _ComplianceRow(label: 'RC Registration', date: '${vehicle.year}', status: 'Valid', prefix: 'Date'),
                _ComplianceRow(label: 'RC Expiry', date: '${vehicle.year + 15}', status: 'Valid'),
                _ComplianceRow(label: 'Insurance', date: vehicle.insurance, status: 'Valid'),
                _ComplianceRow(label: 'PUC', date: vehicle.puc, status: 'Valid'),
                _ComplianceRow(label: 'Permit', date: vehicle.permit, status: 'Valid'),
                _ComplianceRow(label: 'Next Service', date: vehicle.nextService, status: 'Due soon', isAlert: true),
                const Divider(height: 48),
                const Text('REAL-TIME STATS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textSecondary)),
                const SizedBox(height: 16),
                _StatRow(label: 'Odometer', value: '${vehicle.odo} km', icon: LucideIcons.gauge),
                _StatRow(label: 'Current Fuel', value: '${vehicle.fuel}%', icon: LucideIcons.fuel),
                _StatRow(label: 'Last Fill', value: vehicle.lastFill, icon: LucideIcons.droplets),
                _StatRow(label: 'Driver', value: vehicle.driver, icon: LucideIcons.user),
                const Divider(height: 48),
                const Text('SERVICE HISTORY', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppTheme.textSecondary)),
                const SizedBox(height: 12),
                if (vehicle.serviceHistory.isEmpty)
                  const Text('No recent service records.', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13))
                else
                  ...vehicle.serviceHistory.map((s) => ListTile(title: Text(s.type), subtitle: Text(s.date), trailing: const Icon(LucideIcons.chevronRight, size: 14))),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () {}, 
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white),
                  child: const Text('Schedule Maintenance')
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: onDeactivate, 
                  style: OutlinedButton.styleFrom(foregroundColor: AppTheme.danger),
                  child: const Text('Deactivate Vehicle')
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

class _ComplianceRow extends StatelessWidget {
  final String label;
  final String date;
  final String status;
  final bool isAlert;
  final String prefix;
  const _ComplianceRow({required this.label, required this.date, required this.status, this.isAlert = false, this.prefix = 'Expires'});
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                Text('$prefix: $date', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(color: (isAlert ? AppTheme.warning : AppTheme.success).withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
            child: Text(status, style: TextStyle(color: isAlert ? AppTheme.warning : AppTheme.success, fontSize: 10, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }
}

class _StatRow extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  const _StatRow({required this.label, required this.value, required this.icon});
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
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}
