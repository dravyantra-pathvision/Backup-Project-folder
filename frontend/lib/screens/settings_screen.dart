import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../core/theme.dart';

import 'package:provider/provider.dart';
import '../models/engine.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _twoFactorEnabled = false;
  String _apiKey = 'sk_live_...5f4d';
  final TextEditingController _fleetSpeedController = TextEditingController();
  final TextEditingController _fleetFuelController = TextEditingController();
  bool _fleetDraftInitialized = false;

  @override
  void dispose() {
    _fleetSpeedController.dispose();
    _fleetFuelController.dispose();
    super.dispose();
  }

  void _syncFleetDrafts(DataEngine engine) {
    if (_fleetDraftInitialized) return;
    _fleetSpeedController.text = engine.alertSettings.speedThreshold.toString();
    _fleetFuelController.text = engine.alertSettings.fuelDropThreshold.toStringAsFixed(1);
    _fleetDraftInitialized = true;
  }
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
          _buildSettingTile(context, LucideIcons.building, 'Organization Profile', 'Manage company legal identity and contact info', _buildOrgTab(engine)),
          _buildSettingTile(context, LucideIcons.user, 'User Profile', 'Personal settings and permissions', _buildAccountTab(engine)),
          
          _buildSectionHeader('Preferences'),
          _buildSettingTile(context, LucideIcons.trendingUp, 'Fleet Settings', 'Configure fleet-wide speed and fuel theft limits', _buildFleetSettingsTab(engine)),
          _buildSettingTile(context, LucideIcons.sliders, 'Alert Thresholds', 'Define limits that trigger notifications', _buildAlertsTab(engine)),
          _buildSettingTile(context, LucideIcons.bell, 'Notifications & Alerts', 'Manage how and when you are notified', _buildNotificationsTab(engine)),
          _buildSettingTile(context, LucideIcons.puzzle, 'External Integrations', 'Connect third-party services', _buildIntegrationsTab(engine)),
          
          _buildSectionHeader('Security'),
          _buildSettingTile(context, LucideIcons.shield, 'Security Settings', 'Password and authentication', _buildSecurityTab(engine)),
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

  Widget _buildSettingTile(BuildContext context, IconData icon, String title, String subtitle, Widget targetScreen) {
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
      title: Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppTheme.textPrimary)),
      subtitle: Text(subtitle, style: const TextStyle(fontSize: 12, color: AppTheme.textSecondary)),
      trailing: const Icon(LucideIcons.chevronRight, size: 18, color: AppTheme.textSecondary),
      onTap: () {
        Navigator.push(context, MaterialPageRoute(builder: (context) => Scaffold(
          appBar: AppBar(
            title: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            elevation: 0,
            backgroundColor: Colors.transparent,
            foregroundColor: AppTheme.textPrimary,
          ),
          body: targetScreen,
        )));
      },
    );
  }

  Widget _buildOrgTab(DataEngine engine) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Organization Profile', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const Text('Manage company legal identity and contact info', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          const SizedBox(height: 24),
          _buildTextField('Company Name', engine.org.name),
          _buildTextField('GSTIN', engine.org.gstin),
          Row(
            children: [
              Expanded(child: _buildTextField('City', engine.org.city)),
              const SizedBox(width: 16),
              Expanded(child: _buildTextField('State', engine.org.state)),
            ],
          ),
          _buildTextField('Contact Email / Phone', engine.org.contact),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white, minimumSize: const Size(150, 45)),
            child: const Text('Save Organization Info'),
          ),
        ],
      ),
    );
  }

  Widget _buildAccountTab(DataEngine engine) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('User Profile', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const Text('Personal settings and role-based permissions', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          const SizedBox(height: 24),
          _buildTextField('Full Name', engine.user.name),
          _buildTextField('Work Email', engine.user.email),
          _buildTextField('Phone Number', engine.user.phone),
          _buildTextField('Role', engine.user.role, enabled: false),
          _buildTextField('Timezone', engine.user.timezone),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white, minimumSize: const Size(150, 45)),
            child: const Text('Update Profile'),
          ),
        ],
      ),
    );
  }

  Widget _buildFleetSettingsTab(DataEngine engine) {
    _syncFleetDrafts(engine);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Fleet Settings', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const Text('Set fleet and user-specific limits for speeding and fuel theft alerts.', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          const SizedBox(height: 24),
          _buildNumericField(
            'Fleet over-speeding limit (km/h)',
            _fleetSpeedController,
          ),
          _buildNumericField(
            'Fleet fuel theft limit (L)',
            _fleetFuelController,
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              ElevatedButton.icon(
                onPressed: () async {
                  final speed = int.tryParse(_fleetSpeedController.text.trim());
                  final fuel = double.tryParse(_fleetFuelController.text.trim());
                  if (speed == null || fuel == null) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Enter valid fleet settings values')),
                    );
                    return;
                  }
                  await engine.updateAlertSettings(
                    engine.alertSettings.copyWith(
                      speedThreshold: speed,
                      fuelDropThreshold: fuel,
                    ),
                  );
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Fleet settings saved')),
                    );
                  }
                },
                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white),
                icon: const Icon(LucideIcons.save, size: 16),
                label: const Text('Save Fleet Settings'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAlertsTab(DataEngine engine) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Alert Thresholds', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const Text('Define limits that trigger system notifications', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          const SizedBox(height: 24),
          _buildThresholdSlider('Over-speed Limit', '${engine.alertSettings.speedThreshold} km/h', engine.alertSettings.speedThreshold / 120),
          _buildThresholdSlider('Idle Duration Limit', '${engine.alertSettings.idleLimit} mins', engine.alertSettings.idleLimit / 60),
          _buildThresholdSlider('Fuel Theft Limit', '${engine.alertSettings.fuelDropThreshold.toStringAsFixed(1)} L', engine.alertSettings.fuelDropThreshold / 20),
          _buildThresholdSlider('FASTag Low Balance', '₹${engine.alertSettings.fastagThreshold}', engine.alertSettings.fastagThreshold / 2000),
          _buildThresholdSlider('Low Mileage Threshold', '${engine.alertSettings.mileageThreshold} km/L', (engine.alertSettings.mileageThreshold ?? 3.0) / 10.0),
          const Divider(height: 48),
          const Text('Notification Channels', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          _buildChannelToggle('WhatsApp Alerts', 'Critical safety and fuel events', engine.alertSettings.whatsappEnabled),
          _buildChannelToggle('SMS Alerts', 'Compliance and network events', engine.alertSettings.smsEnabled),
          _buildChannelToggle('Email Alerts', 'Reports and non-critical updates', true),
          _buildChannelToggle('Push Notifications', 'Real-time dashboard updates', engine.alertSettings.pushEnabled),
        ],
      ),
    );
  }

  Widget _buildSecurityTab(DataEngine engine) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Security Settings', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 24),
          const TextField(decoration: InputDecoration(labelText: 'Current Password', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          const TextField(decoration: InputDecoration(labelText: 'New Password', border: OutlineInputBorder())),
          const SizedBox(height: 16),
          const TextField(decoration: InputDecoration(labelText: 'Confirm New Password', border: OutlineInputBorder())),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primaryBlue, foregroundColor: Colors.white),
            child: const Text('Change Password'),
          ),
          const Divider(height: 48),
          const Text('Two-Factor Authentication', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          ListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Enable 2FA', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
            subtitle: const Text('Secure your account with a secondary code', style: TextStyle(fontSize: 12)),
            trailing: Switch(
              value: _twoFactorEnabled, 
              onChanged: (v) {
                setState(() {
                  _twoFactorEnabled = v;
                });
              }, 
              activeColor: AppTheme.primaryBlue
            ),
          ),
          const Divider(height: 48),
          const Text('Developer API Keys', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          const Text('Use API keys to access fleet data programmatically.', style: TextStyle(color: AppTheme.textSecondary, fontSize: 12)),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: Text(
                  _apiKey, 
                  style: const TextStyle(fontFamily: 'Courier', fontWeight: FontWeight.bold),
                  overflow: TextOverflow.ellipsis,
                )
              ),
              IconButton(
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: _apiKey));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('API Key copied to clipboard')),
                  );
                }, 
                icon: const Icon(LucideIcons.copy, size: 16)
              ),
              IconButton(
                onPressed: () {
                  setState(() {
                    _apiKey = 'No API Key';
                  });
                }, 
                icon: const Icon(LucideIcons.trash2, size: 16, color: AppTheme.danger)
              ),
            ],
          ),
          const Divider(height: 48),
          const Text('Danger Zone', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppTheme.danger)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 16,
            runSpacing: 12,
            children: [
              OutlinedButton(
                onPressed: () {},
                style: OutlinedButton.styleFrom(foregroundColor: AppTheme.primaryBlue),
                child: const Text('Export Account Data'),
              ),
              OutlinedButton(
                onPressed: () {},
                style: OutlinedButton.styleFrom(foregroundColor: AppTheme.danger),
                child: const Text('Delete Account'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildIntegrationsTab(DataEngine engine) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('External Integrations', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const Text('Connect third-party services to enrich fleet data', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          const SizedBox(height: 24),
          _buildIntegrationTile('Vahan API', 'Vehicle registration and compliance data', true),
          _buildIntegrationTile('FASTag', 'Electronic toll collection and balance tracking', true),
          _buildIntegrationTile('GST Portal', 'e-Way bill generation and verification', false),
          _buildIntegrationTile('Insurance Providers', 'Auto-fetch insurance renewal dates', false),
          _buildIntegrationTile('GPS Providers', 'Connect external GPS hardware', true),
        ],
      ),
    );
  }

  Widget _buildIntegrationTile(String title, String desc, bool connected) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
      subtitle: Text(desc, style: const TextStyle(fontSize: 12)),
      trailing: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(color: (connected ? AppTheme.success : AppTheme.textSecondary).withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
        child: Text(connected ? 'CONNECTED' : 'DISCONNECTED', style: TextStyle(color: connected ? AppTheme.success : AppTheme.textSecondary, fontSize: 10, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildTextField(String label, String value, {bool enabled = true}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextField(
        controller: TextEditingController(text: value),
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

  Widget _buildNumericField(String label, TextEditingController controller) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextField(
        keyboardType: const TextInputType.numberWithOptions(decimal: true),
        inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9\.]'))],
        controller: controller,
        decoration: InputDecoration(
          labelText: label,
          labelStyle: const TextStyle(color: AppTheme.textSecondary),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      ),
    );
  }

  Widget _buildReadOnlyValue(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 14, color: AppTheme.textSecondary)),
          Text(value, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

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

  Widget _buildChannelToggle(String title, String desc, bool value) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
      subtitle: Text(desc, style: const TextStyle(fontSize: 12)),
      trailing: Switch(value: value, onChanged: (v) {}, activeColor: AppTheme.primaryBlue),
    );
  }

  Widget _buildNotificationsTab(DataEngine engine) {
    final settings = engine.alertSettings;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Notification Delivery', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const Text('Manage how you receive alerts', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          const SizedBox(height: 24),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
            childAspectRatio: 2.5,
            children: [
              _channelCard('WhatsApp', LucideIcons.messageSquare, settings.whatsappEnabled, (v) {
                engine.updateAlertSettings(settings.copyWith(whatsappEnabled: v));
              }),
              _channelCard('SMS', LucideIcons.smartphone, settings.smsEnabled, (v) {
                engine.updateAlertSettings(settings.copyWith(smsEnabled: v));
              }),
              _channelCard('Email', LucideIcons.mail, settings.emailEnabled, (v) {
                engine.updateAlertSettings(settings.copyWith(emailEnabled: v));
              }),
              _channelCard('Push', LucideIcons.bell, settings.pushEnabled, (v) {
                engine.updateAlertSettings(settings.copyWith(pushEnabled: v));
              }),
            ],
          ),
          const SizedBox(height: 32),
          const Text('Alert Types Enabled', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const Text('Select which events trigger notifications', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: settings.perTypeToggles.entries.map((e) {
              final isEnabled = e.value;
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                decoration: BoxDecoration(
                  color: isEnabled ? AppTheme.primaryBlue.withOpacity(0.1) : Colors.grey.shade100,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: isEnabled ? AppTheme.primaryBlue.withOpacity(0.3) : Colors.grey.shade300),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      e.key.toUpperCase(), 
                      style: TextStyle(
                        fontSize: 11, 
                        fontWeight: FontWeight.bold,
                        color: isEnabled ? AppTheme.primaryBlue : AppTheme.textSecondary
                      )
                    ),
                    const SizedBox(width: 4),
                    Switch(
                      value: isEnabled,
                      onChanged: (val) {
                        final newToggles = Map<String, bool>.from(settings.perTypeToggles);
                        newToggles[e.key] = val;
                        engine.updateAlertSettings(settings.copyWith(perTypeToggles: newToggles));
                      },
                      activeColor: AppTheme.primaryBlue,
                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _channelCard(String title, IconData icon, bool value, Function(bool) onChanged) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Row(
        children: [
          Icon(icon, color: AppTheme.primaryBlue, size: 18),
          const SizedBox(width: 8),
          Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
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
}
