import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:fl_chart/fl_chart.dart';
import '../models/engine.dart';
import '../core/theme.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  String _dateRange = 'Last 30 Days';

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 5,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(),
            const SizedBox(height: 16),
            _buildKpis(),
            const SizedBox(height: 16),
            _buildTabBar(),
            const SizedBox(height: 16),
            SizedBox(
              height: 600, // Fixed height for TabBarView
              child: _buildTabBarView(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Wrap(
      alignment: WrapAlignment.spaceBetween,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: 16,
      runSpacing: 16,
      children: [
        const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text('Fleet Analytics', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            Text('Performance insights, cost analysis, and trends', style: TextStyle(color: AppTheme.textSecondary, fontSize: 13)),
          ],
        ),
        Wrap(
          spacing: 8,
          children: [
            OutlinedButton.icon(
              onPressed: () {
                setState(() => _dateRange = 'Custom Range');
              },
              icon: const Icon(LucideIcons.calendar, size: 14),
              label: Text(_dateRange),
            ),
            OutlinedButton.icon(
              onPressed: () {},
              icon: const Icon(LucideIcons.download, size: 14),
              label: const Text('Export PDF'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildKpis() {
    return Wrap(
      spacing: 12,
      runSpacing: 12,
      children: [
        _kpiCard('Total Fleet km', '1,24,500', 'kms driven', AppTheme.primaryBlue),
        _kpiCard('Fleet Avg km/L', '4.2', 'km per liter', AppTheme.success),
        _kpiCard('Fleet Idle %', '12.4%', 'avg idling', AppTheme.warning),
        _kpiCard('Total Fuel Cost', '₹11.5L', 'monthly spend', AppTheme.danger),
      ],
    );
  }

  Widget _kpiCard(String title, String value, String subtitle, Color color) {
    return Container(
      width: 160,
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

  Widget _buildTabBar() {
    return const TabBar(
      isScrollable: true,
      tabs: [
        Tab(text: 'Fuel'),
        Tab(text: 'Mileage'),
        Tab(text: 'Idle'),
        Tab(text: 'Driver'),
        Tab(text: 'Compliance'),
      ],
    );
  }

  Widget _buildTabBarView() {
    return TabBarView(
      children: [
        _buildFuelTab(),
        _buildMileageTab(),
        _buildIdleTab(),
        _buildDriverTab(),
        _buildComplianceTab(),
      ],
    );
  }

  Widget _buildFuelTab() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Fuel Cost Trend (Monthly)', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            SizedBox(
              height: 200,
              child: LineChart(
                LineChartData(
                  lineBarsData: [
                    LineChartBarData(
                      spots: const [FlSpot(0, 10), FlSpot(1, 15), FlSpot(2, 12), FlSpot(3, 18), FlSpot(4, 14)],
                      isCurved: true,
                      color: AppTheme.primaryBlue,
                    ),
                  ],
                  titlesData: FlTitlesData(
                    show: true,
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        getTitlesWidget: (value, meta) {
                          const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May'];
                          if (value.toInt() < labels.length) {
                            return Text(labels[value.toInt()], style: const TextStyle(fontSize: 10));
                          }
                          return const Text('');
                        },
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            const Text('Top Station Spend', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            _buildDummyTable(['Station', 'Spend'], [['HPCL Mumbai', '₹45,000'], ['IOCL Delhi', '₹32,000'], ['BPCL Bangalore', '₹28,000']]),
          ],
        ),
      ),
    );
  }

  Widget _buildMileageTab() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Fleet Mileage Trend (km/L)', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            SizedBox(
              height: 200,
              child: LineChart(
                LineChartData(
                  lineBarsData: [
                    LineChartBarData(
                      spots: const [FlSpot(0, 4.0), FlSpot(1, 4.2), FlSpot(2, 4.1), FlSpot(3, 4.5), FlSpot(4, 4.2)],
                      isCurved: true,
                      color: AppTheme.success,
                    ),
                  ],
                  titlesData: FlTitlesData(
                    show: true,
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        getTitlesWidget: (value, meta) {
                          const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May'];
                          if (value.toInt() < labels.length) {
                            return Text(labels[value.toInt()], style: const TextStyle(fontSize: 10));
                          }
                          return const Text('');
                        },
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            const Text('Top Performing Trucks', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            _buildDummyTable(['Vehicle', 'Mileage'], [['MH 43 BP 2114', '4.5 km/L'], ['MH 01 AB 1234', '4.2 km/L']]),
          ],
        ),
      ),
    );
  }

  Widget _buildIdleTab() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Idle Hours Trend', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            SizedBox(
              height: 200,
              child: LineChart(
                LineChartData(
                  lineBarsData: [
                    LineChartBarData(
                      spots: const [FlSpot(0, 20), FlSpot(1, 15), FlSpot(2, 25), FlSpot(3, 10), FlSpot(4, 12)],
                      isCurved: true,
                      color: AppTheme.warning,
                    ),
                  ],
                  titlesData: FlTitlesData(
                    show: true,
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        getTitlesWidget: (value, meta) {
                          const labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May'];
                          if (value.toInt() < labels.length) {
                            return Text(labels[value.toInt()], style: const TextStyle(fontSize: 10));
                          }
                          return const Text('');
                        },
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            const Text('Highest Idling Trucks', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            _buildDummyTable(['Vehicle', 'Idle Hours'], [['MH 43 BP 2114', '25 hrs'], ['MH 01 AB 1234', '15 hrs']]),
          ],
        ),
      ),
    );
  }

  Widget _buildDriverTab() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Driver Score vs Mileage', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            const Center(
              child: Text('Scatter plot or detailed comparison will be rendered here.', style: TextStyle(color: AppTheme.textSecondary)),
            ),
            const SizedBox(height: 24),
            const Text('Top Drivers', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            _buildDummyTable(['Driver', 'Score'], [['Rajesh Kumar', '92'], ['Suresh Pal', '88']]),
          ],
        ),
      ),
    );
  }

  Widget _buildComplianceTab() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Expiring Documents', style: TextStyle(fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            _buildDummyTable(['Vehicle', 'Document', 'Expiry'], [['MH 43 BP 2114', 'Insurance', 'In 5 days'], ['MH 01 AB 1234', 'PUC', 'In 12 days']]),
          ],
        ),
      ),
    );
  }

  Widget _buildDummyTable(List<String> columns, List<List<String>> rows) {
    return DataTable(
      headingTextStyle: const TextStyle(fontWeight: FontWeight.bold, color: AppTheme.textSecondary),
      columns: columns.map((c) => DataColumn(label: Text(c))).toList(),
      rows: rows.map((r) => DataRow(cells: r.map((cell) => DataCell(Text(cell))).toList())).toList(),
    );
  }
}
