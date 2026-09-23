import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:file_picker/file_picker.dart';
import 'package:http/http.dart' as http;
import 'package:firebase_auth/firebase_auth.dart';
import 'dart:io';
import '../models/engine.dart';
import '../core/theme.dart';
import '../widgets/qr_scanner_dialog.dart';
import '../core/dialogs.dart';

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
  // Scroll controllers reserved for future filter/table use
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

  Color _statusColor(String status) {
    final normalized = status.trim().toUpperCase();
    if (normalized == 'ASSIGNED') return AppTheme.danger;
    if (normalized == 'AVAILABLE') return AppTheme.success;
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
      final matchesStatus = _selectedStatus == 'All' ||
          (_selectedStatus == 'Assigned' && isAssigned) ||
          (_selectedStatus == 'Available' && !isAssigned);
          
      return matchesSearch && matchesStatus;
    }).toList();
    
    final String? highlighted = engine.highlightedVehiclePlate;
    if (highlighted != null && highlighted.isNotEmpty) {
      Vehicle? found;
      try {
        found = vehicles.firstWhere((v) => v.plate == highlighted);
      } catch (e) {
        found = null;
      }
      if (found != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (!mounted) return;
          setState(() => _detailVehicle = found);
          _scaffoldKey.currentState?.openEndDrawer();
          engine.highlightVehicle(null);
        });
      }
    }

    if (_detailVehicle != null) {
      _detailVehicle = vehicles.firstWhere(
        (v) => v.plate == _detailVehicle!.plate,
        orElse: () => _detailVehicle!,
      );
    }

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: Colors.transparent,
      endDrawer: _VehicleDetailDrawer(
        vehiclePlate: _detailVehicle?.plate ?? '',
        onClose: () => Navigator.pop(context),
      ),
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
            children: ['All', 'Assigned', 'Available'].map((status) {
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
    int assigned = vehicles.where((v) => v.status == 'ASSIGNED').length;
    int available = vehicles.where((v) => v.status == 'AVAILABLE').length;

    return LayoutBuilder(
      builder: (context, constraints) {
        final gap = 12.0;
        final isWide = constraints.maxWidth > 600;
        final cardWidth = isWide
            ? (constraints.maxWidth - (gap * 2)) / 3
            : (constraints.maxWidth - gap) / 2;
        final cards = [
          _kpiCard('Total Fleet', '${vehicles.length}', 'vehicles', AppTheme.primaryBlue),
          _kpiCard('Assigned', '$assigned', 'on active trips', AppTheme.danger),
          _kpiCard('Available', '$available', 'ready for dispatch', AppTheme.success),
        ];

        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: List.generate(cards.length, (i) {
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
    if (vehicles.isEmpty) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: Text('No vehicles found.', style: TextStyle(color: AppTheme.textSecondary)),
        ),
      );
    }
    return Column(
      children: vehicles.map((v) {
        final isAssigned = v.driver.isNotEmpty && v.driver != 'Unassigned' && v.driver != 'None';
        final statusLabel = isAssigned ? 'ASSIGNED' : 'AVAILABLE';
        final statusColor = _statusColor(statusLabel);
        final healthVal = calculateHealth(v.year);
        return Card(
          margin: const EdgeInsets.only(bottom: 10),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () {
              setState(() => _detailVehicle = v);
              WidgetsBinding.instance.addPostFrameCallback((_) {
                _scaffoldKey.currentState?.openEndDrawer();
              });
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              child: Row(
                children: [
                  // Vehicle icon
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(LucideIcons.truck, color: statusColor, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          v.plate,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppTheme.primaryBlue),
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${v.type}  •  ${v.driver.isNotEmpty && v.driver != "Unassigned" ? v.driver : "No Driver"}',
                          style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary),
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 6),
                        Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: statusColor,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(statusLabel, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white)),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.grey.shade100,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text('Fuel ${v.fuel}%', style: TextStyle(fontSize: 9, color: v.fuel < 20 ? AppTheme.danger : AppTheme.textSecondary)),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: (healthVal > 70 ? AppTheme.success : AppTheme.warning).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text('Health $healthVal%', style: TextStyle(fontSize: 9, color: healthVal > 70 ? AppTheme.success : AppTheme.warning, fontWeight: FontWeight.w600)),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  // Edit / Delete
                  Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        icon: const Icon(LucideIcons.edit2, size: 15, color: AppTheme.textSecondary),
                        onPressed: () => _showVehicleForm(context, engine, v: v),
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                        visualDensity: VisualDensity.compact,
                      ),
                      IconButton(
                        icon: const Icon(LucideIcons.trash2, size: 15, color: AppTheme.danger),
                        onPressed: () async {
                          final hasStartedTrip = engine.trips.any((t) =>
                              t.vehicle.trim().toUpperCase() == v.plate.trim().toUpperCase() &&
                              (t.status == 'running' || t.status == 'idle'));
                          if (hasStartedTrip) {
                            if (context.mounted) {
                              showDialog(
                                context: context,
                                builder: (ctx) => AlertDialog(
                                  title: const Text('Vehicle In Active Trip'),
                                  content: const Text('Stop the trip first before deleting.'),
                                  actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('OK'))],
                                ),
                              );
                            }
                          } else {
                            final confirm = await showDialog<bool>(
                              context: context,
                              builder: (ctx) => AlertDialog(
                                title: const Text('Delete Vehicle'),
                                content: Text('Remove ${v.plate}?'),
                                actions: [
                                  TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                                  TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete', style: TextStyle(color: AppTheme.danger))),
                                ],
                              ),
                            );
                            if (confirm == true && context.mounted) {
                              await engine.removeVehicle(v.plate);
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('${v.plate} removed')));
                              }
                            }
                          }
                        },
                        padding: EdgeInsets.zero,
                        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                        visualDensity: VisualDensity.compact,
                      ),
                    ],
                  ),
                  const Icon(LucideIcons.chevronRight, size: 14, color: AppTheme.textSecondary),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  void _showVehicleForm(BuildContext context, DataEngine engine, {Vehicle? v}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.65,
        minChildSize: 0.3,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => _VehicleFormBottomSheet(
          engine: engine,
          vehicle: v,
          scrollController: scrollController,
        ),
      ),
    );
  }
}

class _VehicleFormBottomSheet extends StatefulWidget {
  final DataEngine engine;
  final Vehicle? vehicle;
  final ScrollController? scrollController;

  const _VehicleFormBottomSheet({required this.engine, this.vehicle, this.scrollController});

  @override
  State<_VehicleFormBottomSheet> createState() => _VehicleFormBottomSheetState();
}

class _VehicleFormBottomSheetState extends State<_VehicleFormBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  bool _isSaving = false;
  late TextEditingController _plateCtrl;
  late TextEditingController _deviceIdCtrl;
  late TextEditingController _makeCtrl;
  late TextEditingController _modelCtrl;
  late TextEditingController _fuelCapCtrl;
  late TextEditingController _milCtrl;
  String _selectedFuelType = 'Diesel';
  String _selectedType = '6 wheeler';
  
  DateTime? _rcRegDate;
  DateTime? _insExpDate;
  DateTime? _pucExpDate;
  DateTime? _nextServiceDate;
  DateTime? _permitDate;

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
    _deviceIdCtrl = TextEditingController(text: widget.vehicle?.deviceId ?? '');
    _makeCtrl = TextEditingController(text: widget.vehicle?.make ?? '');
    _modelCtrl = TextEditingController(text: widget.vehicle?.model ?? '');
    _fuelCapCtrl = TextEditingController(text: widget.vehicle?.fuelCapacity?.toString() ?? '');
    _milCtrl = TextEditingController(text: widget.vehicle?.mil.toString() ?? '');
    
    if (widget.vehicle != null) {
      _selectedFuelType = widget.vehicle!.fuelType ?? 'Diesel';
      _selectedType = ['6 wheeler', '8 wheeler', '10+ wheelers'].contains(widget.vehicle!.type)
          ? widget.vehicle!.type
          : '6 wheeler';
      _insExpDate = DateTime.tryParse(widget.vehicle!.insurance);
      _pucExpDate = DateTime.tryParse(widget.vehicle!.puc);
      _rcRegDate = DateTime(widget.vehicle!.year, 1, 1);
      _nextServiceDate = DateTime.tryParse(widget.vehicle!.nextService);
      _permitDate = DateTime.tryParse(widget.vehicle!.permit);
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
    _deviceIdCtrl.dispose();
    _makeCtrl.dispose();
    _modelCtrl.dispose();
    _fuelCapCtrl.dispose();
    _milCtrl.dispose();
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
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(fontWeight: FontWeight.w500))),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: isUploaded ? AppTheme.success.withOpacity(0.1) : null,
              foregroundColor: isUploaded ? AppTheme.success : null,
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
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
        withData: true,
      );
      if (result == null || result.files.isEmpty) return;

      final file = result.files.first;
      var bytes = file.bytes;
      if (bytes == null && file.path != null) {
        bytes = await File(file.path!).readAsBytes();
      }
      if (bytes == null) return;

      final plate = _plateCtrl.text.trim().isNotEmpty ? _plateCtrl.text.trim() : 'TEMP';
      final fileName = 'vehicle_${docType}_${plate}_${DateTime.now().millisecondsSinceEpoch}.${file.extension}';

      setState(() {
        if (docType == 'rc') _rcUploading = true;
        if (docType == 'insurance') _insUploading = true;
        if (docType == 'puc') _pucUploading = true;
      });

      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${widget.engine.baseUrl}/api/upload?bucket=vehicle_docs'),
      );
      final idToken = await FirebaseAuth.instance.currentUser?.getIdToken();
      if (idToken != null) {
        request.headers['Authorization'] = 'Bearer $idToken';
      }

      request.files.add(
        http.MultipartFile.fromBytes(
          'file',
          bytes,
          filename: fileName,
        ),
      );

      final streamedResponse = await request.send();
      final response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final fileUrl = data['fileUrl'] ?? data['url'];
        setState(() {
          if (docType == 'rc') {
            _rcFileUrl = fileUrl;
            _rcUploaded = true;
            _rcUploading = false;
          } else if (docType == 'insurance') {
            _insFileUrl = fileUrl;
            _insUploaded = true;
            _insUploading = false;
          } else if (docType == 'puc') {
            _pucFileUrl = fileUrl;
            _pucUploaded = true;
            _pucUploading = false;
          }
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('${docType.toUpperCase()} document uploaded successfully!'), backgroundColor: AppTheme.success),
          );
        }
      } else {
        throw Exception('Upload failed: ${response.statusCode}');
      }
    } catch (e) {
      setState(() {
        if (docType == 'rc') _rcUploading = false;
        if (docType == 'insurance') _insUploading = false;
        if (docType == 'puc') _pucUploading = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to upload $docType document: $e'), backgroundColor: AppTheme.danger),
        );
      }
    }
  }

  Future<void> _save() async {
    if (_formKey.currentState!.validate()) {
      setState(() => _isSaving = true);
      try {
        if (widget.vehicle == null) {
          final yearVal = _rcRegDate != null ? _rcRegDate!.year : DateTime.now().year;
          await widget.engine.addVehicle(Vehicle(
            plate: _plateCtrl.text.toUpperCase(),
            deviceId: _deviceIdCtrl.text,
            year: yearVal,
            type: _selectedType,
            status: 'stopped',
            driver: 'Unassigned',
            loc: 'Depot',
            speed: 0,
            fuel: 100,
            mil: double.tryParse(_milCtrl.text) ?? 4.0,
            idle: 0,
            fastag: 1000,
            health: 100,
            odo: 0,
            nextService: _nextServiceDate != null ? "${_nextServiceDate!.year}-${_nextServiceDate!.month.toString().padLeft(2, '0')}-${_nextServiceDate!.day.toString().padLeft(2, '0')}" : '2025-06-01',
            insurance: _insExpDate != null ? "${_insExpDate!.year}-${_insExpDate!.month.toString().padLeft(2, '0')}-${_insExpDate!.day.toString().padLeft(2, '0')}" : '2025-12-31',
            permit: _permitDate != null ? "${_permitDate!.year}-${_permitDate!.month.toString().padLeft(2, '0')}-${_permitDate!.day.toString().padLeft(2, '0')}" : '2026-01-01',
            puc: _pucExpDate != null ? "${_pucExpDate!.year}-${_pucExpDate!.month.toString().padLeft(2, '0')}-${_pucExpDate!.day.toString().padLeft(2, '0')}" : '2025-08-15',
            lastFill: 'N/A',
            make: _makeCtrl.text.trim().isNotEmpty ? _makeCtrl.text.trim() : null,
            model: _modelCtrl.text.trim().isNotEmpty ? _modelCtrl.text.trim() : null,
            fuelCapacity: double.tryParse(_fuelCapCtrl.text.trim()),
            fuelType: _selectedFuelType,
            rcUrl: _rcFileUrl,
            insuranceUrl: _insFileUrl,
            pucUrl: _pucFileUrl,
            alerts: [],
            lat: 0.0,
            lng: 0.0,
          ));
        } else {
          await widget.engine.updateVehicle(widget.vehicle!.copyWith(
            deviceId: _deviceIdCtrl.text,
            type: _selectedType,
            mil: double.tryParse(_milCtrl.text) ?? widget.vehicle!.mil,
            make: _makeCtrl.text.trim().isNotEmpty ? _makeCtrl.text.trim() : widget.vehicle!.make,
            model: _modelCtrl.text.trim().isNotEmpty ? _modelCtrl.text.trim() : widget.vehicle!.model,
            fuelCapacity: double.tryParse(_fuelCapCtrl.text.trim()) ?? widget.vehicle!.fuelCapacity,
            fuelType: _selectedFuelType,
            insurance: _insExpDate != null ? "${_insExpDate!.year}-${_insExpDate!.month.toString().padLeft(2, '0')}-${_insExpDate!.day.toString().padLeft(2, '0')}" : widget.vehicle!.insurance,
            puc: _pucExpDate != null ? "${_pucExpDate!.year}-${_pucExpDate!.month.toString().padLeft(2, '0')}-${_pucExpDate!.day.toString().padLeft(2, '0')}" : widget.vehicle!.puc,
            permit: _permitDate != null ? "${_permitDate!.year}-${_permitDate!.month.toString().padLeft(2, '0')}-${_permitDate!.day.toString().padLeft(2, '0')}" : widget.vehicle!.permit,
            nextService: _nextServiceDate != null ? "${_nextServiceDate!.year}-${_nextServiceDate!.month.toString().padLeft(2, '0')}-${_nextServiceDate!.day.toString().padLeft(2, '0')}" : widget.vehicle!.nextService,
            rcUrl: _rcFileUrl ?? widget.vehicle!.rcUrl,
            insuranceUrl: _insFileUrl ?? widget.vehicle!.insuranceUrl,
            pucUrl: _pucFileUrl ?? widget.vehicle!.pucUrl,
          ));
        }

        if (mounted) {
          setState(() => _isSaving = false);
          await DialogUtils.showSuccessAnimation(context, widget.vehicle == null ? 'Vehicle Registered!' : 'Vehicle Updated!');
          if (mounted) Navigator.pop(context);
        }
      } catch (e) {
        if (mounted) {
          setState(() => _isSaving = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Failed to save vehicle: $e'), backgroundColor: AppTheme.danger),
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Material(
      color: Colors.white,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      clipBehavior: Clip.antiAlias,
      child: Container(
        padding: EdgeInsets.only(bottom: bottomInset + 16, top: 12, left: 20, right: 20),
        child: Column(
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[300],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  widget.vehicle == null ? 'Register New Vehicle' : 'Edit Vehicle Details',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
                ),
                IconButton(
                  icon: const Icon(LucideIcons.x, size: 20),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
            const Divider(),
            Expanded(
              child: SingleChildScrollView(
                controller: widget.scrollController,
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      TextFormField(
                        controller: _plateCtrl,
                        decoration: const InputDecoration(labelText: 'Registration Plate Number (e.g. KA01AB1234)'),
                        validator: (value) => value == null || value.isEmpty ? 'Required' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _makeCtrl,
                        decoration: const InputDecoration(labelText: 'Brand name ex: Tata, Bharatbenz..'),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _modelCtrl,
                        decoration: const InputDecoration(labelText: 'Model (e.g. Prima 2830)'),
                      ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      decoration: const InputDecoration(labelText: 'Vehicle Type / Body'),
                      value: _selectedType,
                      items: ['6 wheeler', '8 wheeler', '10+ wheelers'].map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                      onChanged: (val) => setState(() => _selectedType = val!),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      decoration: const InputDecoration(labelText: 'Fuel Type'),
                      value: _selectedFuelType,
                      items: ['Diesel', 'Petrol', 'CNG', 'EV'].map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                      onChanged: (val) => setState(() => _selectedFuelType = val!),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _fuelCapCtrl,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Fuel Capacity (Liters)'),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _milCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(labelText: 'Mileage (Average km/L)'),
                    ),
                    const SizedBox(height: 20),
                    const Text('Hardware Device ID (Microcontroller UID)', style: TextStyle(fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        icon: const Icon(LucideIcons.scanLine, size: 18),
                        label: const Text('Scan QR Code'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primaryBlue.withOpacity(0.1),
                          foregroundColor: AppTheme.primaryBlue,
                          elevation: 0,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        onPressed: () async {
                          final scannedId = await showDialog<String>(
                            context: context,
                            builder: (ctx) => const QrScannerDialog(),
                          );
                          if (scannedId != null && scannedId.isNotEmpty) {
                            setState(() {
                              _deviceIdCtrl.text = scannedId;
                            });
                          }
                        },
                      ),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _deviceIdCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Manual Entry Device ID',
                        isDense: true,
                      ),
                      validator: (value) => value == null || value.isEmpty ? 'Required for telemetry' : null,
                    ),
                    const SizedBox(height: 20),
                    const Text('Compliance Documents', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    const Divider(),
                    _buildDateRow('RC Registration Date', _rcRegDate, (date) => setState(() => _rcRegDate = date)),
                    _buildUploadRow('RC Document', _rcUploaded, _rcUploading, () => _pickAndUpload('rc')),
                    const Divider(height: 16),
                    _buildDateRow('Insurance Expiry Date', _insExpDate, (date) => setState(() => _insExpDate = date)),
                    _buildUploadRow('Insurance Certificate', _insUploaded, _insUploading, () => _pickAndUpload('insurance')),
                    const Divider(height: 16),
                    _buildDateRow('PUC Expiry Date', _pucExpDate, (date) => setState(() => _pucExpDate = date)),
                    _buildUploadRow('PUC Certificate', _pucUploaded, _pucUploading, () => _pickAndUpload('puc')),
                    const Divider(height: 16),
                    _buildDateRow('Next Service Date', _nextServiceDate, (date) => setState(() => _nextServiceDate = date)),
                    const Divider(height: 16),
                    _buildDateRow('National Permit Expiry Date', _permitDate, (date) => setState(() => _permitDate = date)),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: _isSaving ? null : _save,
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white),
                  child: _isSaving
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Text('Save Vehicle'),
                ),
              ),
            ],
          ),
        ],
      ),
    ),
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
  final String vehiclePlate;
  final VoidCallback onClose;

  const _VehicleDetailDrawer({
    required this.vehiclePlate,
    required this.onClose,
  });

  Color _headerColor(String status, bool isActive) {
    if (!isActive) return Colors.grey.shade600;
    final s = status.trim().toLowerCase();
    if (s == 'running') return const Color(0xFF1565C0);
    if (s == 'idle') return const Color(0xFFE65100);
    if (s == 'offline') return const Color(0xFF455A64);
    return AppTheme.primaryBlue;
  }

  @override
  Widget build(BuildContext context) {
    if (vehiclePlate.isEmpty) return const SizedBox.shrink();
    
    final engine = context.watch<DataEngine>();
    final vehicle = engine.vehicles.firstWhere(
      (v) => v.plate == vehiclePlate,
      orElse: () => Vehicle(
        plate: '', deviceId: '', year: 2024, type: '', status: 'offline',
        driver: '', loc: '', speed: 0, fuel: 0, mil: 0, idle: 0, fastag: 0,
        health: 0, odo: 0, nextService: '', insurance: '', permit: '', puc: '',
        lastFill: '', alerts: [], lat: 0, lng: 0,
      ),
    );

    if (vehicle.plate.isEmpty) return const SizedBox.shrink();
    final headerColor = _headerColor(vehicle.status, vehicle.isActive);
    final vHealth = engine.vehicleHealthScores[vehicle.plate];
    final healthBadgeLabel = vHealth?.healthScore != null ? 'Health: ${vHealth!.healthScore}/100 (${vHealth.status})' : 'Health: Insufficient Data';

    return Drawer(
      width: 380,
      child: Column(
        children: [
          // Header — color matches status
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(20, 56, 20, 20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [headerColor, headerColor.withOpacity(0.8)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(LucideIcons.truck, color: Colors.white, size: 22),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        vehicle.plate,
                        style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.bold),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    IconButton(onPressed: onClose, icon: const Icon(Icons.close, color: Colors.white, size: 20)),
                  ],
                ),
                if (vehicle.type.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(left: 32, top: 2),
                    child: Text(vehicle.type, style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13)),
                  ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 8,
                  runSpacing: 6,
                  children: [
                    _whiteBadge(vehicle.status.toUpperCase()),
                    _whiteBadge(healthBadgeLabel),
                  ],
                ),
              ],
            ),
          ),
          // Body
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                if (vHealth != null && vHealth.reasons.isNotEmpty) ...[
                  _sectionLabel('VEHICLE HEALTH AUDIT REASONS'),
                  const SizedBox(height: 8),
                  ...vHealth.reasons.map((r) => Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(vHealth.healthScore != null && vHealth.healthScore! >= 75 ? LucideIcons.checkCircle2 : LucideIcons.alertTriangle, size: 14, color: vHealth.healthScore != null && vHealth.healthScore! >= 75 ? AppTheme.primaryBlue : AppTheme.warning),
                        const SizedBox(width: 8),
                        Expanded(child: Text(r, style: const TextStyle(fontSize: 12, height: 1.3))),
                      ],
                    ),
                  )),
                  const Divider(height: 36),
                ],
                _sectionLabel('COMPLIANCE & DOCUMENTS'),
                _complianceRow('RC Registration', '${vehicle.year}', 'Year', false),
                _complianceRow('Insurance', vehicle.insurance, 'Expires', _isExpiring(vehicle.insurance)),
                _complianceRow('PUC', vehicle.puc, 'Expires', _isExpiring(vehicle.puc)),
                _complianceRow('Permit', vehicle.permit, 'Expires', _isExpiring(vehicle.permit)),
                _complianceRow('Next Service', vehicle.nextService, 'Due', _isExpiring(vehicle.nextService)),
                const Divider(height: 36),
                _sectionLabel('REAL-TIME STATS'),
                _statRow(LucideIcons.gauge, 'Odometer', '${vehicle.odo} km'),
                _statRow(LucideIcons.fuel, 'Current Fuel', '${vehicle.fuel}%'),
                _statRow(LucideIcons.user, 'Assigned Driver', vehicle.driver.isNotEmpty && vehicle.driver != 'Unassigned' ? vehicle.driver : '—'),
                _statRow(
                  LucideIcons.mapPin,
                  'Location',
                  vehicle.lat != 0.0 && vehicle.lng != 0.0
                      ? '${vehicle.lat.toStringAsFixed(5)}, ${vehicle.lng.toStringAsFixed(5)}'
                      : (vehicle.loc.isNotEmpty && vehicle.loc != 'Depot' ? vehicle.loc : '—'),
                ),
                const Divider(height: 36),
                _sectionLabel('RECENT TRIPS'),
                const SizedBox(height: 8),
                (() {
                  final vehicleTrips = engine.trips.where((t) => t.vehicle.trim().toUpperCase() == vehicle.plate.trim().toUpperCase()).toList();
                  if (vehicleTrips.isEmpty) {
                    return const Padding(
                      padding: EdgeInsets.only(bottom: 12),
                      child: Text('No trips recorded for this vehicle.', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                    );
                  }
                  return Column(
                    children: vehicleTrips.take(5).map((t) {
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        elevation: 0,
                        color: Colors.grey.shade50,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                          side: BorderSide(color: Colors.grey.shade200),
                        ),
                        child: ListTile(
                          dense: true,
                          contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          title: Text('${t.from.isNotEmpty ? t.from : "—"} → ${t.to.isNotEmpty ? t.to : "—"}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                          subtitle: Text('Driver: ${t.driver}  •  Status: ${t.status.toUpperCase()}', style: const TextStyle(fontSize: 10, color: AppTheme.textSecondary)),
                          trailing: Text(
                            '₹${t.moneyWasted.toStringAsFixed(0)}',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: t.moneyWasted > 0 ? AppTheme.danger : AppTheme.success,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  );
                })(),
                const Divider(height: 36),
                _sectionLabel('SERVICE HISTORY'),
                const SizedBox(height: 8),
                if (vehicle.serviceHistory.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(bottom: 12),
                    child: Text('No service records yet.', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                  )
                else
                  ...vehicle.serviceHistory.map((s) => ListTile(
                    dense: true,
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(LucideIcons.wrench, size: 16, color: AppTheme.textSecondary),
                    title: Text(s.type, style: const TextStyle(fontSize: 13)),
                    subtitle: Text(s.date, style: const TextStyle(fontSize: 11, color: AppTheme.textSecondary)),
                  )),
                const SizedBox(height: 16),
                ElevatedButton.icon(
                  onPressed: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: DateTime.now().add(const Duration(days: 7)),
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (picked != null) {
                      await engine.scheduleVehicleMaintenance(vehicle.plate, picked);
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Maintenance scheduled for ${picked.day}/${picked.month}/${picked.year}'),
                            backgroundColor: AppTheme.success,
                          ),
                        );
                      }
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primaryBlue,
                    foregroundColor: Colors.white,
                    minimumSize: const Size(double.infinity, 44),
                  ),
                  icon: const Icon(LucideIcons.calendar, size: 16),
                  label: const Text('Schedule Maintenance'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _whiteBadge(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.2),
        borderRadius: BorderRadius.circular(4),
        border: Border.all(color: Colors.white.withOpacity(0.4)),
      ),
      child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
    );
  }

  Widget _sectionLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(text, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11, color: AppTheme.textSecondary, letterSpacing: 0.5)),
    );
  }

  Widget _statRow(IconData icon, String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Icon(icon, size: 16, color: AppTheme.textSecondary),
          const SizedBox(width: 10),
          Expanded(child: Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13))),
          Flexible(
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }

  Widget _complianceRow(String label, String date, String prefix, bool isAlert) {
    final color = isAlert ? AppTheme.warning : AppTheme.success;
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                Text('$prefix: ${date.isNotEmpty ? date : "—"}', style: const TextStyle(color: AppTheme.textSecondary, fontSize: 11)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
            decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
            child: Text(isAlert ? 'Due Soon' : 'Valid', style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  bool _isExpiring(String dateStr) {
    if (dateStr.isEmpty) return false;
    try {
      final date = DateTime.parse(dateStr);
      return date.isBefore(DateTime.now().add(const Duration(days: 60)));
    } catch (_) {
      return false;
    }
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
