import 'dart:async';
import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../models/city.dart';
import '../services/city_search_service.dart';
import '../core/theme.dart';

class CitySearchScreen extends StatefulWidget {
  final String title; // "Leaving From" or "Going To"

  const CitySearchScreen({super.key, required this.title});

  @override
  State<CitySearchScreen> createState() => _CitySearchScreenState();
}

class _CitySearchScreenState extends State<CitySearchScreen> {
  final TextEditingController _searchCtrl = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  final CitySearchService _service = CitySearchService();

  List<City> _results = [];
  bool _isLoading = false;
  bool _hasSearched = false;
  String? _error;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    // Auto-focus the search field
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _focusNode.dispose();
    _debounce?.cancel();
    _service.dispose();
    super.dispose();
  }

  void _onSearchChanged(String query) {
    _debounce?.cancel();

    if (query.trim().length < 2) {
      setState(() {
        _results = [];
        _hasSearched = false;
        _isLoading = false;
        _error = null;
      });
      return;
    }

    setState(() => _isLoading = true);

    _debounce = Timer(const Duration(milliseconds: 300), () async {
      try {
        final results = await _service.searchCities(query);
        if (mounted) {
          setState(() {
            _results = results;
            _isLoading = false;
            _hasSearched = true;
            _error = null;
          });
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _error = 'Failed to search cities';
            _isLoading = false;
            _hasSearched = true;
          });
        }
      }
    });
  }

  void _selectCity(City city) {
    Navigator.pop(context, city);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Column(
          children: [
            // ─── Top Bar with back button and search ───
            Container(
              padding: const EdgeInsets.fromLTRB(4, 8, 16, 8),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.05),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(LucideIcons.chevronLeft, size: 24),
                    onPressed: () => Navigator.pop(context),
                    color: Colors.grey.shade800,
                  ),
                  Expanded(
                    child: Container(
                      height: 44,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
                        borderRadius: BorderRadius.circular(22),
                      ),
                      child: TextField(
                        controller: _searchCtrl,
                        focusNode: _focusNode,
                        onChanged: _onSearchChanged,
                        style: const TextStyle(fontSize: 15),
                        decoration: InputDecoration(
                          hintText: widget.title,
                          hintStyle: TextStyle(color: Colors.grey.shade500, fontSize: 15),
                          prefixIcon: Icon(LucideIcons.search, size: 18, color: Colors.grey.shade500),
                          suffixIcon: _searchCtrl.text.isNotEmpty
                              ? IconButton(
                                  icon: Icon(LucideIcons.x, size: 16, color: Colors.grey.shade500),
                                  onPressed: () {
                                    _searchCtrl.clear();
                                    _onSearchChanged('');
                                  },
                                )
                              : null,
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // ─── "Search by City" label ───
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.grey.shade50,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Text(
                  'Search by City',
                  style: TextStyle(color: Colors.grey.shade500, fontSize: 14),
                ),
              ),
            ),

            // ─── Results ───
            Expanded(
              child: _buildBody(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody() {
    // Loading state
    if (_isLoading) {
      return const Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            SizedBox(
              width: 32,
              height: 32,
              child: CircularProgressIndicator(strokeWidth: 2.5, color: AppTheme.ecoGreen),
            ),
            SizedBox(height: 12),
            Text('Searching cities...', style: TextStyle(color: Colors.grey, fontSize: 13)),
          ],
        ),
      );
    }

    // Error state
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.alertTriangle, size: 48, color: Colors.orange.shade300),
            const SizedBox(height: 12),
            Text(_error!, style: const TextStyle(color: Colors.grey, fontSize: 14)),
            const SizedBox(height: 8),
            TextButton(
              onPressed: () => _onSearchChanged(_searchCtrl.text),
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    // No results
    if (_hasSearched && _results.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.mapPinOff, size: 48, color: Colors.grey.shade300),
            const SizedBox(height: 12),
            const Text('No matching cities found', style: TextStyle(color: Colors.grey, fontSize: 14)),
            const SizedBox(height: 4),
            Text(
              'Try a different spelling',
              style: TextStyle(color: Colors.grey.shade400, fontSize: 12),
            ),
          ],
        ),
      );
    }

    // Initial state — no search yet
    if (!_hasSearched) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.mapPin, size: 56, color: Colors.grey.shade200),
            const SizedBox(height: 16),
            Text(
              'Type a city name to search',
              style: TextStyle(color: Colors.grey.shade400, fontSize: 14),
            ),
          ],
        ),
      );
    }

    // Results list
    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      itemCount: _results.length,
      separatorBuilder: (_, __) => Divider(
        height: 1,
        thickness: 0.5,
        color: Colors.grey.shade200,
        indent: 64,
      ),
      itemBuilder: (context, index) {
        final city = _results[index];
        final query = _searchCtrl.text.toLowerCase();

        return _CityTile(
          city: city,
          query: query,
          onTap: () => _selectCity(city),
        );
      },
    );
  }
}

// ─── Individual city tile (RedBus-style) ─────────────────────────────────

class _CityTile extends StatelessWidget {
  final City city;
  final String query;
  final VoidCallback onTap;

  const _CityTile({required this.city, required this.query, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        child: Row(
          children: [
            // City icon
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(LucideIcons.building2, size: 20, color: Colors.grey.shade600),
            ),
            const SizedBox(width: 14),

            // City name + state
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildHighlightedName(city.name, query),
                  const SizedBox(height: 2),
                  Text(
                    city.subtitle,
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                  ),
                ],
              ),
            ),

            // Arrow icon
            Icon(LucideIcons.arrowUpRight, size: 16, color: Colors.grey.shade400),
          ],
        ),
      ),
    );
  }

  /// Highlights the matching portion of the city name in bold
  Widget _buildHighlightedName(String name, String query) {
    if (query.isEmpty) {
      return Text(name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600));
    }

    final lowerName = name.toLowerCase();
    final matchIndex = lowerName.indexOf(query);

    if (matchIndex == -1) {
      return Text(name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600));
    }

    final before = name.substring(0, matchIndex);
    final match = name.substring(matchIndex, matchIndex + query.length);
    final after = name.substring(matchIndex + query.length);

    return RichText(
      text: TextSpan(
        style: const TextStyle(fontSize: 15, color: Colors.black87),
        children: [
          if (before.isNotEmpty) TextSpan(text: before, style: const TextStyle(fontWeight: FontWeight.w400)),
          TextSpan(text: match, style: const TextStyle(fontWeight: FontWeight.w800)),
          if (after.isNotEmpty) TextSpan(text: after, style: const TextStyle(fontWeight: FontWeight.w400)),
        ],
      ),
    );
  }
}
