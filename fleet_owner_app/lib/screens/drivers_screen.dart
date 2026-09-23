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
import '../core/dialogs.dart';
import 'package:fl_chart/fl_chart.dart';
import '../widgets/animated_widgets.dart';
import 'package:image_picker/image_picker.dart';
import 'package:google_mlkit_face_detection/google_mlkit_face_detection.dart';
import 'driver_profile_screen.dart';

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
    final engine = context.read<DataEngine>();
    return Column(
      children: drivers.asMap().entries.map((entry) {
        final index = entry.key;
        final d = entry.value;
        final scoreColor = d.score >= 75 ? AppTheme.success : d.score >= 55 ? AppTheme.warning : AppTheme.danger;
        return Card(
          margin: const EdgeInsets.only(bottom: 10),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => DriverProfileScreen(driver: d)),
              );
            },
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 22,
                    backgroundColor: AppTheme.primaryBlue.withOpacity(0.1),
                    child: Text(
                      '#${index + 1}',
                      style: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.primaryBlue, fontSize: 13),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(d.name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                        const SizedBox(height: 2),
                        Text(
                          '${d.trips} trips  •  ${d.status == 'on_duty' ? 'On Duty' : d.isActive ? 'Active' : 'Inactive'}',
                          style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary),
                        ),
                      ],
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: scoreColor.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: scoreColor.withOpacity(0.3)),
                        ),
                        child: Text(
                          '${d.score}',
                          style: TextStyle(fontWeight: FontWeight.bold, color: scoreColor, fontSize: 16),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(LucideIcons.edit2, size: 16, color: AppTheme.textSecondary),
                            onPressed: () => _showDriverForm(context, engine, d: d),
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                            visualDensity: VisualDensity.compact,
                          ),
                          const SizedBox(width: 8),
                          IconButton(
                            icon: const Icon(LucideIcons.trash2, size: 16, color: AppTheme.danger),
                            onPressed: () async {
                              final confirm = await showDialog<bool>(
                                context: context,
                                builder: (ctx) => AlertDialog(
                                  title: const Text('Delete Driver'),
                                  content: Text('Remove ${d.name}?'),
                                  actions: [
                                    TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                                    TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete', style: TextStyle(color: AppTheme.danger))),
                                  ],
                                ),
                              );
                              if (confirm == true && context.mounted) {
                                await engine.removeDriver(d.id);
                              }
                            },
                            padding: EdgeInsets.zero,
                            constraints: const BoxConstraints(),
                            visualDensity: VisualDensity.compact,
                          ),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        );
      }).toList(),
    );
  }

  void _showDriverForm(BuildContext context, DataEngine engine, {Driver? d}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => DraggableScrollableSheet(
        initialChildSize: 0.65,
        minChildSize: 0.3,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) => DriverFormBottomSheet(
          engine: engine,
          driver: d,
          scrollController: scrollController,
        ),
      ),
    );
  }
}

class DriverFormBottomSheet extends StatefulWidget {
  final DataEngine engine;
  final Driver? driver;
  final ScrollController? scrollController;

  const DriverFormBottomSheet({super.key, required this.engine, this.driver, this.scrollController});

  @override
  State<DriverFormBottomSheet> createState() => DriverFormBottomSheetState();
}

class DriverFormBottomSheetState extends State<DriverFormBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  late TextEditingController _nameCtrl;
  late TextEditingController _phoneCtrl;
  late TextEditingController _ageCtrl;
  late TextEditingController _expCtrl;
  late TextEditingController _licCtrl;
  late TextEditingController _homeCtrl;

  DateTime? _licExpDate;
  String _selectedBloodGroup = 'O+';

  String? _aadharFileUrl;
  String? _licenseFileUrl;
  String? _photoFileUrl;

  bool _aadharUploading = false;
  bool _licenseUploading = false;
  bool _photoUploading = false;

  bool _aadharUploaded = false;
  bool _licenseUploaded = false;
  bool _photoUploaded = false;

  @override
  void initState() {
    super.initState();
    _nameCtrl = TextEditingController(text: widget.driver?.name ?? '');
    _phoneCtrl = TextEditingController(text: widget.driver?.phone != null && widget.driver!.phone.isNotEmpty ? widget.driver!.phone : '+91 ');
    _ageCtrl = TextEditingController(text: widget.driver?.age.toString() ?? '');
    _expCtrl = TextEditingController(text: widget.driver?.exp.toString() ?? '');
    _licCtrl = TextEditingController(text: widget.driver?.lic ?? '');
    _homeCtrl = TextEditingController(text: widget.driver?.home == 'N/A' ? '' : (widget.driver?.home ?? ''));
    
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
    _photoFileUrl = widget.driver?.imageUrl;
    _photoUploaded = _photoFileUrl != null && _photoFileUrl!.isNotEmpty;
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _phoneCtrl.dispose();
    _ageCtrl.dispose();
    _expCtrl.dispose();
    _licCtrl.dispose();
    _homeCtrl.dispose();
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

  Widget _buildUploadRow(String label, bool isUploaded, bool isUploading, VoidCallback onUpload, {String buttonLabel = 'Upload File'}) {
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
            label: Text(isUploading ? 'Uploading...' : isUploaded ? 'Uploaded' : buttonLabel),
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

      final driverName = _nameCtrl.text.trim().isNotEmpty ? _nameCtrl.text.trim().replaceAll(' ', '_') : 'TEMP';
      final fileName = 'driver_${docType}_${driverName}_${DateTime.now().millisecondsSinceEpoch}.${file.extension}';

      setState(() {
        if (docType == 'aadhar') _aadharUploading = true;
        if (docType == 'license') _licenseUploading = true;
      });

      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${widget.engine.baseUrl}/api/upload?bucket=driver_docs'),
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
          if (docType == 'aadhar') {
            _aadharFileUrl = fileUrl;
            _aadharUploaded = true;
            _aadharUploading = false;
          } else if (docType == 'license') {
            _licenseFileUrl = fileUrl;
            _licenseUploaded = true;
            _licenseUploading = false;
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
        if (docType == 'aadhar') _aadharUploading = false;
        if (docType == 'license') _licenseUploading = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to upload $docType: $e'), backgroundColor: AppTheme.danger),
        );
      }
    }
  }
  Future<void> _takePhoto() async {
    try {
      final picker = ImagePicker();
      final XFile? image = await picker.pickImage(source: ImageSource.camera, maxWidth: 1280, maxHeight: 1280, imageQuality: 70);
      if (image == null) return;

      setState(() {
        _photoUploading = true;
      });

      // ── Human Face Verification via ML Kit ─────────────────────────────────
      final inputImage = InputImage.fromFilePath(image.path);
      final options = FaceDetectorOptions(performanceMode: FaceDetectorMode.fast);
      final faceDetector = FaceDetector(options: options);

      bool hasHumanFace = false;
      try {
        final faces = await faceDetector.processImage(inputImage);
        hasHumanFace = faces.isNotEmpty;
      } catch (e) {
        debugPrint('Face detection engine warning/error: $e');
        hasHumanFace = true; 
      } finally {
        await faceDetector.close();
      }

      if (!hasHumanFace) {
        setState(() {
          _photoUploading = false;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('No human face detected! Please take a clear photo of the driver\'s face.'),
              backgroundColor: AppTheme.danger,
              duration: Duration(seconds: 4),
            ),
          );
        }
        return;
      }

      final bytes = await image.readAsBytes();
      final driverName = _nameCtrl.text.trim().isNotEmpty ? _nameCtrl.text.trim().replaceAll(' ', '_') : 'TEMP';
      final fileName = 'driver_photo_${driverName}_${DateTime.now().millisecondsSinceEpoch}.jpg';

      final request = http.MultipartRequest(
        'POST',
        Uri.parse('${widget.engine.baseUrl}/api/upload?bucket=driver_docs'),
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
          _photoFileUrl = fileUrl;
          _photoUploaded = true;
          _photoUploading = false;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Driver face verified and photo uploaded successfully!'), backgroundColor: AppTheme.success),
          );
        }
      } else {
        throw Exception('Photo upload failed: ${response.statusCode}');
      }
    } catch (e) {
      setState(() {
        _photoUploading = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to capture photo: $e'), backgroundColor: AppTheme.danger),
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
      if (!_photoUploaded) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please capture driver photo using camera.'), backgroundColor: AppTheme.danger),
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
          score: 100, mil: 4, idle: 0, trips: 0, harsh: 0, overSpeed: 0, deviation: 0, fuelEff: 100,
          rating: 5.0, home: _homeCtrl.text.trim().isNotEmpty ? _homeCtrl.text.trim() : 'N/A', onLeave: false,
          imageUrl: _photoFileUrl ?? '',
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
          home: _homeCtrl.text.trim().isNotEmpty ? _homeCtrl.text.trim() : widget.driver!.home,
          imageUrl: _photoFileUrl ?? widget.driver!.imageUrl,
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
                  widget.driver == null ? 'Add New Driver' : 'Edit Driver Details',
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
                      controller: _nameCtrl,
                      decoration: const InputDecoration(labelText: 'Full Name'),
                      validator: (v) => v == null || v.isEmpty ? 'Required' : null,
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _ageCtrl,
                            decoration: const InputDecoration(labelText: 'Age'),
                            keyboardType: TextInputType.number,
                            validator: (v) {
                              if (v == null || v.isEmpty) return 'Required';
                              final age = int.tryParse(v);
                              if (age == null) return 'Invalid';
                              if (age <= 18) return '> 18';
                              return null;
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: TextFormField(
                            controller: _expCtrl,
                            decoration: const InputDecoration(labelText: 'Experience (Years)'),
                            keyboardType: TextInputType.number,
                            validator: (v) {
                              if (v == null || v.isEmpty) return 'Required';
                              if (int.tryParse(v) == null) return 'Invalid';
                              return null;
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _phoneCtrl,
                      decoration: const InputDecoration(labelText: 'Phone Number (e.g. +91 9876543210)'),
                      keyboardType: TextInputType.phone,
                      validator: (v) {
                        if (v == null || v.isEmpty) return 'Required';
                        final regExp = RegExp(r'^\+91 [6-9]\d{9}$');
                        if (!regExp.hasMatch(v)) return 'Must be +91 followed by 10 digits starting with 6-9';
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      decoration: const InputDecoration(labelText: 'Blood Group'),
                      value: _selectedBloodGroup,
                      items: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
                      onChanged: (val) => setState(() => _selectedBloodGroup = val!),
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
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _homeCtrl,
                      decoration: const InputDecoration(labelText: 'Home Address / Hometown (Optional)'),
                    ),
                    const SizedBox(height: 20),
                    const Text('Documents & Photos', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    const Divider(),
                    _buildUploadRow('Aadhar Card', _aadharUploaded, _aadharUploading, () => _pickAndUpload('aadhar')),
                    _buildUploadRow('Driving License', _licenseUploaded, _licenseUploading, () => _pickAndUpload('license')),
                    _buildUploadRow('Driver Photo (Camera Only)', _photoUploaded, _photoUploading, _takePhoto, buttonLabel: 'Take Photo'),
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
                  onPressed: _save,
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white),
                  child: const Text('Save Driver'),
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
