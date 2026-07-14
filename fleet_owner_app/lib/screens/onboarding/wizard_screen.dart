import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../../core/theme.dart';
import '../../services/onboarding_service.dart';
import '../../widgets/location_autocomplete.dart';

class OnboardingWizardScreen extends StatefulWidget {
  const OnboardingWizardScreen({super.key});

  @override
  State<OnboardingWizardScreen> createState() => _OnboardingWizardScreenState();
}

class _OnboardingWizardScreenState extends State<OnboardingWizardScreen> {
  int _currentStep = 0;
  bool _isLoading = true;
  String _companyName = '';
  String _contactNumber = '';
  String _contactEmail = '';
  
  final _addressCtrl = TextEditingController();
  final _cityCtrl = TextEditingController();
  final _stateCtrl = TextEditingController();

  String _pan = '';
  String _gstin = '';
  String _fleetSize = '1-10';
  String _industryType = 'Logistics';

  bool _panHas10Chars = false;
  bool _panFirst5Letters = false;
  bool _panEntityCode = false;
  bool _pan4Numbers = false;
  bool _panLastLetter = false;

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

  bool _has15Chars = false;
  bool _hasStateCode = false;
  bool _hasPan = false;
  bool _hasEntityCode = false;
  bool _hasZ = false;
  bool _hasChecksum = false;

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

  final _formKeys = [GlobalKey<FormState>(), GlobalKey<FormState>(), GlobalKey<FormState>()];

  @override
  void initState() {
    super.initState();
    _loadStatus();
  }

  @override
  void dispose() {
    _addressCtrl.dispose();
    _cityCtrl.dispose();
    _stateCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadStatus() async {
    try {
      final status = await OnboardingService.getStatus();
      setState(() {
        _companyName = status['company_name'] ?? '';
        _contactNumber = status['contact_number'] ?? '';
        _contactEmail = status['contact_email'] ?? '';
        _addressCtrl.text = status['address'] ?? '';
        _cityCtrl.text = status['city'] ?? '';
        _stateCtrl.text = status['state'] ?? '';
        _pan = status['pan'] ?? '';
        _validatePAN(_pan);
        _gstin = status['gstin'] ?? '';
        _validateGSTIN(_gstin);
        _fleetSize = status['fleet_size'] ?? '1-10';
        _industryType = status['industry_type'] ?? 'Logistics';

        final progress = (status['profile_completion'] as num?)?.toInt() ?? 0;
        if (progress >= 75) _currentStep = 2;
        else if (progress >= 50) _currentStep = 1;
        else _currentStep = 0;

        _isLoading = false;
      });
    } catch (e) {
      debugPrint('Error loading onboarding status: $e');
      setState(() => _isLoading = false);
    }
  }

  Future<void> _saveStep() async {
    if (!_formKeys[_currentStep].currentState!.validate()) return;
    _formKeys[_currentStep].currentState!.save();
    
    setState(() => _isLoading = true);
    
    try {
      Map<String, dynamic> data = {};
      if (_currentStep == 0) {
        data = {'company_name': _companyName, 'contact_number': _contactNumber, 'contact_email': _contactEmail};
      } else if (_currentStep == 1) {
        data = {
          'address': _addressCtrl.text.trim(),
          'city': _cityCtrl.text.trim(),
          'state': _stateCtrl.text.trim(),
        };
      } else if (_currentStep == 2) {
        data = {'pan': _pan, 'gstin': _gstin, 'fleet_size': _fleetSize, 'industry_type': _industryType};
      }

      await OnboardingService.updateStep(_currentStep + 1, data);
      
      setState(() {
        _isLoading = false;
        if (_currentStep < 2) {
          _currentStep++;
        }
      });
    } catch (e) {
      debugPrint('Error saving step: $e');
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
      setState(() => _isLoading = false);
    }
  }

  Future<void> _submit() async {
    if (!_formKeys[2].currentState!.validate()) return;
    if (!_isPANValid) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter a valid PAN format')));
      return;
    }
    if (!_isGSTINValid) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter a valid GSTIN format')));
      return;
    }
    _formKeys[2].currentState!.save();
    
    setState(() => _isLoading = true);
    try {
      // Save last step
      await OnboardingService.updateStep(3, {
        'pan': _pan, 'gstin': _gstin, 'fleet_size': _fleetSize, 'industry_type': _industryType
      });
      // Submit for approval
      await OnboardingService.submitForApproval();
      if (mounted) context.go('/pending-approval');
    } catch (e) {
      debugPrint('Error submitting: $e');
      setState(() => _isLoading = false);
    }
  }

  Widget _buildStep0() {
    return Form(
      key: _formKeys[0],
      child: Column(
        children: [
          TextFormField(
            initialValue: _companyName,
            decoration: const InputDecoration(labelText: 'Company Name', border: OutlineInputBorder()),
            validator: (v) => v!.isEmpty ? 'Required' : null,
            onSaved: (v) => _companyName = v!,
          ),
          const SizedBox(height: 16),
          TextFormField(
            initialValue: _contactNumber.isEmpty ? '+91 ' : _contactNumber,
            decoration: const InputDecoration(labelText: 'Contact Phone', border: OutlineInputBorder()),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Required';
              if (!RegExp(r'^\+91 [6-9]\d{9}$').hasMatch(v)) return 'Must be +91 followed by 10 digits starting with 6-9';
              return null;
            },
            onSaved: (v) => _contactNumber = v!,
          ),
          const SizedBox(height: 16),
          TextFormField(
            initialValue: _contactEmail,
            decoration: const InputDecoration(labelText: 'Contact Email', border: OutlineInputBorder()),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Required';
              if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(v)) return 'Invalid Email';
              return null;
            },
            onSaved: (v) => _contactEmail = v!,
          ),
        ],
      ),
    );
  }

  Widget _buildStep1() {
    return Form(
      key: _formKeys[1],
      child: Column(
        children: [
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
        ],
      ),
    );
  }

  Widget _buildStep2() {
    return Form(
      key: _formKeys[2],
      child: Column(
        children: [
          TextFormField(
            initialValue: _pan,
            decoration: const InputDecoration(labelText: 'PAN Number', border: OutlineInputBorder()),
            onChanged: _validatePAN,
            validator: (v) {
               if (v == null || v.isEmpty) return 'Required';
               if (!_isPANValid) return 'Invalid PAN format';
               return null;
            },
            onSaved: (v) => _pan = v!,
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
          const SizedBox(height: 16),
          TextFormField(
            initialValue: _gstin,
            decoration: const InputDecoration(labelText: 'GSTIN', border: OutlineInputBorder()),
            onChanged: _validateGSTIN,
            validator: (v) {
               if (v == null || v.isEmpty) return 'Required';
               if (!_isGSTINValid) return 'Invalid GSTIN format';
               return null;
            },
            onSaved: (v) => _gstin = v ?? '',
          ),
          const SizedBox(height: 8),
          Column(
            children: [
              Row(
                children: [
                  Expanded(child: _buildChecklistItem('15 Chars', _has15Chars)),
                  Expanded(child: _buildChecklistItem('State Code (2 nums)', _hasStateCode)),
                  Expanded(child: _buildChecklistItem('PAN (10 chars)', _hasPan)),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Expanded(child: _buildChecklistItem('Entity (1 char)', _hasEntityCode)),
                  Expanded(child: _buildChecklistItem('Has Z', _hasZ)),
                  Expanded(child: _buildChecklistItem('Checksum (1 char)', _hasChecksum)),
                ],
              ),
            ],
          ),
          const SizedBox(height: 16),
          DropdownButtonFormField<String>(
            value: _fleetSize,
            decoration: const InputDecoration(labelText: 'Fleet Size', border: OutlineInputBorder()),
            items: ['1-10', '11-50', '50-100', '100+']
                .map((e) => DropdownMenuItem(value: e, child: Text(e)))
                .toList(),
            onChanged: (v) => setState(() => _fleetSize = v!),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) return const Scaffold(body: Center(child: CircularProgressIndicator()));

    return Scaffold(
      appBar: AppBar(title: const Text('Complete Organization Profile')),
      body: Stepper(
        type: StepperType.vertical,
        currentStep: _currentStep,
        onStepContinue: _currentStep < 2 ? _saveStep : _submit,
        onStepCancel: _currentStep > 0 ? () => setState(() => _currentStep -= 1) : null,
        steps: [
          Step(
            title: const Text('Basic Information'),
            content: _buildStep0(),
            isActive: _currentStep >= 0,
            state: _currentStep > 0 ? StepState.complete : StepState.editing,
          ),
          Step(
            title: const Text('Location'),
            content: _buildStep1(),
            isActive: _currentStep >= 1,
            state: _currentStep > 1 ? StepState.complete : _currentStep == 1 ? StepState.editing : StepState.indexed,
          ),
          Step(
            title: const Text('Business Details'),
            content: _buildStep2(),
            isActive: _currentStep >= 2,
            state: _currentStep == 2 ? StepState.editing : StepState.indexed,
          ),
        ],
      ),
    );
  }
}
