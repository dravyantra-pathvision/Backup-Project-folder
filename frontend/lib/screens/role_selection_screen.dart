import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import '../core/theme.dart';

class RoleSelectionScreen extends StatefulWidget {
  const RoleSelectionScreen({super.key});

  @override
  State<RoleSelectionScreen> createState() => _RoleSelectionScreenState();
}

class _RoleSelectionScreenState extends State<RoleSelectionScreen> {
  int? _hoveredIndex;

  final List<Map<String, dynamic>> _roles = [
    {
      'id': 'fleet_owner',
      'title': 'Fleet Owner',
      'description': 'Manage vehicles, assign drivers, and monitor trips in real-time.',
      'icon': LucideIcons.truck,
      'gradient': [Color(0xFF2563EB), Color(0xFF7C3AED)],
      'badge': 'Management',
    },
    {
      'id': 'driver',
      'title': 'Driver',
      'description': 'Access logs, update trip progress, and submit fuel records.',
      'icon': LucideIcons.user,
      'gradient': [Color(0xFF0D9488), Color(0xFF059669)],
      'badge': 'Operations',
    },
    {
      'id': 'admin',
      'title': 'Admin Dashboard',
      'description': 'Configure system-wide settings, overrides, and user access.',
      'icon': LucideIcons.shield,
      'gradient': [Color(0xFFEA580C), Color(0xFFDC2626)],
      'badge': 'System Controls',
    },
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 48),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 1100),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Header Logo
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppTheme.primaryBlue.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const Icon(
                        LucideIcons.truck,
                        size: 40,
                        color: AppTheme.primaryBlue,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'DravYantra',
                          style: TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.primaryBlue,
                            letterSpacing: -0.5,
                          ),
                        ),
                        Text(
                          'Fleet Intelligence Platform',
                          style: TextStyle(
                            fontSize: 14,
                            color: AppTheme.textSecondary.withOpacity(0.8),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 48),
                
                // Welcome message
                const Text(
                  'Select Your Portal',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Choose the appropriate role to proceed to your specialized dashboard.',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 16,
                    color: AppTheme.textSecondary,
                  ),
                ),
                const SizedBox(height: 48),

                // Responsive Layout Builder
                LayoutBuilder(
                  builder: (context, constraints) {
                    final bool isDesktop = constraints.maxWidth > 800;
                    return isDesktop
                        ? Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: List.generate(
                              _roles.length,
                              (index) => Expanded(
                                child: Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 12),
                                  child: _buildRoleCard(index, true),
                                ),
                              ),
                            ),
                          )
                        : Column(
                            children: List.generate(
                              _roles.length,
                              (index) => Padding(
                                padding: const EdgeInsets.only(bottom: 20),
                                child: _buildRoleCard(index, false),
                              ),
                            ),
                          );
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRoleCard(int index, bool isDesktop) {
    final role = _roles[index];
    final bool isHovered = _hoveredIndex == index;
    final gradient = role['gradient'] as List<Color>;

    return MouseRegion(
      onEnter: (_) => setState(() => _hoveredIndex = index),
      onExit: (_) => setState(() => _hoveredIndex = null),
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: () {
          // Navigate to login with query param role
          context.go('/login?role=${role['id']}');
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOutCubic,
          padding: EdgeInsets.all(isDesktop ? 32 : 16),
          height: isDesktop ? 320 : 160,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(isDesktop ? 24 : 16),
            border: Border.all(
              color: isHovered ? gradient[0].withOpacity(0.5) : const Color(0xFFE2E8F0),
              width: isHovered ? 2 : 1,
            ),
            boxShadow: [
              if (isHovered)
                BoxShadow(
                  color: gradient[0].withOpacity(0.12),
                  blurRadius: 24,
                  offset: const Offset(0, 12),
                )
              else
                const BoxShadow(
                  color: Colors.black12,
                  blurRadius: 10,
                  offset: Offset(0, 4),
                ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Icon Circle with Gradient
                  Container(
                    width: isDesktop ? 64 : 44,
                    height: isDesktop ? 64 : 44,
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: gradient,
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(isDesktop ? 20 : 12),
                      boxShadow: [
                        if (isDesktop)
                          BoxShadow(
                            color: gradient[0].withOpacity(0.3),
                            blurRadius: 12,
                            offset: const Offset(0, 6),
                          ),
                      ],
                    ),
                    child: Icon(
                      role['icon'] as IconData,
                      color: Colors.white,
                      size: isDesktop ? 32 : 22,
                    ),
                  ),
                  // Badge
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: isDesktop ? 12 : 8,
                      vertical: isDesktop ? 6 : 4,
                    ),
                    decoration: BoxDecoration(
                      color: gradient[0].withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      role['badge'] as String,
                      style: TextStyle(
                        fontSize: isDesktop ? 12 : 10,
                        fontWeight: FontWeight.bold,
                        color: gradient[0],
                      ),
                    ),
                  ),
                ],
              ),
              if (isDesktop) const Spacer() else const SizedBox(height: 12),
              
              // Role Title
              Text(
                role['title'] as String,
                style: TextStyle(
                  fontSize: isDesktop ? 22 : 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              
              // Role Description
              Text(
                role['description'] as String,
                style: TextStyle(
                  fontSize: isDesktop ? 14 : 12,
                  color: AppTheme.textSecondary,
                  height: 1.3,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
