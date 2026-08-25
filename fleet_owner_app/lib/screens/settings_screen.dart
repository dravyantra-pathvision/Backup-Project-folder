import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../core/theme.dart';
import '../models/engine.dart';
import '../widgets/location_autocomplete.dart';
import '../services/location_search_service.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:provider/provider.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:go_router/go_router.dart';
import '../core/session_manager.dart';
import 'support_tickets_screen.dart';
import '../core/dialogs.dart';

// ─── Toast Helper ───────────────────────────────────────────────────────────
void _showToast(BuildContext context, String message, {bool success = true}) {
  final overlay = Overlay.of(context);
  late OverlayEntry entry;
  entry = OverlayEntry(builder: (ctx) => _ToastWidget(
    message: message,
    success: success,
    onDismiss: () => entry.remove(),
  ));
  overlay.insert(entry);
}

class _ToastWidget extends StatefulWidget {
  final String message;
  final bool success;
  final VoidCallback onDismiss;
  const _ToastWidget({required this.message, required this.success, required this.onDismiss});

  @override
  State<_ToastWidget> createState() => _ToastWidgetState();
}

class _ToastWidgetState extends State<_ToastWidget> with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 300));
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);
    _ctrl.forward();
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) {
        _ctrl.reverse().then((_) => widget.onDismiss());
      }
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Positioned(
      bottom: 80,
      left: 20,
      right: 20,
      child: FadeTransition(
        opacity: _anim,
        child: SlideTransition(
          position: Tween<Offset>(begin: const Offset(0, 0.3), end: Offset.zero).animate(_anim),
          child: Material(
            elevation: 8,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: widget.success ? const Color(0xFF166534) : const Color(0xFF991B1B),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(
                    widget.success ? LucideIcons.checkCircle : LucideIcons.xCircle,
                    color: Colors.white,
                    size: 20,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      widget.message,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  @override
  Widget build(BuildContext context) {
    final engine = context.watch<DataEngine>();

    return Scaffold(
      backgroundColor: Colors.transparent,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        title: const Text('Settings and Activity', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(vertical: 12),
        children: [
          _buildSectionHeader('Account & Profile'),
          _buildSettingTile(
            context,
            LucideIcons.building,
            'Organization Profile',
            'Manage company legal identity and contact info',
            (context) => OrgProfileSubScreen(engine: engine),
          ),
          _buildSettingTile(
            context,
            LucideIcons.user,
            'User Profile',
            'Personal settings and permissions',
            (context) => UserProfileSubScreen(engine: engine),
          ),
          
          _buildSectionHeader('Preferences'),
          _buildSettingTile(
            context, 
            LucideIcons.trendingUp, 
            'Fleet Settings', 
            'Configure fleet-wide speed and fuel theft limits', 
            (context) => FleetSettingsSubScreen(engine: engine),
          ),
          _buildSettingTile(
            context, 
            LucideIcons.sliders, 
            'Alert Thresholds', 
            'Define limits that trigger notifications', 
            (context) => AlertThresholdsSubScreen(engine: engine),
          ),
          _buildSectionHeader('Help & Support'),
          _buildSettingTile(
            context,
            LucideIcons.headphones,
            'Support Tickets',
            'View or create support requests',
            (context) => const SupportTicketsScreen(),
          ),



          const SizedBox(height: 24),
          ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
            leading: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppTheme.danger.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(LucideIcons.logOut, color: AppTheme.danger, size: 20),
            ),
            title: const Text('Log Out', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppTheme.danger)),
            onTap: () async {
              final confirm = await showDialog<bool>(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: const Text('Are you sure you want to log out?'),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, false),
                      child: const Text('Cancel'),
                    ),
                    TextButton(
                      onPressed: () => Navigator.pop(ctx, true),
                      child: const Text('Logout', style: TextStyle(color: Colors.red)),
                    ),
                  ],
                ),
              );

              if (confirm != true) return;

              if (mounted) {
                await DialogUtils.showSuccessAnimation(context, 'Logged Out Successfully');
              }

              await SessionManager.clearSession();
              await FirebaseAuth.instance.signOut();
              await GoogleSignIn().signOut();
              
              if (mounted) {
                Provider.of<DataEngine>(context, listen: false).clearData();
                context.go('/login');
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
      child: Text(title, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppTheme.textSecondary, letterSpacing: 0.5)),
    );
  }

  Widget _buildSettingTile(BuildContext context, IconData icon, String title, String subtitle, WidgetBuilder targetScreenBuilder, {bool showWarning = false}) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 24, vertical: 4),
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: AppTheme.primaryBlue.withOpacity(0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, color: AppTheme.primaryBlue, size: 20),
      ),
      title: Row(
        children: [
          Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
          if (showWarning) ...[
            const SizedBox(width: 8),
            const Icon(LucideIcons.alertTriangle, color: AppTheme.danger, size: 16),
          ],
        ],
      ),
      subtitle: Text(subtitle, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
      trailing: const Icon(LucideIcons.chevronRight, size: 18, color: AppTheme.textSecondary),
      onTap: () {
        Navigator.push(context, MaterialPageRoute(builder: (context) => Scaffold(
          appBar: AppBar(
            leading: IconButton(
              icon: const Icon(LucideIcons.arrowLeft),
              tooltip: 'Back',
              onPressed: () => Navigator.pop(context),
            ),
            title: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            elevation: 0,
            backgroundColor: Colors.transparent,
            foregroundColor: AppTheme.textPrimary,
          ),
          body: targetScreenBuilder(context),
        )));
      },
    );
  }
}


// Numeric Field helper
Widget _buildNumericField(String label, TextEditingController controller, {bool enabled = true}) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: TextField(
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9\.]'))],
      controller: controller,
      enabled: enabled,
      decoration: InputDecoration(
        labelText: label,
        labelStyle: const TextStyle(color: AppTheme.textSecondary),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      ),
    ),
  );
}

// Threshold Slider helper
Widget _buildThresholdSlider(String title, String value, double progress) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
            Text(value, style: const TextStyle(color: AppTheme.primaryBlue, fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 8),
        LinearProgressIndicator(value: progress, backgroundColor: Colors.grey.shade200, color: AppTheme.primaryBlue, minHeight: 6),
      ],
    ),
  );
}

// Channel Toggle helper
Widget _buildChannelToggle(String title, String desc, bool value, ValueChanged<bool> onChanged) {
  return ListTile(
    contentPadding: EdgeInsets.zero,
    title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
    subtitle: Text(desc, style: const TextStyle(fontSize: 12)),
    trailing: Switch(value: value, onChanged: onChanged, activeColor: AppTheme.primaryBlue),
  );
}

// ─── Shared View-Mode Info Card ──────────────────────────────────────────────
Widget _buildInfoCard(String label, String value, {bool readOnly = false, bool mandatory = false}) {
  final isEmpty = value.trim().isEmpty;
  return Container(
    margin: const EdgeInsets.only(bottom: 12),
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    decoration: BoxDecoration(
      color: AppTheme.surface,
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: const Color(0xFFe2e8f0)),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textSecondary,
                      letterSpacing: 0.4,
                    ),
                  ),
                  if (mandatory)
                    const Text(' *', style: TextStyle(color: AppTheme.danger, fontSize: 11, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                isEmpty ? '—' : value,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: isEmpty ? AppTheme.textSecondary : AppTheme.textPrimary,
                ),
              ),
            ],
          ),
        ),
        if (readOnly)
          const Icon(LucideIcons.lock, size: 14, color: AppTheme.textSecondary),
      ],
    ),
  );
}

Widget _buildSectionDivider(String label) {
  return Padding(
    padding: const EdgeInsets.only(top: 8, bottom: 12),
    child: Row(
      children: [
        Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppTheme.textSecondary, letterSpacing: 0.6)),
        const SizedBox(width: 8),
        Expanded(child: Divider(color: const Color(0xFFe2e8f0))),
      ],
    ),
  );
}

Widget _buildFormField(
  String label,
  TextEditingController controller, {
  bool mandatory = false,
  bool readOnly = false,
  String? Function(String?)? validator,
  TextInputType? keyboardType,
  int maxLines = 1,
  List<TextInputFormatter>? inputFormatters,
  Widget? suffix,
}) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: TextFormField(
      controller: controller,
      enabled: !readOnly,
      maxLines: maxLines,
      keyboardType: keyboardType,
      inputFormatters: inputFormatters,
      validator: validator,
      style: const TextStyle(fontSize: 15, color: AppTheme.textPrimary),
      decoration: InputDecoration(
        labelText: mandatory ? '$label *' : label,
        labelStyle: const TextStyle(color: AppTheme.textSecondary, fontSize: 14),
        suffixIcon: readOnly
            ? const Padding(padding: EdgeInsets.only(right: 12), child: Icon(LucideIcons.lock, size: 16, color: AppTheme.textSecondary))
            : suffix,
        suffixIconConstraints: const BoxConstraints(minWidth: 40),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFcbd5e1)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppTheme.primaryBlue, width: 2),
        ),
        disabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFe2e8f0)),
        ),
        filled: readOnly,
        fillColor: readOnly ? const Color(0xFFF8FAFC) : null,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
    ),
  );
}

Widget _buildDropdownField(
  String label,
  String? value,
  List<String> items,
  ValueChanged<String?> onChanged, {
  bool mandatory = false,
}) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: DropdownButtonFormField<String>(
      value: value?.isNotEmpty == true ? value : null,
      items: items
          .map((item) => DropdownMenuItem<String>(value: item, child: Text(item, style: const TextStyle(fontSize: 14))))
          .toList(),
      onChanged: onChanged,
      decoration: InputDecoration(
        labelText: mandatory ? '$label *' : label,
        labelStyle: const TextStyle(color: AppTheme.textSecondary, fontSize: 14),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: Color(0xFFcbd5e1)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppTheme.primaryBlue, width: 2),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      ),
      style: const TextStyle(fontSize: 14, color: AppTheme.textPrimary),
      dropdownColor: AppTheme.surface,
      isExpanded: true,
    ),
  );
}

Widget _buildNotifToggleRow(String label, bool value, ValueChanged<bool> onChanged) {
  return Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Row(
      children: [
        Expanded(child: Text(label, style: const TextStyle(fontSize: 14, color: AppTheme.textPrimary))),
        Switch(
          value: value,
          onChanged: onChanged,
          activeColor: AppTheme.primaryBlue,
          materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
      ],
    ),
  );
}

// ─── Profile Avatar ─────────────────────────────────────────────────────────
Widget _buildProfileAvatar(String initials, {VoidCallback? onTap, Color bgColor = AppTheme.primaryBlue}) {
  return GestureDetector(
    onTap: onTap,
    child: Stack(
      children: [
        CircleAvatar(
          radius: 42,
          backgroundColor: bgColor.withOpacity(0.15),
          child: Text(
            initials,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: bgColor,
            ),
          ),
        ),
        if (onTap != null)
          Positioned(
            bottom: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppTheme.primaryBlue,
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2),
              ),
              child: const Icon(LucideIcons.camera, size: 12, color: Colors.white),
            ),
          ),
      ],
    ),
  );
}

// --- Detail Screens ---

// 1. Organization Profile Screen

class OrgProfileSubScreen extends StatefulWidget {
  final DataEngine engine;
  const OrgProfileSubScreen({super.key, required this.engine});

  @override
  State<OrgProfileSubScreen> createState() => _OrgProfileSubScreenState();
}

class _OrgProfileSubScreenState extends State<OrgProfileSubScreen> {
  bool _canEdit() {
    final role = widget.engine.user.role.toLowerCase();
    return role.contains('fleet') || role.contains('admin');
  }

  Future<bool> _updateField(String label, String value, Organization Function(Organization, String) updater, {String? Function(String?)? validator}) async {
    if (!_canEdit()) return false;
    final success = await showSingleEditSheet(
      context: context,
      title: label,
      initialValue: value,
      validator: validator,
      onSave: (newVal) async {
        final newOrg = updater(widget.engine.org, newVal);
        final ok = await widget.engine.saveOrgProfile(newOrg);
        return ok;
      },
    );
    if (success == true && mounted) {
      setState(() {});
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$label updated successfully'), backgroundColor: const Color(0xFF166534)));
    }
    return success == true;
  }

  Future<void> _updateGSTIN() async {
    if (!_canEdit()) return;
    final success = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => GSTINEditBottomSheet(
        initialValue: widget.engine.org.gstin,
        onSave: (newVal) async {
          final newOrg = widget.engine.org.copyWith(gstin: newVal);
          return await widget.engine.saveOrgProfile(newOrg);
        },
      ),
    );
    if (success == true && mounted) {
      setState(() {});
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('GSTIN updated successfully'), backgroundColor: Color(0xFF166534)));
    }
  }

  Future<void> _updatePAN() async {
    if (!_canEdit()) return;
    final success = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => PANEditBottomSheet(
        initialValue: widget.engine.org.pan,
        onSave: (newVal) async {
          final newOrg = widget.engine.org.copyWith(pan: newVal);
          return await widget.engine.saveOrgProfile(newOrg);
        },
      ),
    );
    if (success == true && mounted) {
      setState(() {});
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('PAN updated successfully'), backgroundColor: Color(0xFF166534)));
    }
  }

  Future<void> _updateLocation() async {
    if (!_canEdit()) return;
    final success = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) => LocationEditBottomSheet(
        org: widget.engine.org,
        onSave: (newOrg) async {
          return await widget.engine.saveOrgProfile(newOrg);
        },
      ),
    );
    if (success == true && mounted) {
      setState(() {});
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Location updated successfully'), backgroundColor: Color(0xFF166534)));
    }
  }

  Future<void> _updateIndustryType() async {
    if (!_canEdit()) return;
    
    final List<String> options = [
      'Logistics & Transportation',
      'Manufacturing',
      'E-commerce & Retail',
      'Construction & Mining',
      'Agriculture',
      'Other',
    ];

    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (ctx) {
        return SafeArea(
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Padding(
                  padding: EdgeInsets.all(16.0),
                  child: Text('Select Industry Type', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                ),
                const Divider(height: 1),
                ...options.map((opt) => ListTile(
                  title: Text(opt),
                  trailing: widget.engine.org.industryType == opt ? const Icon(LucideIcons.check, color: AppTheme.primaryBlue) : null,
                  onTap: () => Navigator.pop(ctx, opt),
                )),
              ],
            ),
          ),
        );
      },
    );

    if (result != null && mounted) {
      if (result == 'Other') {
        final success = await showSingleEditSheet(
          context: context,
          title: 'Custom Industry Type',
          initialValue: '',
          onSave: (newVal) async {
            final newOrg = widget.engine.org.copyWith(industryType: newVal);
            return await widget.engine.saveOrgProfile(newOrg);
          },
        );
        if (success == true && mounted) {
          setState(() {});
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Industry Type updated successfully'), backgroundColor: Color(0xFF166534)));
        }
      } else {
        final newOrg = widget.engine.org.copyWith(industryType: result);
        final ok = await widget.engine.saveOrgProfile(newOrg);
        if (ok && mounted) {
          setState(() {});
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Industry Type updated successfully'), backgroundColor: Color(0xFF166534)));
        }
      }
    }
  }

  Widget _buildSettingRow(String title, String value, {VoidCallback? onTap, bool readOnly = false}) {
    return InkWell(
      onTap: readOnly ? null : onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
        child: Row(
          children: [
            Expanded(
              flex: 2,
              child: Text(title, style: const TextStyle(color: AppTheme.textPrimary, fontSize: 15, fontWeight: FontWeight.w500)),
            ),
            Expanded(
              flex: 3,
              child: Text(value.isEmpty ? 'Not set' : value, 
                style: TextStyle(color: value.isEmpty ? Colors.grey : AppTheme.textSecondary, fontSize: 15), 
                textAlign: TextAlign.right,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (!readOnly)
              const Padding(
                padding: EdgeInsets.only(left: 8),
                child: Icon(LucideIcons.chevronRight, size: 18, color: Colors.grey),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final engine = context.watch<DataEngine>();
    final org = engine.org;
    final canEdit = _canEdit();
    final initials = org.name.trim().isNotEmpty
        ? org.name.trim().split(' ').take(2).map((w) => w.isNotEmpty ? w[0].toUpperCase() : '').join()
        : 'OP';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _buildProfileAvatar(initials, onTap: null, bgColor: const Color(0xFF7C3AED)),
          const SizedBox(height: 12),
          Text(
            org.name.isNotEmpty ? org.name : 'Organization Profile',
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
          ),
          const SizedBox(height: 4),
          if (org.subscriptionPlan?.isNotEmpty == true)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: AppTheme.primaryBlue.withOpacity(0.1),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(org.subscriptionPlan!, style: const TextStyle(fontSize: 12, color: AppTheme.primaryBlue, fontWeight: FontWeight.bold)),
            ),
          const SizedBox(height: 32),
          
          Align(alignment: Alignment.centerLeft, child: _buildSectionDivider('COMPANY INFO')),
          _buildSettingRow('Company Name', org.name, readOnly: !canEdit, onTap: () => _updateField('Company Name', org.name, (o, v) => o.copyWith(name: v), validator: (value) => value == null || value.trim().isEmpty ? 'Required' : null)),
          const Divider(height: 1),
          _buildSettingRow('GSTIN', org.gstin, readOnly: !canEdit, onTap: _updateGSTIN),
          const Divider(height: 1),
          _buildSettingRow('PAN', org.pan, readOnly: !canEdit, onTap: _updatePAN),
          const Divider(height: 1),
          _buildSettingRow('Company Address', org.address ?? '', readOnly: !canEdit, onTap: _updateLocation),
          const Divider(height: 1),
          _buildSettingRow('City', org.city, readOnly: !canEdit, onTap: _updateLocation),
          const Divider(height: 1),
          _buildSettingRow('State', org.state, readOnly: !canEdit, onTap: _updateLocation),
          const Divider(height: 1),
          _buildSettingRow('Country', org.country, readOnly: !canEdit, onTap: () => _updateField('Country', org.country, (o, v) => o.copyWith(country: v), validator: (value) => value == null || value.trim().isEmpty ? 'Required' : null)),
          
          const SizedBox(height: 24),
          Align(alignment: Alignment.centerLeft, child: _buildSectionDivider('CONTACT & FLEET')),
          _buildSettingRow('Contact Phone', org.contactPhone, readOnly: !canEdit, onTap: () => _updateField('Contact Phone', org.contactPhone, (o, v) => o.copyWith(contactPhone: v), validator: (value) {
            if (value == null || value.trim().isEmpty) return 'Required';
            if (!RegExp(r'^\+91 [6-9]\d{9}$').hasMatch(value)) return 'Must be +91 followed by 10 digits starting with 6-9';
            return null;
          })),
          const Divider(height: 1),
          _buildSettingRow('Contact Email', org.contactEmail, readOnly: !canEdit, onTap: () => _updateField('Contact Email', org.contactEmail, (o, v) => o.copyWith(contactEmail: v), validator: (value) {
            if (value == null || value.trim().isEmpty) return 'Required';
            if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(value)) return 'Invalid Email';
            return null;
          })),
          const Divider(height: 1),
          _buildSettingRow('Fleet Size', org.fleetSize ?? '', readOnly: !canEdit, onTap: () => _updateField('Fleet Size', org.fleetSize ?? '', (o, v) => o.copyWith(fleetSize: v), validator: (value) => value == null || value.trim().isEmpty ? 'Required' : null)),
          const Divider(height: 1),
          _buildSettingRow('Industry Type', org.industryType ?? '', readOnly: !canEdit, onTap: _updateIndustryType),
          
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

class GSTINEditBottomSheet extends StatefulWidget {
  final String initialValue;
  final Future<bool> Function(String) onSave;

  const GSTINEditBottomSheet({super.key, required this.initialValue, required this.onSave});

  @override
  State<GSTINEditBottomSheet> createState() => _GSTINEditBottomSheetState();
}

class _GSTINEditBottomSheetState extends State<GSTINEditBottomSheet> {
  late TextEditingController _ctrl;
  bool _isSaving = false;

  bool _has15Chars = false;
  bool _hasStateCode = false;
  bool _hasPan = false;
  bool _hasEntityCode = false;
  bool _hasZ = false;
  bool _hasChecksum = false;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.initialValue);
    _validateGSTIN(widget.initialValue);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _validateGSTIN(String value) {
    setState(() {
      _has15Chars = value.length == 15;
      _hasStateCode = RegExp(r'^[0-9]{2}').hasMatch(value);
      _hasPan = RegExp(r'^.{2}[A-Z]{5}[0-9]{4}[A-Z]{1}').hasMatch(value);
      _hasEntityCode = RegExp(r'^.{12}[1-9A-Z]{1}').hasMatch(value);
      _hasZ = RegExp(r'^.{13}Z').hasMatch(value);
      _hasChecksum = RegExp(r'^.{14}[0-9A-Z]{1}$').hasMatch(value);
    });
  }

  bool get _isGSTINValid => _has15Chars && _hasStateCode && _hasPan && _hasEntityCode && _hasZ && _hasChecksum;

  Widget _buildChecklistItem(String title, bool isChecked) {
    return Row(
      children: [
        Icon(
          isChecked ? Icons.check_circle : Icons.circle_outlined,
          color: isChecked ? Colors.green : Colors.grey,
          size: 16,
        ),
        const SizedBox(width: 4),
        Expanded(child: Text(title, style: TextStyle(color: isChecked ? Colors.green : Colors.grey, fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis)),
      ],
    );
  }

  Future<void> _save() async {
    if (!_isGSTINValid) return;
    if (_ctrl.text.trim() == widget.initialValue.trim()) {
      Navigator.pop(context);
      return;
    }
    setState(() => _isSaving = true);
    final success = await widget.onSave(_ctrl.text.trim());
    if (mounted) {
      if (success) {
        Navigator.pop(context, true);
      } else {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to save')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset, left: 24, right: 24, top: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Edit GSTIN', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
              IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
            ],
          ),
          const SizedBox(height: 24),
          TextFormField(
            controller: _ctrl,
            onChanged: _validateGSTIN,
            decoration: const InputDecoration(labelText: 'GSTIN', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 8),
          Column(
            children: [
              Row(
                children: [
                  Expanded(child: _buildChecklistItem('15 Chars', _has15Chars)),
                  Expanded(child: _buildChecklistItem('State Code', _hasStateCode)),
                  Expanded(child: _buildChecklistItem('PAN', _hasPan)),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Expanded(child: _buildChecklistItem('Entity Code', _hasEntityCode)),
                  Expanded(child: _buildChecklistItem('Has Z', _hasZ)),
                  Expanded(child: _buildChecklistItem('Checksum', _hasChecksum)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white),
              onPressed: _isSaving || !_isGSTINValid ? null : _save,
              child: _isSaving ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Text('Save'),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class PANEditBottomSheet extends StatefulWidget {
  final String initialValue;
  final Future<bool> Function(String) onSave;

  const PANEditBottomSheet({super.key, required this.initialValue, required this.onSave});

  @override
  State<PANEditBottomSheet> createState() => _PANEditBottomSheetState();
}

class _PANEditBottomSheetState extends State<PANEditBottomSheet> {
  late TextEditingController _ctrl;
  bool _isSaving = false;

  bool _panHas10Chars = false;
  bool _panFirst5Letters = false;
  bool _panEntityCode = false;
  bool _pan4Numbers = false;
  bool _panLastLetter = false;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.initialValue);
    _validatePAN(widget.initialValue);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _validatePAN(String value) {
    setState(() {
      _panHas10Chars = value.length == 10;
      _panFirst5Letters = RegExp(r'^[A-Z]{5}').hasMatch(value);
      _panEntityCode = RegExp(r'^.{3}[PCHTFABJLEG]').hasMatch(value);
      _pan4Numbers = RegExp(r'^.{5}[0-9]{4}').hasMatch(value);
      _panLastLetter = RegExp(r'^.{9}[A-Z]$').hasMatch(value);
    });
  }

  bool get _isPANValid => _panHas10Chars && _panFirst5Letters && _panEntityCode && _pan4Numbers && _panLastLetter;

  Widget _buildChecklistItem(String title, bool isChecked) {
    return Row(
      children: [
        Icon(
          isChecked ? Icons.check_circle : Icons.circle_outlined,
          color: isChecked ? Colors.green : Colors.grey,
          size: 16,
        ),
        const SizedBox(width: 4),
        Expanded(child: Text(title, style: TextStyle(color: isChecked ? Colors.green : Colors.grey, fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis)),
      ],
    );
  }

  Future<void> _save() async {
    if (!_isPANValid) return;
    if (_ctrl.text.trim() == widget.initialValue.trim()) {
      Navigator.pop(context);
      return;
    }
    setState(() => _isSaving = true);
    final success = await widget.onSave(_ctrl.text.trim());
    if (mounted) {
      if (success) {
        Navigator.pop(context, true);
      } else {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to save')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset, left: 24, right: 24, top: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Edit PAN', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
              IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
            ],
          ),
          const SizedBox(height: 24),
          TextFormField(
            controller: _ctrl,
            onChanged: _validatePAN,
            decoration: const InputDecoration(labelText: 'PAN Number', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 8),
          Column(
            children: [
              Row(
                children: [
                  Expanded(child: _buildChecklistItem('10 Chars', _panHas10Chars)),
                  Expanded(child: _buildChecklistItem('5 Letters', _panFirst5Letters)),
                  Expanded(child: _buildChecklistItem('Entity Code', _panEntityCode)),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Expanded(child: _buildChecklistItem('4 Numbers', _pan4Numbers)),
                  Expanded(child: _buildChecklistItem('Last Letter', _panLastLetter)),
                  const Spacer(),
                ],
              ),
            ],
          ),
          const SizedBox(height: 32),
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white),
              onPressed: _isSaving || !_isPANValid ? null : _save,
              child: _isSaving ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Text('Save'),
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

class LocationEditBottomSheet extends StatefulWidget {
  final Organization org;
  final Future<bool> Function(Organization) onSave;

  const LocationEditBottomSheet({super.key, required this.org, required this.onSave});

  @override
  State<LocationEditBottomSheet> createState() => _LocationEditBottomSheetState();
}

class _LocationEditBottomSheetState extends State<LocationEditBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  bool _isSaving = false;
  late TextEditingController _addressCtrl;
  late TextEditingController _cityCtrl;
  late TextEditingController _stateCtrl;

  @override
  void initState() {
    super.initState();
    _addressCtrl = TextEditingController(text: widget.org.address ?? '');
    _cityCtrl = TextEditingController(text: widget.org.city);
    _stateCtrl = TextEditingController(text: widget.org.state);
  }

  @override
  void dispose() {
    _addressCtrl.dispose();
    _cityCtrl.dispose();
    _stateCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    
    setState(() => _isSaving = true);
    final newOrg = widget.org.copyWith(
      address: _addressCtrl.text.trim(),
      city: _cityCtrl.text.trim(),
      state: _stateCtrl.text.trim(),
    );
    final success = await widget.onSave(newOrg);
    if (mounted) {
      if (success) {
        Navigator.pop(context, true);
      } else {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to save')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset, left: 24, right: 24, top: 24),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Edit Location', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppTheme.textPrimary)),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
              ],
            ),
            const SizedBox(height: 24),
            LocationAutocomplete(
              initialValue: _addressCtrl.text,
              labelText: 'Search Address / Location',
              onSelected: (suggestion) {
                setState(() {
                  _addressCtrl.text = suggestion.displayName;
                  if (suggestion.city.isNotEmpty) _cityCtrl.text = suggestion.city;
                  if (suggestion.state.isNotEmpty) _stateCtrl.text = suggestion.state;
                });
              },
              validator: (v) => v == null || v.isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _cityCtrl,
                    decoration: const InputDecoration(labelText: 'City', border: OutlineInputBorder()),
                    validator: (v) => v!.isEmpty ? 'Required' : null,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: TextFormField(
                    controller: _stateCtrl,
                    decoration: const InputDecoration(labelText: 'State', border: OutlineInputBorder()),
                    validator: (v) => v!.isEmpty ? 'Required' : null,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white),
                onPressed: _isSaving ? null : _save,
                child: _isSaving ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2)) : const Text('Save'),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

class SingleEditBottomSheet extends StatefulWidget {
  final String title;
  final String initialValue;
  final Future<bool> Function(String) onSave;
  final String? Function(String?)? validator;
  final TextInputType keyboardType;
  final List<TextInputFormatter>? inputFormatters;

  const SingleEditBottomSheet({
    super.key,
    required this.title,
    required this.initialValue,
    required this.onSave,
    this.validator,
    this.keyboardType = TextInputType.text,
    this.inputFormatters,
  });

  @override
  State<SingleEditBottomSheet> createState() => _SingleEditBottomSheetState();
}

class _SingleEditBottomSheetState extends State<SingleEditBottomSheet> {
  late TextEditingController _ctrl;
  final _formKey = GlobalKey<FormState>();
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.initialValue);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_ctrl.text.trim() == widget.initialValue.trim()) {
      Navigator.pop(context);
      return;
    }
    setState(() => _isSaving = true);
    final success = await widget.onSave(_ctrl.text.trim());
    if (mounted) {
      setState(() => _isSaving = false);
      if (success) {
        await DialogUtils.showSuccessAnimation(context, '${widget.title} Updated!');
        if (mounted) Navigator.pop(context, true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 20,
        right: 20,
        top: 24,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Edit ${widget.title}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 20),
            TextFormField(
              controller: _ctrl,
              autofocus: true,
              keyboardType: widget.keyboardType,
              inputFormatters: widget.inputFormatters,
              validator: widget.validator,
              decoration: InputDecoration(
                labelText: widget.title,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _isSaving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primaryBlue,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _isSaving 
                    ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Save', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}

Future<bool?> showSingleEditSheet({
  required BuildContext context,
  required String title,
  required String initialValue,
  required Future<bool> Function(String) onSave,
  String? Function(String?)? validator,
  TextInputType keyboardType = TextInputType.text,
  List<TextInputFormatter>? inputFormatters,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => SingleEditBottomSheet(
      title: title,
      initialValue: initialValue,
      onSave: onSave,
      validator: validator,
      keyboardType: keyboardType,
      inputFormatters: inputFormatters,
    ),
  );
}


// 2. User Profile Screen
class UserProfileSubScreen extends StatefulWidget {
  final DataEngine engine;
  const UserProfileSubScreen({super.key, required this.engine});

  @override
  State<UserProfileSubScreen> createState() => _UserProfileSubScreenState();
}

class _UserProfileSubScreenState extends State<UserProfileSubScreen> {
  Future<bool> _updateField(String label, String value, UserAccount Function(UserAccount, String) updater, {String? Function(String?)? validator}) async {
    final success = await showSingleEditSheet(
      context: context,
      title: label,
      initialValue: value,
      validator: validator,
      onSave: (newVal) async {
        final newUser = updater(widget.engine.user, newVal);
        final ok = await widget.engine.saveUserProfile(newUser);
        return ok;
      },
    );
    if (success == true && mounted) {
      setState(() {});
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$label updated successfully'), backgroundColor: const Color(0xFF166534)));
    }
    return success == true;
  }

  Widget _buildSettingRow(String title, String value, {VoidCallback? onTap, bool readOnly = false}) {
    return InkWell(
      onTap: readOnly ? null : onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
        child: Row(
          children: [
            Expanded(
              flex: 2,
              child: Text(title, style: const TextStyle(color: AppTheme.textPrimary, fontSize: 15, fontWeight: FontWeight.w500)),
            ),
            Expanded(
              flex: 3,
              child: Text(value.isEmpty ? 'Not set' : value, 
                style: TextStyle(color: value.isEmpty ? Colors.grey : AppTheme.textSecondary, fontSize: 15), 
                textAlign: TextAlign.right,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            if (!readOnly)
              const Padding(
                padding: EdgeInsets.only(left: 8),
                child: Icon(LucideIcons.chevronRight, size: 18, color: Colors.grey),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final engine = context.watch<DataEngine>();
    final u = engine.user;
    final initials = u.name.trim().isNotEmpty
        ? u.name.trim().split(' ').take(2).map((w) => w.isNotEmpty ? w[0].toUpperCase() : '').join()
        : 'U';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          _buildProfileAvatar(initials, onTap: null),
          const SizedBox(height: 12),
          Text(
            u.name.isNotEmpty ? u.name : 'Your Profile',
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: AppTheme.textPrimary),
          ),
          const SizedBox(height: 4),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: AppTheme.primaryBlue.withOpacity(0.1),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(u.role, style: const TextStyle(fontSize: 12, color: AppTheme.primaryBlue, fontWeight: FontWeight.bold)),
          ),
          const SizedBox(height: 32),
          
          Align(alignment: Alignment.centerLeft, child: _buildSectionDivider('PERSONAL INFO')),
          _buildSettingRow('Full Name', u.name, onTap: () => _updateField('Full Name', u.name, (u, v) => u.copyWith(name: v), validator: (value) => value == null || value.trim().isEmpty ? 'Required' : null)),
          const Divider(height: 1),
          _buildSettingRow('Work Email', u.email, readOnly: true),
          const Divider(height: 1),
          _buildSettingRow('Phone Number', u.phone, onTap: () => _updateField('Phone Number', u.phone, (u, v) => u.copyWith(phone: v), validator: (value) {
            if (value == null || value.trim().isEmpty) return 'Required';
            if (!RegExp(r'^(\+91[\-\s]?)?[6-9]\d{9}$').hasMatch(value.replaceAll(RegExp(r'\s+'), ''))) return 'Invalid Indian Mobile Number';
            return null;
          })),
          const Divider(height: 1),
          _buildSettingRow('Employee ID', u.employeeId ?? '', onTap: () => _updateField('Employee ID', u.employeeId ?? '', (u, v) => u.copyWith(employeeId: v))),
          const Divider(height: 1),
          _buildSettingRow('Department', u.department ?? '', onTap: () => _updateField('Department', u.department ?? '', (u, v) => u.copyWith(department: v))),
          const Divider(height: 1),
          _buildSettingRow('Language', u.languagePref ?? '', onTap: () => _updateField('Language', u.languagePref ?? '', (u, v) => u.copyWith(languagePref: v))),
          
          const SizedBox(height: 32),
        ],
      ),
    );
  }
}

Widget _buildNotifViewRow(String label, bool value) {
  return Row(
    children: [
      Expanded(child: Text(label, style: const TextStyle(fontSize: 14, color: AppTheme.textPrimary))),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: value ? AppTheme.success.withOpacity(0.12) : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          value ? 'ON' : 'OFF',
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.bold,
            color: value ? AppTheme.success : AppTheme.textSecondary,
          ),
        ),
      ),
    ],
  );
}

// 3. Fleet Settings Screen

class FleetSettingsSubScreen extends StatefulWidget {
  final DataEngine engine;
  const FleetSettingsSubScreen({super.key, required this.engine});

  @override
  State<FleetSettingsSubScreen> createState() => _FleetSettingsSubScreenState();
}

class _FleetSettingsSubScreenState extends State<FleetSettingsSubScreen> {
  late final TextEditingController _fleetSpeedController;
  late final TextEditingController _fleetFuelController;
  late final TextEditingController _fleetIdleController;
  late final TextEditingController _fleetMileageController;
  late final TextEditingController _fleetFuelPriceController;

  bool _isEditingFleet = false;
  bool _fleetSavedSuccessfully = false;

  @override
  void initState() {
    super.initState();
    _fleetSpeedController = TextEditingController(text: widget.engine.alertSettings.speedThreshold.toString());
    _fleetFuelController = TextEditingController(text: widget.engine.alertSettings.fuelDropThreshold.toStringAsFixed(1));
    _fleetIdleController = TextEditingController(text: widget.engine.alertSettings.idleLimit.toString());
    _fleetMileageController = TextEditingController(text: widget.engine.alertSettings.mileageThreshold.toStringAsFixed(1));
    _fleetFuelPriceController = TextEditingController(text: widget.engine.alertSettings.fuelPricePerLiter.toStringAsFixed(1));
  }

  @override
  void dispose() {
    _fleetSpeedController.dispose();
    _fleetFuelController.dispose();
    _fleetIdleController.dispose();
    _fleetMileageController.dispose();
    _fleetFuelPriceController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final engine = context.watch<DataEngine>();
    final settings = engine.alertSettings;

    if (!_isEditingFleet) {
      _fleetSpeedController.text = settings.speedThreshold.toString();
      _fleetFuelController.text = settings.fuelDropThreshold.toStringAsFixed(1);
      _fleetIdleController.text = settings.idleLimit.toString();
      _fleetMileageController.text = settings.mileageThreshold.toStringAsFixed(1);
      _fleetFuelPriceController.text = settings.fuelPricePerLiter.toStringAsFixed(1);
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Fleet Settings', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const Text('Set fleet and user-specific limits for speeding, fuel theft, and fuel price.', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          const SizedBox(height: 24),
          if (_fleetSavedSuccessfully) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: AppTheme.success.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppTheme.success.withOpacity(0.3)),
              ),
              child: const Row(
                children: [
                  Icon(LucideIcons.checkCircle, color: AppTheme.success, size: 18),
                  SizedBox(width: 8),
                  Text('Saved successfully!', style: TextStyle(color: AppTheme.success, fontWeight: FontWeight.bold, fontSize: 13)),
                ],
              ),
            ),
          ],
          _buildNumericField(
            'Fleet over-speeding limit (km/h)',
            _fleetSpeedController,
            enabled: _isEditingFleet,
          ),
          _buildNumericField(
            'Fleet fuel theft limit (L)',
            _fleetFuelController,
            enabled: _isEditingFleet,
          ),
          _buildNumericField(
            'Idle duration limit (mins)',
            _fleetIdleController,
            enabled: _isEditingFleet,
          ),
          _buildNumericField(
            'Low mileage threshold (km/L)',
            _fleetMileageController,
            enabled: _isEditingFleet,
          ),
          _buildNumericField(
            'Default Fuel Price (₹/L)',
            _fleetFuelPriceController,
            enabled: _isEditingFleet,
          ),
          const SizedBox(height: 24),
          if (!_isEditingFleet)
            ElevatedButton.icon(
              onPressed: () {
                setState(() {
                  _isEditingFleet = true;
                  _fleetSavedSuccessfully = false;
                });
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white, minimumSize: const Size(180, 45)),
              icon: const Icon(LucideIcons.edit2, size: 16),
              label: const Text('Edit Fleet Settings'),
            )
          else
            Row(
              children: [
                OutlinedButton(
                  onPressed: () {
                    setState(() {
                      _isEditingFleet = false;
                      _fleetSpeedController.text = settings.speedThreshold.toString();
                      _fleetFuelController.text = settings.fuelDropThreshold.toStringAsFixed(1);
                      _fleetIdleController.text = settings.idleLimit.toString();
                      _fleetMileageController.text = settings.mileageThreshold.toStringAsFixed(1);
                      _fleetFuelPriceController.text = settings.fuelPricePerLiter.toStringAsFixed(1);
                    });
                  },
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(100, 45),
                    side: const BorderSide(color: AppTheme.textSecondary),
                  ),
                  child: const Text('Cancel', style: TextStyle(color: AppTheme.textSecondary)),
                ),
                const SizedBox(width: 16),
                ElevatedButton(
                  onPressed: () async {
                    final speed = int.tryParse(_fleetSpeedController.text.trim());
                    final fuel = double.tryParse(_fleetFuelController.text.trim());
                    final idle = int.tryParse(_fleetIdleController.text.trim());
                    final mileage = double.tryParse(_fleetMileageController.text.trim());
                    final price = double.tryParse(_fleetFuelPriceController.text.trim());
                    if (speed == null || fuel == null || idle == null || mileage == null || price == null) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Enter valid fleet settings values')),
                      );
                      return;
                    }
                    await engine.updateAlertSettings(
                      settings.copyWith(
                        speedThreshold: speed,
                        fuelDropThreshold: fuel,
                        idleLimit: idle,
                        mileageThreshold: mileage,
                        fuelPricePerLiter: price,
                      ),
                    );
                    if (mounted) {
                      setState(() {
                        _isEditingFleet = false;
                        _fleetSavedSuccessfully = true;
                      });
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white, minimumSize: const Size(120, 45)),
                  child: const Text('Save'),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

// 4. Alert Thresholds Screen
class AlertThresholdsSubScreen extends StatefulWidget {
  final DataEngine engine;
  const AlertThresholdsSubScreen({super.key, required this.engine});

  @override
  State<AlertThresholdsSubScreen> createState() => _AlertThresholdsSubScreenState();
}

class _AlertThresholdsSubScreenState extends State<AlertThresholdsSubScreen> {
  @override
  Widget build(BuildContext context) {
    final engine = context.watch<DataEngine>();
    final settings = engine.alertSettings;
    
    final orgEmail = engine.org.contactEmail.isNotEmpty ? engine.org.contactEmail : engine.user.email;
    final orgPhone = engine.org.contactPhone.isNotEmpty ? engine.org.contactPhone : engine.user.phone;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Alert Thresholds', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const Text('Define limits that trigger system notifications', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          const SizedBox(height: 24),
          _buildThresholdSlider('Over-speed Limit', '${settings.speedThreshold} km/h', settings.speedThreshold / 120),
          _buildThresholdSlider('Idle Duration Limit', '${settings.idleLimit} mins', settings.idleLimit / 60),
          _buildThresholdSlider('Fuel Theft Limit', '${settings.fuelDropThreshold.toStringAsFixed(1)} L', settings.fuelDropThreshold / 20),
          _buildThresholdSlider('Low Mileage Threshold', '${settings.mileageThreshold} km/L', (settings.mileageThreshold) / 10.0),
          const Divider(height: 48),
          const Text('Notification Channels', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          _buildChannelToggle('WhatsApp Alerts', 'Sent to: ${orgPhone.isEmpty ? 'Not set' : orgPhone}', settings.whatsappEnabled, (v) {
            engine.updateAlertSettings(settings.copyWith(whatsappEnabled: v));
          }),
          _buildChannelToggle('SMS Alerts', 'Sent to: ${orgPhone.isEmpty ? 'Not set' : orgPhone}', settings.smsEnabled, (v) {
            engine.updateAlertSettings(settings.copyWith(smsEnabled: v));
          }),
          _buildChannelToggle('Email Alerts', 'Sent to: ${orgEmail.isEmpty ? 'Not set' : orgEmail}', settings.emailEnabled, (v) {
            engine.updateAlertSettings(settings.copyWith(emailEnabled: v));
          }),
          _buildChannelToggle('Push Notifications', 'Real-time dashboard updates', settings.pushEnabled, (v) {
            engine.updateAlertSettings(settings.copyWith(pushEnabled: v));
          }),
        ],
      ),
    );
  }
}

// 5. Connection Settings Screen
class ConnectionSettingsSubScreen extends StatefulWidget {
  final DataEngine engine;
  const ConnectionSettingsSubScreen({super.key, required this.engine});

  @override
  State<ConnectionSettingsSubScreen> createState() => _ConnectionSettingsSubScreenState();
}

class _ConnectionSettingsSubScreenState extends State<ConnectionSettingsSubScreen> {
  late final TextEditingController _connectionController;

  bool _isEditingConnection = false;
  bool _connectionSavedSuccessfully = false;

  @override
  void initState() {
    super.initState();
    _connectionController = TextEditingController(text: widget.engine.backendBaseUrl ?? widget.engine.baseUrl);
  }

  @override
  void dispose() {
    _connectionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Connection Settings', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const Text('Enter a custom backend server URL if you need to override the default connection for testing.', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          const SizedBox(height: 24),
          if (_connectionSavedSuccessfully) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: AppTheme.success.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppTheme.success.withOpacity(0.3)),
              ),
              child: const Row(
                children: [
                  Icon(LucideIcons.checkCircle, color: AppTheme.success, size: 18),
                  SizedBox(width: 8),
                  Text('Saved successfully!', style: TextStyle(color: AppTheme.success, fontWeight: FontWeight.bold, fontSize: 13)),
                ],
              ),
            ),
          ],
          TextField(
            controller: _connectionController,
            enabled: _isEditingConnection,
            decoration: InputDecoration(
              labelText: 'Backend Base URL',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
          const SizedBox(height: 24),
          if (!_isEditingConnection)
            ElevatedButton.icon(
              onPressed: () {
                setState(() {
                  _isEditingConnection = true;
                  _connectionSavedSuccessfully = false;
                });
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white, minimumSize: const Size(180, 45)),
              icon: const Icon(LucideIcons.edit2, size: 16),
              label: const Text('Edit Connection Settings'),
            )
          else
            Row(
              children: [
                OutlinedButton(
                  onPressed: () {
                    setState(() {
                      _isEditingConnection = false;
                      _connectionController.text = widget.engine.backendBaseUrl ?? widget.engine.baseUrl;
                    });
                  },
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size(100, 45),
                    side: const BorderSide(color: AppTheme.textSecondary),
                  ),
                  child: const Text('Cancel', style: TextStyle(color: AppTheme.textSecondary)),
                ),
                const SizedBox(width: 16),
                ElevatedButton(
                  onPressed: () async {
                    final val = _connectionController.text.trim();
                    await widget.engine.setBackendBaseUrl(val);
                    if (mounted) {
                      setState(() {
                        _isEditingConnection = false;
                        _connectionSavedSuccessfully = true;
                      });
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white, minimumSize: const Size(120, 45)),
                  child: const Text('Save'),
                ),
              ],
            ),
        ],
      ),
    );
  }
}

