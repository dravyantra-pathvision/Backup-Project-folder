import 'package:flutter/material.dart';
import 'dart:async';
import '../services/location_search_service.dart';
import '../core/theme.dart';
import 'package:lucide_icons/lucide_icons.dart';

class LocationAutocomplete extends StatefulWidget {
  final String? initialValue;
  final String labelText;
  final void Function(LocationSuggestion) onSelected;
  final String? Function(String?)? validator;

  const LocationAutocomplete({
    super.key,
    this.initialValue,
    required this.labelText,
    required this.onSelected,
    this.validator,
  });

  @override
  State<LocationAutocomplete> createState() => _LocationAutocompleteState();
}

class _LocationAutocompleteState extends State<LocationAutocomplete> {
  Timer? _debounce;
  bool _isLoading = false;
  late TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.initialValue ?? '');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Autocomplete<LocationSuggestion>(
      initialValue: TextEditingValue(text: widget.initialValue ?? ''),
      displayStringForOption: (option) => option.displayName,
      optionsBuilder: (TextEditingValue textEditingValue) async {
        if (textEditingValue.text.trim().length < 3) {
          return const Iterable<LocationSuggestion>.empty();
        }

        final completer = Completer<Iterable<LocationSuggestion>>();

        if (_debounce?.isActive ?? false) _debounce!.cancel();
        
        setState(() => _isLoading = true);
        
        _debounce = Timer(const Duration(milliseconds: 800), () async {
          final results = await LocationSearchService.search(textEditingValue.text);
          if (mounted) {
            setState(() => _isLoading = false);
            completer.complete(results);
          } else {
            completer.complete([]);
          }
        });

        return completer.future;
      },
      onSelected: (suggestion) {
        widget.onSelected(suggestion);
      },
      fieldViewBuilder: (context, controller, focusNode, onFieldSubmitted) {
        return TextFormField(
          controller: controller,
          focusNode: focusNode,
          validator: widget.validator,
          decoration: InputDecoration(
            labelText: widget.labelText,
            border: const OutlineInputBorder(),
            suffixIcon: _isLoading 
                ? const SizedBox(width: 16, height: 16, child: Padding(padding: EdgeInsets.all(12), child: CircularProgressIndicator(strokeWidth: 2)))
                : const Icon(LucideIcons.search, size: 20),
          ),
        );
      },
      optionsViewBuilder: (context, onSelected, options) {
        return Align(
          alignment: Alignment.topLeft,
          child: Material(
            elevation: 4,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            child: ConstrainedBox(
              constraints: BoxConstraints(maxHeight: 300, maxWidth: MediaQuery.of(context).size.width - 32),
              child: ListView.separated(
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                itemCount: options.length,
                separatorBuilder: (context, index) => const Divider(height: 1),
                itemBuilder: (context, index) {
                  final option = options.elementAt(index);
                  final parts = option.displayName.split(',');
                  final title = parts.isNotEmpty ? parts.first.trim() : '';
                  final subtitle = parts.length > 1 ? parts.skip(1).join(',').trim() : '';
                  
                  return ListTile(
                    leading: const Icon(LucideIcons.mapPin, color: AppTheme.primaryBlue),
                    title: Text(title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w600)),
                    subtitle: subtitle.isNotEmpty ? Text(subtitle, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12)) : null,
                    onTap: () => onSelected(option),
                  );
                },
              ),
            ),
          ),
        );
      },
    );
  }
}
