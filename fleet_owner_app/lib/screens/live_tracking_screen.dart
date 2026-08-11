import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../models/engine.dart';
import '../core/theme.dart';

class LiveTrackingScreen extends StatefulWidget {
  const LiveTrackingScreen({super.key});

  @override
  State<LiveTrackingScreen> createState() => _LiveTrackingScreenState();
}

class _LiveTrackingScreenState extends State<LiveTrackingScreen> {
  String _selectedFilter = 'all';
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final engine = context.watch<DataEngine>();
    final vehicles = engine.vehicles.where((v) {
      bool matchesFilter = _selectedFilter == 'all';
      final statusLower = v.status.toLowerCase();
      if (_selectedFilter == 'running') {
        matchesFilter = statusLower == 'running';
      } else if (_selectedFilter == 'idle') {
        matchesFilter = statusLower == 'idle';
      } else if (_selectedFilter == 'offline') {
        matchesFilter = statusLower == 'offline' || statusLower == 'stopped';
      }
      bool matchesSearch = _searchQuery.isEmpty || 
          v.plate.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          v.driver.toLowerCase().contains(_searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    }).toList();
    
    final selectedVehicle = engine.selectedVehicle;

    return Stack(
      children: [
        FlutterMap(
          options: const MapOptions(
            initialCenter: LatLng(20.5937, 78.9629),
            initialZoom: 5.0,
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
              subdomains: const ['a', 'b', 'c', 'd'],
              retinaMode: RetinaMode.isHighDensity(context),
            ),
            if (selectedVehicle != null && selectedVehicle.route.isNotEmpty)
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: selectedVehicle.route.map((p) => LatLng(p[0], p[1])).toList(),
                    color: AppTheme.primaryBlue,
                    strokeWidth: 4,
                  ),
                ],
              ),
            MarkerLayer(
              markers: vehicles.map((v) {
                final isSelected = selectedVehicle?.plate == v.plate;
                return Marker(
                  point: LatLng(v.lat, v.lng),
                  width: 100,
                  height: 100,
                  child: GestureDetector(
                    onTap: () => engine.selectVehicle(v),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 300),
                          padding: EdgeInsets.all(isSelected ? 6 : 4),
                          decoration: BoxDecoration(
                            color: v.status == 'running' ? AppTheme.success : AppTheme.warning,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 2),
                            boxShadow: isSelected ? [BoxShadow(color: Colors.black26, blurRadius: 10, spreadRadius: 2)] : [],
                          ),
                          child: Icon(
                            v.type == 'HCV' ? Icons.local_shipping : Icons.directions_car,
                            color: Colors.white,
                            size: isSelected ? 24 : 16,
                          ),
                        ),
                        Container(
                          margin: const EdgeInsets.only(top: 4),
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(4),
                            boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 2)],
                          ),
                          child: Text(
                            v.plate,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                              color: isSelected ? AppTheme.primaryBlue : AppTheme.textPrimary,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
        // Filter Chips
        Positioned(
          top: 16,
          left: 16,
          right: 16,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Card(
                elevation: 8,
                shadowColor: Colors.black26,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _searchController.text.isNotEmpty ? _searchController.text : null,
                      isExpanded: true,
                      icon: const Icon(Icons.arrow_drop_down, color: AppTheme.textSecondary),
                      hint: Row(
                        children: [
                          const Icon(Icons.search, color: AppTheme.textSecondary),
                          const SizedBox(width: 12),
                          const Text('Select vehicle...', style: TextStyle(color: AppTheme.textSecondary, fontSize: 14)),
                          const Spacer(),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(color: AppTheme.primaryBlue.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                            child: Row(
                              children: [
                                const Icon(Icons.wifi, size: 14, color: AppTheme.primaryBlue),
                                const SizedBox(width: 6),
                                Text('${engine.vehicles.length} Active', style: const TextStyle(color: AppTheme.primaryBlue, fontWeight: FontWeight.bold, fontSize: 12)),
                              ],
                            ),
                          ),
                        ],
                      ),
                      selectedItemBuilder: (BuildContext context) {
                        return engine.vehicles.map((Vehicle v) {
                          return Row(
                            children: [
                              const Icon(Icons.search, color: AppTheme.textSecondary),
                              const SizedBox(width: 12),
                              Text(v.plate, style: const TextStyle(fontSize: 14, color: AppTheme.textPrimary)),
                              const Spacer(),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(color: AppTheme.primaryBlue.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                                child: Row(
                                  children: [
                                    const Icon(Icons.wifi, size: 14, color: AppTheme.primaryBlue),
                                    const SizedBox(width: 6),
                                    Text('${engine.vehicles.length} Active', style: const TextStyle(color: AppTheme.primaryBlue, fontWeight: FontWeight.bold, fontSize: 12)),
                                  ],
                                ),
                              ),
                            ],
                          );
                        }).toList();
                      },
                      items: engine.vehicles.map((Vehicle v) {
                        return DropdownMenuItem<String>(
                          value: v.plate,
                          child: Text(v.plate),
                        );
                      }).toList(),
                      onChanged: (String? plate) {
                        if (plate != null) {
                          _searchController.text = plate;
                          setState(() => _searchQuery = plate);
                          final v = engine.vehicles.firstWhere((e) => e.plate == plate);
                          engine.selectVehicle(v);
                        }
                      },
                    ),
                  ),
                ),
              ),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Row(
                  children: [
                    _FilterChip(
                      label: 'All',
                      count: engine.vehicles.length,
                      isSelected: _selectedFilter == 'all',
                      onTap: () => setState(() => _selectedFilter = 'all'),
                    ),
                    _FilterChip(
                      label: 'Running',
                      count: engine.vehicles.where((v) => v.status.toLowerCase() == 'running').length,
                      isSelected: _selectedFilter == 'running',
                      color: AppTheme.success,
                      onTap: () => setState(() => _selectedFilter = 'running'),
                    ),
                    _FilterChip(
                      label: 'Idle',
                      count: engine.vehicles.where((v) => v.status.toLowerCase() == 'idle').length,
                      isSelected: _selectedFilter == 'idle',
                      color: AppTheme.warning,
                      onTap: () => setState(() => _selectedFilter = 'idle'),
                    ),
                    _FilterChip(
                      label: 'Offline',
                      count: engine.vehicles.where((v) => v.status.toLowerCase() == 'offline' || v.status.toLowerCase() == 'stopped').length,
                      isSelected: _selectedFilter == 'offline',
                      color: AppTheme.textSecondary,
                      onTap: () => setState(() => _selectedFilter = 'offline'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        // Selected Vehicle Panel
        if (selectedVehicle != null)
          Positioned(
            bottom: 24,
            left: 16,
            right: 16,
            child: _VehicleDetailPanel(
              vehicle: selectedVehicle,
              onClose: () => engine.selectVehicle(null),
            ),
          ),
      ],
    );
  }
}

class _FilterChip extends StatelessWidget {
  final String label;
  final int count;
  final bool isSelected;
  final Color? color;
  final VoidCallback onTap;

  const _FilterChip({
    required this.label,
    required this.count,
    required this.isSelected,
    this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(right: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? (color ?? AppTheme.primaryBlue) : Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [BoxShadow(color: Colors.black12, blurRadius: 4)],
          border: isSelected ? null : Border.all(color: Colors.black12),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : AppTheme.textPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: isSelected ? Colors.white24 : (color?.withOpacity(0.1) ?? Colors.black12),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                count.toString(),
                style: TextStyle(
                  fontSize: 10,
                  color: isSelected ? Colors.white : (color ?? AppTheme.textPrimary),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _VehicleDetailPanel extends StatelessWidget {
  final Vehicle vehicle;
  final VoidCallback onClose;

  const _VehicleDetailPanel({required this.vehicle, required this.onClose});

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 12,
      shadowColor: Colors.black38,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(vehicle.plate, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                      Text(vehicle.type, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
                    ],
                  ),
                ),
                IconButton(onPressed: onClose, icon: const Icon(Icons.close)),
              ],
            ),
            const Divider(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _InfoItem(label: 'Speed', value: '${vehicle.speed} km/h', icon: Icons.speed, color: AppTheme.primaryBlue),
                _InfoItem(label: 'Fuel', value: '${vehicle.fuel}%', icon: Icons.local_gas_station, color: AppTheme.danger),
                _InfoItem(label: 'Driver', value: vehicle.driver, icon: Icons.person, color: AppTheme.success),
              ],
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: AppTheme.background, borderRadius: BorderRadius.circular(12)),
              child: Row(
                children: [
                  const Icon(Icons.location_on, size: 18, color: AppTheme.danger),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('CURRENT LOCATION', style: TextStyle(fontSize: 10, color: AppTheme.textSecondary, fontWeight: FontWeight.bold)),
                        Text(vehicle.loc, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)),
                      ],
                    ),
                  ),
                  TextButton(
                    onPressed: () {
                      final engine = Provider.of<DataEngine>(context, listen: false);
                      engine.highlightVehicle(vehicle.plate);
                      context.go('/vehicles');
                    },
                    child: const Text('HISTORY'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _InfoItem extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _InfoItem({required this.label, required this.value, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, color: color, size: 20),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
        Text(label, style: const TextStyle(color: AppTheme.textSecondary, fontSize: 10)),
      ],
    );
  }
}
