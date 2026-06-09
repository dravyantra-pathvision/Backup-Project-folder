import 'dart:async';
import 'dart:math';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:csv/csv.dart';
import 'package:path_provider/path_provider.dart';
import 'package:http/http.dart' as http;
import 'package:csv/csv.dart';
import 'package:firebase_auth/firebase_auth.dart';

class Organization {
  final String name;
  final String gstin;
  final String pan;
  final String city;
  final String state;
  final String contact;

  Organization({required this.name, required this.gstin, required this.pan, required this.city, required this.state, required this.contact});
}

class UserAccount {
  final String name;
  final String email;
  final String phone;
  final String role;
  final String timezone;
  final int? speedLimitOverride;
  final double? fuelTheftLimitOverride;

  UserAccount({
    required this.name,
    required this.email,
    required this.phone,
    required this.role,
    required this.timezone,
    this.speedLimitOverride,
    this.fuelTheftLimitOverride,
  });

  UserAccount copyWith({
    String? name,
    String? email,
    String? phone,
    String? role,
    String? timezone,
    int? speedLimitOverride,
    double? fuelTheftLimitOverride,
  }) {
    return UserAccount(
      name: name ?? this.name,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      role: role ?? this.role,
      timezone: timezone ?? this.timezone,
      speedLimitOverride: speedLimitOverride ?? this.speedLimitOverride,
      fuelTheftLimitOverride: fuelTheftLimitOverride ?? this.fuelTheftLimitOverride,
    );
  }
}

class AlertSettings {
  final int speedThreshold;
  final int idleLimit;
  final double fuelDropThreshold;
  final int fastagThreshold;
  final bool whatsappEnabled;
  final bool smsEnabled;
  final bool pushEnabled;
  final bool emailEnabled;
  final double mileageThreshold;
  final Map<String, bool> perTypeToggles;

  AlertSettings({
    required this.speedThreshold, required this.idleLimit, required this.fuelDropThreshold, 
    required this.fastagThreshold, required this.whatsappEnabled, required this.smsEnabled, required this.pushEnabled,
    this.emailEnabled = true,
    this.mileageThreshold = 4.0,
    this.perTypeToggles = const {'overSpeed': true, 'excessIdle': true, 'fuelDrop': true, 'geoFence': true, 'harshBraking': true, 'eWayBill': true, 'fastag': true, 'gpsLost': true},
  });

  AlertSettings copyWith({
    int? speedThreshold, int? idleLimit, double? fuelDropThreshold, int? fastagThreshold,
    bool? whatsappEnabled, bool? smsEnabled, bool? pushEnabled, bool? emailEnabled,
    double? mileageThreshold, Map<String, bool>? perTypeToggles
  }) {
    return AlertSettings(
      speedThreshold: speedThreshold ?? this.speedThreshold,
      idleLimit: idleLimit ?? this.idleLimit,
      fuelDropThreshold: fuelDropThreshold ?? this.fuelDropThreshold,
      fastagThreshold: fastagThreshold ?? this.fastagThreshold,
      whatsappEnabled: whatsappEnabled ?? this.whatsappEnabled,
      smsEnabled: smsEnabled ?? this.smsEnabled,
      pushEnabled: pushEnabled ?? this.pushEnabled,
      emailEnabled: emailEnabled ?? this.emailEnabled,
      mileageThreshold: mileageThreshold ?? this.mileageThreshold,
      perTypeToggles: perTypeToggles ?? this.perTypeToggles,
    );
  }
}

class FuelLog {
  final String id;
  final String vehicle;
  final String driver;
  final String station;
  final double liters;
  final double rate;
  final double cost;
  final int odometer;
  final String date;
  final bool isSuspect;
  final String? suspectReason;

  FuelLog({
    required this.id, required this.vehicle, required this.driver, required this.station, 
    required this.liters, required this.rate, required this.cost, required this.odometer, 
    required this.date, this.isSuspect = false, this.suspectReason
  });

  factory FuelLog.fromMap(Map<String, dynamic> map) => FuelLog(
    id: map['id'] ?? '',
    vehicle: map['vehicle'] ?? '',
    driver: map['driver'] ?? '',
    station: map['station'] ?? '',
    liters: map['liters']?.toDouble() ?? 0.0,
    rate: map['rate']?.toDouble() ?? 0.0,
    cost: map['cost']?.toDouble() ?? 0.0,
    odometer: map['odometer'] ?? 0,
    date: map['date'] ?? '',
    isSuspect: map['isSuspect'] ?? map['is_suspect'] ?? false,
    suspectReason: map['suspectReason'] ?? map['suspect_reason'],
  );
}

// Trip model is defined below with more comprehensive fields.

class ServiceRecord {
  final String date;
  final String type;
  final String notes;
  ServiceRecord({required this.date, required this.type, required this.notes});

  Map<String, dynamic> toMap() => {
    'date': date,
    'type': type,
    'notes': notes,
  };

  factory ServiceRecord.fromMap(Map<String, dynamic> map) => ServiceRecord(
    date: map['date'] ?? '',
    type: map['type'] ?? '',
    notes: map['notes'] ?? '',
  );
}

enum AlertStatus { pending, acknowledged, dismissed }
enum AlertCategory { safety, fuel, compliance, connectivity }

class Trip {
  final String id;
  final String vehicle;
  final String driver;
  final String from;
  final String to;
  final String load;
  final String client;
  final String status; // pending, running, completed, cancelled, not started
  final String ewayBill;
  final String date;
  final double progress; // 0.0 to 1.0
  final double distance;
  final double fuelUsed;
  final double score;
  final int delayMinutes;
  final List<String> waypoints;
  final int tollCount;
  final double liveSpeed;
  final bool power;
  final double? liveIdleSpeed;
  final String liveIdleTime;
  final int liveFuelCount;
  final int idleDuration;
  final bool? tripCompleted;
  final double defaultMileage;
  final double currentMileage;
  final double fuelSaved;
  final double fuelWasted;
  final double moneySaved;
  final double moneyWasted;
  final double idleMoneyWasted;
  // Idle fuel wasted (liters) derived only from the trip's own `idleMoneyWasted` column.
  double get idleFuelWasted => idleMoneyWasted / 100.0;
  final double fuelPrice;
  final double speedingFuelLoss;
  final double speedingMoneyLoss;
  final double theftFuelLoss;
  final double theftMoneyLoss;
  final String? updatedAt;

  Trip({
    required this.id, 
    required this.vehicle, 
    required this.driver, 
    required this.from, 
    required this.to, 
    required this.load, 
    required this.client, 
    required this.status, 
    required this.ewayBill, 
    required this.date, 
    required this.progress,
    this.distance = 0.0,
    this.fuelUsed = 0.0,
    this.score = 0.0,
    this.delayMinutes = 0,
    this.waypoints = const [],
    this.tollCount = 0,
    this.liveSpeed = 0.0,
    this.power = false,
    this.liveIdleSpeed,
    this.liveIdleTime = '00:00:00',
    this.liveFuelCount = 0,
    this.idleDuration = 0,
    this.tripCompleted,
    this.defaultMileage = 4.0,
    this.currentMileage = 0.0,
    this.fuelSaved = 0.0,
    this.fuelWasted = 0.0,
    this.moneySaved = 0.0,
    this.moneyWasted = 0.0,
    this.idleMoneyWasted = 0.0,
    this.fuelPrice = 0.0,
    this.speedingFuelLoss = 0.0,
    this.speedingMoneyLoss = 0.0,
    this.theftFuelLoss = 0.0,
    this.theftMoneyLoss = 0.0,
    this.updatedAt,
  });

  Trip copyWith({
    String? vehicle,
    String? driver,
    String? status, 
    double? progress, 
    double? distance, 
    double? fuelUsed, 
    double? score, 
    int? delayMinutes, 
    List<String>? waypoints, 
    int? tollCount,
    double? liveSpeed,
    bool? power,
    double? liveIdleSpeed,
    String? liveIdleTime,
    int? liveFuelCount,
    int? idleDuration,
    bool? tripCompleted,
    double? defaultMileage,
    double? currentMileage,
    double? fuelSaved,
    double? fuelWasted,
    double? moneySaved,
    double? moneyWasted,
    double? idleMoneyWasted,
    double? fuelPrice,
    double? speedingFuelLoss,
    double? speedingMoneyLoss,
    double? theftFuelLoss,
    double? theftMoneyLoss,
  }) {
    return Trip(
      id: id,
      vehicle: vehicle ?? this.vehicle,
      driver: driver ?? this.driver,
      from: from,
      to: to,
      load: load,
      client: client,
      status: status ?? this.status,
      ewayBill: ewayBill,
      date: date,
      progress: progress ?? this.progress,
      distance: distance ?? this.distance,
      fuelUsed: fuelUsed ?? this.fuelUsed,
      score: score ?? this.score,
      delayMinutes: delayMinutes ?? this.delayMinutes,
      waypoints: waypoints ?? this.waypoints,
      tollCount: tollCount ?? this.tollCount,
      liveSpeed: liveSpeed ?? this.liveSpeed,
      power: power ?? this.power,
      liveIdleSpeed: liveIdleSpeed ?? this.liveIdleSpeed,
      liveIdleTime: liveIdleTime ?? this.liveIdleTime,
      liveFuelCount: liveFuelCount ?? this.liveFuelCount,
      idleDuration: idleDuration ?? this.idleDuration,
      tripCompleted: tripCompleted ?? this.tripCompleted,
      defaultMileage: defaultMileage ?? this.defaultMileage,
      currentMileage: currentMileage ?? this.currentMileage,
      fuelSaved: fuelSaved ?? this.fuelSaved,
      fuelWasted: fuelWasted ?? this.fuelWasted,
      moneySaved: moneySaved ?? this.moneySaved,
      moneyWasted: moneyWasted ?? this.moneyWasted,
      idleMoneyWasted: idleMoneyWasted ?? this.idleMoneyWasted,
      fuelPrice: fuelPrice ?? this.fuelPrice,
      speedingFuelLoss: speedingFuelLoss ?? this.speedingFuelLoss,
      speedingMoneyLoss: speedingMoneyLoss ?? this.speedingMoneyLoss,
      theftFuelLoss: theftFuelLoss ?? this.theftFuelLoss,
      theftMoneyLoss: theftMoneyLoss ?? this.theftMoneyLoss,
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id,
    'vehicle': vehicle,
    'driver': driver,
    'from': from,
    'to': to,
    'load': load,
    'client': client,
    'status': status,
    'ewayBill': ewayBill,
    'date': date,
    'progress': progress,
    'distance': distance,
    'fuelUsed': fuelUsed,
    'score': score,
    'delayMinutes': delayMinutes,
    'waypoints': waypoints,
    'tollCount': tollCount,
    'liveSpeed': liveSpeed,
    'power': power,
    'idleDuration': idleDuration,
    'liveIdleTime': liveIdleTime.isNotEmpty ? liveIdleTime : (() {
      final int hours = idleDuration ~/ 3600;
      final int minutes = (idleDuration % 3600) ~/ 60;
      final int seconds = idleDuration % 60;
      return '${hours.toString().padLeft(2, '0')}:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
    })(),
    'liveIdleSpeed': liveIdleSpeed,
    'liveFuelCount': liveFuelCount,
    'tripCompleted': tripCompleted ?? false,
    'defaultMileage': defaultMileage,
    'currentMileage': currentMileage,
    'fuelSaved': fuelSaved,
    'fuelWasted': fuelWasted,
    'moneySaved': moneySaved,
    'moneyWasted': moneyWasted,
    'idle_money_wasted': idleMoneyWasted,
    'fuelPrice': fuelPrice,
    '_updatedAt': updatedAt,
  };

  factory Trip.fromMap(Map<String, dynamic> map) => Trip(
    id: map['id'] ?? '',
    vehicle: map['vehicle'] ?? '',
    driver: map['driver'] ?? '',
    from: map['from'] ?? '',
    to: map['to'] ?? '',
    load: map['load'] ?? '',
    client: map['client'] ?? '',
    status: map['status'] ?? '',
    ewayBill: map['ewayBill'] ?? map['eway_bill'] ?? '',
    date: map['date'] ?? '',
    progress: map['progress']?.toDouble() ?? 0.0,
    distance: map['distance']?.toDouble() ?? 0.0,
    fuelUsed: map['fuelUsed']?.toDouble() ?? map['fuel_used']?.toDouble() ?? 0.0,
    score: map['score']?.toDouble() ?? 0.0,
    delayMinutes: map['delayMinutes'] ?? map['delay_minutes'] ?? 0,
    waypoints: List<String>.from(map['waypoints'] ?? []),
    tollCount: map['tollCount'] ?? map['toll_count'] ?? 0,
    liveSpeed: map['liveSpeed']?.toDouble() ?? map['live_speed']?.toDouble() ?? 0.0,
    power: map['power'] ?? false,
    liveIdleTime: map['liveIdleTime'] ?? map['live_idle_time'] ?? '',
    liveFuelCount: map['liveFuelCount'] ?? map['live_fuel_count'] ?? 0,
    idleDuration: map['idleDuration'] ?? map['idle_duration'] ?? 0,
    liveIdleSpeed: (map['liveIdleSpeed']?.toDouble() ?? map['live_idle_speed']?.toDouble() ?? 0.0),
    tripCompleted: map['tripCompleted'] ?? map['trip_completed'] ?? false,
    defaultMileage: map['defaultMileage']?.toDouble() ?? map['default_mileage']?.toDouble() ?? 4.0,
    currentMileage: map['currentMileage']?.toDouble() ?? map['current_mileage']?.toDouble() ?? 0.0,
    fuelSaved: map['fuelSaved']?.toDouble() ?? map['fuel_saved']?.toDouble() ?? 0.0,
    fuelWasted: map['fuelWasted']?.toDouble() ?? map['fuel_wasted']?.toDouble() ?? 0.0,
    moneySaved: map['moneySaved']?.toDouble() ?? map['money_saved']?.toDouble() ?? 0.0,
    moneyWasted: map['moneyWasted']?.toDouble() ?? map['money_wasted']?.toDouble() ?? 0.0,
    idleMoneyWasted: map['idleMoneyWasted']?.toDouble() ?? map['idle_money_wasted']?.toDouble() ?? 0.0,
    fuelPrice: map['fuelPrice']?.toDouble() ?? map['fuel_price']?.toDouble() ?? 0.0,
    speedingFuelLoss: map['speedingFuelLoss']?.toDouble() ??
      map['speedingFuelWasted']?.toDouble() ??
      map['speeding_fuel_wasted']?.toDouble() ??
      0.0,
    speedingMoneyLoss: (() {
      final double speedingFuel = map['speedingFuelLoss']?.toDouble() ??
        map['speedingFuelWasted']?.toDouble() ??
        map['speeding_fuel_wasted']?.toDouble() ??
        0.0;
      return speedingFuel * 100.0;
    })(),
    theftFuelLoss: map['theftFuelLoss']?.toDouble() ?? map['theft_fuel_loss']?.toDouble() ?? 0.0,
    // Ensure theft money loss is derived from the trip's own theft fuel loss value.
    theftMoneyLoss: (() {
      final double tFuel = map['theftFuelLoss']?.toDouble() ?? map['theft_fuel_loss']?.toDouble() ?? 0.0;
      return tFuel * 100.0;
    })(),
    updatedAt: map['updatedAt'] ?? map['updated_at'] ?? map['_updatedAt'],
  );
}

class Alert {
  final String id;
  final String truck;
  final String msg;
  final String time;
  final String sev;
  final AlertCategory category;
  final AlertStatus status;
  final String driver;

  Alert({
    required this.id, required this.truck, required this.msg, required this.time, 
    required this.sev, required this.category, this.status = AlertStatus.pending,
    this.driver = '',
  });

  Alert copyWith({AlertStatus? status, String? driver}) {
    return Alert(
      id: id, truck: truck, msg: msg, time: time, sev: sev, 
      category: category, status: status ?? this.status,
      driver: driver ?? this.driver,
    );
  }
}

class Vehicle {
  final String plate;
  final String model;
  final int year;
  final String type;
  final String status;
  final String driver;
  final String loc;
  final int speed;
  final double fuel;
  final double mil;
  final double idle;
  final int fastag;
  final int health;
  final int odo;
  final String nextService;
  final String insurance;
  final String permit;
  final String puc;
  final String lastFill;
  final List<String> alerts;
  final double lat;
  final double lng;
  final List<List<double>> route; // List of [lat, lng] pairs
  final bool isActive;
  final List<ServiceRecord> serviceHistory;
  final bool isBlacklisted;
  final String? imageUrl;

  Vehicle({
    required this.plate, required this.model, required this.year, required this.type, required this.status, required this.driver,
    required this.loc, required this.speed, required this.fuel, required this.mil, required this.idle, required this.fastag,
    int? health, 
    required this.odo, required this.nextService, required this.insurance, required this.permit,
    required this.puc, required this.lastFill, required this.alerts,
    required this.lat, required this.lng, this.route = const [],
    this.isActive = true,
    this.serviceHistory = const [],
    this.isBlacklisted = false,
    this.imageUrl,
  }) : this.health = health ?? _calculateHealth(year);

  static int _calculateHealth(int year) {
    final currentYear = DateTime.now().year;
    final age = currentYear - year;
    return (105 - 5 * age).clamp(0, 100);
  }

  Vehicle copyWith({String? driver, String? status, int? speed, double? fuel, double? idle, int? fastag, double? lat, double? lng, List<List<double>>? route, bool? isActive, List<ServiceRecord>? serviceHistory, bool? isBlacklisted, String? imageUrl}) {
    return Vehicle(
      plate: plate, model: model, year: year, type: type, status: status ?? this.status, driver: driver ?? this.driver,
      loc: loc, speed: speed ?? this.speed, fuel: fuel ?? this.fuel, mil: mil,
      idle: idle ?? this.idle, fastag: fastag ?? this.fastag, health: health, odo: odo,
      nextService: nextService, insurance: insurance, permit: permit, puc: puc, lastFill: lastFill, alerts: alerts,
      lat: lat ?? this.lat, lng: lng ?? this.lng, route: route ?? this.route,
      isActive: isActive ?? this.isActive,
      serviceHistory: serviceHistory ?? this.serviceHistory,
      isBlacklisted: isBlacklisted ?? this.isBlacklisted,
      imageUrl: imageUrl ?? this.imageUrl,
    );
  }

  Map<String, dynamic> toMap() => {
    'plate': plate,
    'model': model,
    'year': year,
    'type': type,
    'status': status,
    'driver': driver,
    'loc': loc,
    'speed': speed,
    'fuel': fuel,
    'mil': mil,
    'idle': idle,
    'fastag': fastag,
    'health': health,
    'odo': odo,
    'next_service': nextService,
    'insurance': insurance,
    'permit': permit,
    'puc': puc,
    'last_fill': lastFill,
    'alerts': alerts,
    'lat': lat,
    'lng': lng,
    'route': route,
    'is_active': isActive,
    'service_history': serviceHistory.map((x) => x.toMap()).toList(),
    'is_blacklisted': isBlacklisted,
    'image_url': imageUrl,
  };

  factory Vehicle.fromMap(Map<String, dynamic> map) => Vehicle(
    plate: map['plate'] ?? '',
    model: map['model'] ?? '',
    year: map['year'] ?? 2024,
    type: map['type'] ?? '',
    status: map['status'] ?? '',
    driver: map['driver'] ?? '',
    loc: map['loc'] ?? '',
    speed: map['speed'] ?? 0,
    fuel: map['fuel']?.toDouble() ?? 0.0,
    mil: map['mil']?.toDouble() ?? 0.0,
    idle: map['idle']?.toDouble() ?? 0.0,
    fastag: map['fastag'] ?? 0,
    health: map['health'] ?? 100,
    odo: map['odo'] ?? 0,
    nextService: map['nextService'] ?? map['next_service'] ?? '',
    insurance: map['insurance'] ?? '',
    permit: map['permit'] ?? '',
    puc: map['puc'] ?? '',
    lastFill: map['lastFill'] ?? map['last_fill'] ?? '',
    alerts: List<String>.from(map['alerts'] ?? []),
    lat: map['lat']?.toDouble() ?? 0.0,
    lng: map['lng']?.toDouble() ?? 0.0,
    route: (map['route'] as List?)?.map((l) => List<double>.from((l as List).map((e) => (e as num).toDouble()))).toList() ?? [],
    isActive: map['isActive'] ?? map['is_active'] ?? true,
    serviceHistory: ((map['serviceHistory'] ?? map['service_history']) as List?)?.map((x) => ServiceRecord.fromMap(x as Map<String, dynamic>)).toList() ?? [],
    isBlacklisted: map['isBlacklisted'] ?? map['is_blacklisted'] ?? false,
    imageUrl: map['imageUrl'] ?? map['image_url'],
  );
}

class Driver {
  final String id;
  final String name;
  final String phone;
  final int age;
  final int exp;
  final String lic;
  final String licExp;
  final String blood;
  final String vehicle;
  final String status;
  final int score;
  final double mil;
  final double idle;
  final int trips;
  final int harsh;
  final int overSpeed;
  final int deviation;
  final int fuelEff;
  final double rating;
  final String home;
  final bool onLeave;
  final bool isActive;
  final List<Trip> tripHistory;
  final String? imageUrl;

  Driver({
    required this.id, required this.name, required this.phone, required this.age, required this.exp, required this.lic,
    required this.licExp, required this.blood, required this.vehicle, required this.status, required this.score,
    required this.mil, required this.idle, required this.trips, required this.harsh, required this.overSpeed,
    required this.deviation, required this.fuelEff, required this.rating, required this.home, required this.onLeave,
    this.isActive = true,
    this.tripHistory = const [],
    this.imageUrl,
  });

  Driver copyWith({String? vehicle, String? status, int? score, double? idle, double? mil, bool? isActive, List<Trip>? tripHistory, String? imageUrl}) {
    return Driver(
      id: id, name: name, phone: phone, age: age, exp: exp, lic: lic, licExp: licExp, blood: blood,
      vehicle: vehicle ?? this.vehicle, status: status ?? this.status, score: score ?? this.score, mil: mil ?? this.mil, idle: idle ?? this.idle,
      trips: trips, harsh: harsh, overSpeed: overSpeed, deviation: deviation, fuelEff: fuelEff, rating: rating,
      home: home, onLeave: onLeave,
      isActive: isActive ?? this.isActive,
      tripHistory: tripHistory ?? this.tripHistory,
      imageUrl: imageUrl ?? this.imageUrl,
    );
  }

  Map<String, dynamic> toMap() => {
    'id': id, 'name': name, 'phone': phone, 'age': age, 'exp': exp, 'lic': lic,
    'lic_exp': licExp, 'blood': blood, 'vehicle': vehicle, 'status': status,
    'score': score, 'mil': mil, 'idle': idle, 'trips': trips, 'harsh': harsh,
    'over_speed': overSpeed, 'deviation': deviation, 'fuel_eff': fuelEff,
    'rating': rating, 'home': home, 'on_leave': onLeave, 'is_active': isActive,
    'trip_history': tripHistory.map((x) => x.toMap()).toList(),
    'image_url': imageUrl,
  };

  factory Driver.fromMap(Map<String, dynamic> map) => Driver(
    id: map['id'] ?? '',
    name: map['name'] ?? '',
    phone: map['phone'] ?? '',
    age: map['age'] ?? 30,
    exp: map['exp'] ?? 0,
    lic: map['lic'] ?? '',
    licExp: map['licExp'] ?? map['lic_exp'] ?? '',
    blood: map['blood'] ?? '',
    vehicle: map['vehicle'] ?? '',
    status: map['status'] ?? '',
    score: map['score'] ?? 0,
    mil: map['mil']?.toDouble() ?? 0.0,
    idle: map['idle']?.toDouble() ?? 0.0,
    trips: map['trips'] ?? 0,
    harsh: map['harsh'] ?? 0,
    overSpeed: map['overSpeed'] ?? map['over_speed'] ?? 0,
    deviation: map['deviation'] ?? 0,
    fuelEff: map['fuelEff'] ?? map['fuel_eff'] ?? 0,
    rating: map['rating']?.toDouble() ?? 0.0,
    home: map['home'] ?? '',
    onLeave: map['onLeave'] ?? map['on_leave'] ?? false,
    isActive: map['isActive'] ?? map['is_active'] ?? true,
    tripHistory: ((map['tripHistory'] ?? map['trip_history']) as List?)?.map<Trip>((x) => Trip.fromMap(x as Map<String, dynamic>)).toList() ?? <Trip>[],
    imageUrl: map['imageUrl'] ?? map['image_url'],
  );
}

class FuelTrend {
  final String d;
  final double used;
  final double loss;

  FuelTrend({required this.d, required this.used, required this.loss});
}

class DataEngine extends ChangeNotifier {
  int spend = 2468420;
  double loss = 172000.0;
  int savings = 114000;
  int spendLiters = 0;
  int lossLiters = 0;
  int savingsLiters = 0;
  int idleSeconds = 0;
  int idleMinutes = 0;
  double idleHours = 0.0;
  double idleRupees = 0.0;
  double avgMil = 4.81;
  double idle = 18.2;
  int health = 72;
  int active = 28;
  int tripsToday = 14;
  bool hasNewAlerts = false;

  Vehicle? _selectedVehicle;
  Vehicle? get selectedVehicle => _selectedVehicle;

  // When another UI wants to request that the Trips view open a specific trip
  // (e.g. from a dashboard dropdown), set this id. `TripsScreen` listens and
  // will clear it after honouring the request.
  String? highlightedTripId;

  void highlightTrip(String? tripId) {
    highlightedTripId = tripId;
    notifyListeners();
  }

  void selectVehicle(Vehicle? v) {
    _selectedVehicle = v;
    notifyListeners();
  }

  void markAlertsAsRead() {
    hasNewAlerts = false;
    notifyListeners();
  }

  Future<Map<String, String>> _getHeaders() async {
    final user = FirebaseAuth.instance.currentUser;
    final token = await user?.getIdToken();
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer $token',
    };
  }

  Future<void> addVehicle(Vehicle v) async {
    vehicles = [...vehicles, v];
    _syncVehicleStatuses();
    notifyListeners();
    await _saveVehicleToBackend(v);
  }

  Future<void> updateVehicle(Vehicle v) async {
    vehicles = vehicles.map((existing) => existing.plate == v.plate ? v : existing).toList();
    if (_selectedVehicle?.plate == v.plate) _selectedVehicle = v;
    _syncVehicleStatuses();
    notifyListeners();
    await _saveVehicleToBackend(v);
  }

  Future<void> deactivateVehicle(String plate) async {
    final v = vehicles.firstWhere((v) => v.plate == plate);
    final updated = v.copyWith(isActive: false);
    vehicles = vehicles.map((x) => x.plate == plate ? updated : x).toList();
    _syncVehicleStatuses();
    notifyListeners();
    await _saveVehicleToBackend(updated);
  }

  Future<void> _saveVehicleToBackend(Vehicle v) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/api/vehicles'),
        headers: headers,
        body: jsonEncode(v.toMap()),
      );
      if (response.statusCode == 400 || response.statusCode == 409) {
        // Vehicle already exists, try PUT update instead
        final putResponse = await http.put(
          Uri.parse('$baseUrl/api/vehicles/${v.plate}'),
          headers: headers,
          body: jsonEncode(v.toMap()),
        );
        if (putResponse.statusCode != 200 && putResponse.statusCode != 201) {
          debugPrint("Error updating vehicle: ${putResponse.statusCode} ${putResponse.body}");
        }
      } else if (response.statusCode != 200 && response.statusCode != 201) {
        debugPrint("Error saving vehicle to backend: ${response.statusCode} ${response.body}");
      }
    } catch (e) {
      debugPrint("Error saving vehicle to backend: $e");
    }
  }

  Future<void> removeVehicle(String plate) async {
    try {
      final headers = await _getHeaders();
      final response = await http.delete(
        Uri.parse('$baseUrl/api/vehicles/$plate'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        // refresh lists from backend to ensure related references are updated
        await _loadVehicles();
        await _loadDrivers();
        notifyListeners();
      } else {
        debugPrint('Error deleting vehicle from backend: ${response.statusCode} ${response.body}');
      }
    } catch (e) {
      debugPrint('Error deleting vehicle: $e');
    }
  }

  Future<void> addDriver(Driver d) async {
    drivers = [...drivers, d];
    notifyListeners();
    await _saveDriverToBackend(d);
  }

  Future<void> updateDriver(Driver d) async {
    drivers = drivers.map((existing) => existing.id == d.id ? d : existing).toList();
    notifyListeners();
    await _saveDriverToBackend(d);
  }

  Future<void> deactivateDriver(String id) async {
    final d = drivers.firstWhere((d) => d.id == id);
    final updated = d.copyWith(isActive: false);
    drivers = drivers.map((x) => x.id == id ? updated : x).toList();
    notifyListeners();
    await _saveDriverToBackend(updated);
  }

  Future<void> _saveDriverToBackend(Driver d) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/api/drivers'),
        headers: headers,
        body: jsonEncode(d.toMap()),
      );
      if (response.statusCode == 400 || response.statusCode == 409) {
        // Driver already exists, try PUT update instead
        final putResponse = await http.put(
          Uri.parse('$baseUrl/api/drivers/${d.id}'),
          headers: headers,
          body: jsonEncode(d.toMap()),
        );
        if (putResponse.statusCode != 200 && putResponse.statusCode != 201) {
          debugPrint("Error updating driver: ${putResponse.statusCode} ${putResponse.body}");
        }
      } else if (response.statusCode != 200 && response.statusCode != 201) {
        debugPrint("Error saving driver to backend: ${response.statusCode} ${response.body}");
      }
    } catch (e) {
      debugPrint("Error saving driver to backend: $e");
    }
  }

  Future<void> removeDriver(String id) async {
    try {
      final headers = await _getHeaders();
      final response = await http.delete(
        Uri.parse('$baseUrl/api/drivers/$id'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        // refresh lists from backend to ensure related references are updated
        await _loadDrivers();
        await _loadVehicles();
        notifyListeners();
      } else {
        debugPrint('Error deleting driver from backend: ${response.statusCode} ${response.body}');
      }
    } catch (e) {
      debugPrint('Error deleting driver: $e');
    }
  }

  Future<void> assignVehicle(String driverName, String vehiclePlate) async {
    vehicles = vehicles.map((v) => v.plate == vehiclePlate ? v.copyWith(driver: driverName) : v).toList();
    drivers = drivers.map((d) => d.name == driverName ? d.copyWith(vehicle: vehiclePlate) : d).toList();
    _syncVehicleStatuses();
    await _saveVehicles();
    await _saveDrivers();

    // Persist assignment to backend by updating an active trip if one exists.
    try {
      Trip? matching;
      // Prefer trip active for this vehicle
      final vehicleObj = vehicles.firstWhere((v) => v.plate.trim().toUpperCase() == vehiclePlate.trim().toUpperCase(), orElse: () => null as Vehicle);
      if (vehicleObj != null) {
        matching = _activeTripForVehicle(vehicleObj);
      }
      // If not found, try by driver name
      if (matching == null) {
        matching = trips.firstWhere((t) => t.driver.trim().toLowerCase() == driverName.trim().toLowerCase() && t.tripCompleted != true, orElse: () => null as Trip);
      }
      // Fallback: first active trip missing an assignment
      if (matching == null) {
        matching = trips.firstWhere((t) => t.tripCompleted != true && (t.vehicle.trim().isEmpty || t.driver.trim().isEmpty), orElse: () => null as Trip);
      }
      if (matching != null) {
        final updated = matching.copyWith(vehicle: vehiclePlate, driver: driverName);
        // update local cache then persist
        trips = trips.map((t) => t.id == updated.id ? updated : t).toList();
        await _saveTripToBackend(updated);
      }
    } catch (e) {
      debugPrint('No matching trip to persist assignment: $e');
    }

    notifyListeners();
  }

  bool _hasAssignedDriver(Vehicle vehicle) {
    return vehicle.driver.isNotEmpty && vehicle.driver != 'Unassigned' && vehicle.driver != 'None';
  }

  String _normalizeVehicleKey(String value) {
    return value.trim().toUpperCase().replaceAll(RegExp(r'\s+'), ' ');
  }

  Trip? _activeTripForVehicle(Vehicle vehicle) {
    final vehicleKey = _normalizeVehicleKey(vehicle.plate);
    for (final trip in trips) {
      final tripKey = _normalizeVehicleKey(trip.vehicle);
      final activeByStatus = trip.status != 'completed' && trip.status != 'cancelled';
      if (tripKey == vehicleKey && trip.tripCompleted != true && activeByStatus) {
        return trip;
      }
    }
    return null;
  }

  String _effectiveVehicleStatus(Vehicle vehicle) {
    if (!vehicle.isActive) return 'inactive';
    final activeTrip = _activeTripForVehicle(vehicle);
    if (activeTrip == null) return 'offline';

    final tripStatus = activeTrip.status.trim();
    return tripStatus.isEmpty ? 'offline' : tripStatus;
  }

  void _syncVehicleStatuses() {
    vehicles = vehicles.map((vehicle) {
      final derivedStatus = _effectiveVehicleStatus(vehicle);
      final activeTrip = _activeTripForVehicle(vehicle);
      final tripDriver = activeTrip?.driver.trim() ?? '';
      final derivedDriver = tripDriver.isNotEmpty ? tripDriver : vehicle.driver;
      return vehicle.copyWith(status: derivedStatus, driver: derivedDriver);
    }).toList();

    if (_selectedVehicle != null) {
      _selectedVehicle = vehicles.firstWhere(
        (vehicle) => vehicle.plate == _selectedVehicle!.plate,
        orElse: () => _selectedVehicle!,
      );
    }
  }



  Map<String, double> cityRates = {
    'Mumbai': 94.27, 'Delhi': 87.62, 'Bangalore': 87.89, 'Chennai': 92.76, 'Hyderabad': 97.82, 'Pune': 92.51,
  };

  List<Alert> alerts = [];
  List<FuelLog> fuelLogs = [];

  Future<void> addFuelLog(FuelLog log) async {
    // Find previous log for same vehicle
    final prev = fuelLogs.firstWhere(
      (l) => l.vehicle == log.vehicle,
      orElse: () => log,
    );
    fuelLogs = [log, ...fuelLogs];

    if (log.isSuspect) {
      _triggerAlert(
        log.vehicle,
        'Fuel theft suspected: ${log.liters.toStringAsFixed(1)}L exceeds limit ${effectiveFuelTheftThreshold.toStringAsFixed(1)}L',
        'warning',
        AlertCategory.fuel,
      );
    }
    
    Vehicle? updatedVehicle;
    
    // Compute km/L if we have two odometer readings
    if (prev != log && log.odometer > prev.odometer && log.liters > 0) {
      double kmPerL = (log.odometer - prev.odometer) / log.liters;
      // Update the vehicle's mil field
      vehicles = vehicles.map((v) => v.plate == log.vehicle
          ? updatedVehicle = Vehicle(plate: v.plate, model: v.model, year: v.year, type: v.type, status: v.status, driver: v.driver, loc: v.loc, speed: v.speed, fuel: v.fuel, mil: double.parse(kmPerL.toStringAsFixed(2)), idle: v.idle, fastag: v.fastag, odo: log.odometer, nextService: v.nextService, insurance: v.insurance, permit: v.permit, puc: v.puc, lastFill: log.date, alerts: v.alerts, lat: v.lat, lng: v.lng, route: v.route, isActive: v.isActive, serviceHistory: v.serviceHistory, isBlacklisted: v.isBlacklisted, health: v.health)
          : v).toList();
    }
    
    notifyListeners();
    
    // Save log to backend
    await _saveFuelLogToBackend(log);
    
    // Save updated vehicle to backend if it was modified
    if (updatedVehicle != null) {
      await _saveVehicleToBackend(updatedVehicle!);
    }
  }

  Future<void> _saveFuelLogToBackend(FuelLog log) async {
    try {
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/api/fuel_logs'),
        headers: headers,
        body: jsonEncode({
          'id': log.id,
          'vehicle': log.vehicle,
          'driver': log.driver,
          'station': log.station,
          'liters': log.liters,
          'rate': log.rate,
          'cost': log.cost,
          'odometer': log.odometer,
          'date': log.date,
          'is_suspect': log.isSuspect,
          'suspect_reason': log.suspectReason,
        }),
      );
      if (response.statusCode != 200) {
        debugPrint("Error saving fuel log to backend: ${response.statusCode}");
      }
    } catch (e) {
      debugPrint("Error saving fuel log to backend: $e");
    }
  }

  Future<void> _loadAlerts() async {
    try {
      final headers = await _getHeaders();
      // Try a persisted backend override first (useful for physical devices), then localhost, then emulator IP.
      final candidates = <String>[];
      if (backendBaseUrl != null && backendBaseUrl!.isNotEmpty) {
        candidates.add(backendBaseUrl!.replaceAll(RegExp(r'/$'), '') + '/api/alerts');
      }
      candidates.add('http://localhost:3000/api/alerts');
      candidates.add('http://10.0.2.2:3000/api/alerts');
      candidates.add('$baseUrl/api/alerts');

      http.Response? response;
      Exception? lastErr;
      for (final u in candidates) {
        try {
          final uri = Uri.parse(u);
          response = await http.get(uri, headers: headers).timeout(const Duration(seconds: 4));
          if (response.statusCode == 200) break;
        } catch (e) {
          lastErr = e as Exception? ?? Exception('unknown');
          continue;
        }
      }
      if (response == null) throw lastErr ?? Exception('No response from backend');

      if (response.statusCode == 200) {
        final List items = jsonDecode(response.body) as List;
        final parsed = items.map((m) {
          final map = m as Map<String, dynamic>;
          final type = map['type'] ?? map['details'] ?? 'unknown';
          String sev = 'warning';
          AlertCategory cat = AlertCategory.fuel;
          if (type == 'rash_driving' || type == 'harsh_braking') { sev = 'danger'; cat = AlertCategory.safety; }
          else if (type == 'fuel_theft') { sev = 'warning'; cat = AlertCategory.fuel; }
          else if (type == 'idle') { sev = 'warning'; cat = AlertCategory.fuel; }

          return Alert(
            id: map['id']?.toString() ?? (map['tripId']?.toString() ?? ''),
            truck: map['vehiclePlate'] ?? map['vehicle'] ?? map['tripId'] ?? '',
            msg: map['message'] ?? map['details'] ?? '',
            time: map['detectedAt'] ?? map['detected_at'] ?? 'Now',
            sev: sev,
            category: cat,
            status: AlertStatus.pending,
            driver: map['driver'] ?? ''
          );
        }).toList();

        String alertKey(Alert a) => '${a.truck}|${a.msg}|${a.sev}|${a.category.name}';

        // Preserve current UI state for alerts already on screen so polling
        // doesn't visibly replace them every refresh.
        final currentByKey = <String, Alert>{
          for (final a in alerts) alertKey(a): a,
        };
        final localPending = alerts.where((a) => a.driver == 'local' && a.status == AlertStatus.pending).toList();

        final merged = <Alert>[];
        for (final serverAlert in parsed) {
          final key = alertKey(serverAlert);
          final existing = currentByKey[key];
          if (existing != null) {
            merged.add(existing.copyWith(
              status: existing.status,
              driver: serverAlert.driver.isNotEmpty ? serverAlert.driver : existing.driver,
            ));
          } else {
            merged.add(serverAlert);
          }
        }

        for (final lp in localPending) {
          final key = alertKey(lp);
          if (!merged.any((a) => alertKey(a) == key)) {
            merged.insert(0, lp);
          }
        }

        alerts = merged;
        hasNewAlerts = alerts.isNotEmpty;
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Failed to load alerts: $e');
    }
  }

  void acknowledgeAlert(String id) {
    alerts = alerts.map((a) => a.id == id ? a.copyWith(status: AlertStatus.acknowledged) : a).toList();
    notifyListeners();
  }

  void dismissAllAlerts() {
    alerts = alerts.map((a) => a.copyWith(status: AlertStatus.dismissed)).toList();
    notifyListeners();
  }

  Future<bool> clearAllAlerts() async {
    try {
      final headers = await _getHeaders();
      final candidates = <String>[];
      if (backendBaseUrl != null && backendBaseUrl!.isNotEmpty) {
        candidates.add(backendBaseUrl!.replaceAll(RegExp(r'/$'), '') + '/api/alerts');
      }
      candidates.add('http://localhost:3000/api/alerts');
      candidates.add('http://10.0.2.2:3000/api/alerts');
      candidates.add('$baseUrl/api/alerts');

      http.Response? response;
      Exception? lastErr;
      for (final u in candidates) {
        try {
          final uri = Uri.parse(u);
          response = await http.delete(uri, headers: headers).timeout(const Duration(seconds: 4));
          if (response.statusCode == 200) break;
        } catch (e) {
          lastErr = e as Exception? ?? Exception('unknown');
          continue;
        }
      }

      if (response != null && response.statusCode == 200) {
        // reload authoritative list from backend
        await _loadAlerts();
        return true;
      } else {
        // fallback: clear local cache so UI reflects cleared state immediately
        alerts = [];
        hasNewAlerts = false;
        notifyListeners();
        debugPrint('clearAllAlerts: failed to delete on server: ${response?.statusCode} ${lastErr ?? ''}');
        return false;
      }
    } catch (e) {
      debugPrint('clearAllAlerts error: $e');
      alerts = [];
      hasNewAlerts = false;
      notifyListeners();
      return false;
    }
  }

  // A map to track the recent speed history of each vehicle to detect harsh braking.
  final Map<String, List<int>> _vehicleSpeedHistory = {};


  void _checkAlerts(Vehicle v) {
    // 1. Over-speeding (Rash Driving) alert:
    if (alertSettings.perTypeToggles['overSpeed'] == true && v.speed > effectiveSpeedThreshold) {
      _triggerAlert(v.plate, 'Rash driving: Speed ${v.speed} km/h (Limit: ${effectiveSpeedThreshold} km/h)', 'danger', AlertCategory.safety);
    }

    // 2. Harsh braking detection:
    final history = _vehicleSpeedHistory.putIfAbsent(v.plate, () => []);
    history.add(v.speed);
    if (history.length > 3) {
      history.removeAt(0); // keep last 3 readings (6 seconds)
    }

    if (history.length >= 2) {
      final oldSpeed = history[0];
      final newSpeed = v.speed;
      final drop = oldSpeed - newSpeed;
      if (drop >= 40) {
        _triggerAlert(v.plate, 'Harsh braking detected: Speed dropped from $oldSpeed to $newSpeed km/h within 5 seconds', 'danger', AlertCategory.safety);
      }
    }
  }

  Future<void> _triggerAlert(String truck, String msg, String sev, AlertCategory category) async {
    final id = 'P-${Random().nextInt(100000)}';
    // Create a local pending alert immediately so UI shows something fast.
    if (!alerts.any((a) => a.truck == truck && a.msg == msg && a.status == AlertStatus.pending)) {
      final local = Alert(id: id, truck: truck, msg: msg, time: 'Now', sev: sev, category: category, driver: 'local');
      alerts = [local, ...alerts];
      hasNewAlerts = true;
      notifyListeners();
    }

    // Try to persist the alert to the backend so it becomes authoritative.
    try {
      final headers = await _getHeaders();
      final candidates = <String>[];
      if (backendBaseUrl != null && backendBaseUrl!.isNotEmpty) {
        candidates.add(backendBaseUrl!.replaceAll(RegExp(r'/$'), '') + '/api/alerts');
      }
      candidates.add('http://localhost:3000/api/alerts');
      candidates.add('http://10.0.2.2:3000/api/alerts');
      candidates.add('$baseUrl/api/alerts');

      http.Response? response;
      for (final u in candidates) {
        try {
          response = await http.post(
            Uri.parse(u),
            headers: headers,
            body: jsonEncode({
              'trip': truck,
              'type': category == AlertCategory.safety ? 'rash_driving' : 'idle',
              'message': msg,
              'severity': sev,
              'driver': 'local',
              'detectedAt': DateTime.now().toIso8601String(),
            }),
          ).timeout(const Duration(seconds: 4));
          if (response.statusCode == 200) break;
        } catch (_) {
          continue;
        }
      }

      if (response != null && response.statusCode == 200) {
        // Refresh authoritative list from backend so the alert becomes canonical
        await _loadAlerts();
        return;
      }
    } catch (e) {
      debugPrint('Failed to persist alert to server: $e');
    }

    // If persisting failed, keep the local pending alert until the next successful poll.
  }

  List<FuelTrend> fuelTrend = [
    FuelTrend(d: '01 Apr', used: 42000, loss: 3100), FuelTrend(d: '03 Apr', used: 38000, loss: 2800),
    FuelTrend(d: '05 Apr', used: 51000, loss: 3600), FuelTrend(d: '07 Apr', used: 44000, loss: 3200),
    FuelTrend(d: '09 Apr', used: 49000, loss: 3500), FuelTrend(d: '11 Apr', used: 37000, loss: 2700),
    FuelTrend(d: '13 Apr', used: 53000, loss: 3800), FuelTrend(d: '15 Apr', used: 46000, loss: 3300),
  ];

  List<Trip> trips = [];

  void addTrip(Trip trip) {
    trips = [trip, ...trips];
    notifyListeners();
    _saveTripToBackend(trip);
  }

  Future<void> refreshData() async {
    await _loadTrips();
    await _loadVehicles();
    await _loadDrivers();
    await _loadSummary();
  }

  void updateTripStatus(String id, String status, {double? progress, double? liveSpeed, bool? power, int? idleDuration}) {
    trips = trips.map((t) {
      if (t.id == id) {
        final updated = t.copyWith(
          status: status,
          progress: progress,
          liveSpeed: liveSpeed,
          power: power,
          idleDuration: idleDuration,
        );
        _saveTripToBackend(updated);
        return updated;
      }
      return t;
    }).toList();
    notifyListeners();
  }

  Organization org = Organization(
    name: 'DravYantra Logistics Pvt Ltd',
    gstin: '27AAAAA0000A1Z5',
    pan: 'AAAAA0000A',
    city: 'Pune',
    state: 'Maharashtra',
    contact: '+91 20 2740 1234'
  );
  UserAccount user = UserAccount(
    name: 'Admin User',
    email: 'admin@drav_yantra.in',
    phone: '+91 98765 43210',
    role: 'Fleet Manager',
    timezone: 'IST (UTC+5:30)',
  );
  AlertSettings alertSettings = AlertSettings(speedThreshold: 80, idleLimit: 15, fuelDropThreshold: 5.0, fastagThreshold: 500, whatsappEnabled: true, smsEnabled: false, pushEnabled: true, emailEnabled: true, mileageThreshold: 4.0, perTypeToggles: const {'overSpeed': true, 'excessIdle': true, 'fuelDrop': true, 'geoFence': true, 'harshBraking': true, 'eWayBill': true, 'fastag': true, 'gpsLost': true});

  bool isLoggedIn = true;
  String? backendBaseUrl; // persisted override for device testing (e.g. http://192.168.1.42:3000)

  String get baseUrl {
    if (backendBaseUrl != null && backendBaseUrl!.isNotEmpty) {
      return backendBaseUrl!.replaceAll(RegExp(r'/$'), '');
    }
    if (!kIsWeb && Platform.isAndroid) {
      return 'http://10.0.2.2:3000';
    }
    return 'http://localhost:3000';
  }

  void updateOrg(Organization newOrg) {
    org = newOrg;
    notifyListeners();
  }

  void updateAccount(UserAccount newAccount) {
    user = newAccount;
    notifyListeners();
  }

  Future<void> updateAlertSettings(AlertSettings newSettings) async {
    alertSettings = newSettings;
    notifyListeners();
    try {
      final headers = await _getHeaders();
      final candidates = <String>[];
      if (backendBaseUrl != null && backendBaseUrl!.isNotEmpty) {
        candidates.add(backendBaseUrl!.replaceAll(RegExp(r'/$'), '') + '/api/fleet-settings');
      }
      candidates.add('http://localhost:3000/api/fleet-settings');
      candidates.add('http://10.0.2.2:3000/api/fleet-settings');
      candidates.add('$baseUrl/api/fleet-settings');

      for (final u in candidates) {
        try {
          final response = await http.put(
            Uri.parse(u),
            headers: headers,
            body: jsonEncode({
              'speedThreshold': newSettings.speedThreshold,
              'fuelDropThreshold': newSettings.fuelDropThreshold,
            }),
          ).timeout(const Duration(seconds: 4));
          if (response.statusCode == 200) {
            break;
          }
        } catch (_) {
          continue;
        }
      }
    } catch (e) {
      debugPrint('Failed to persist fleet settings: $e');
    }
  }

  int get effectiveSpeedThreshold => user.speedLimitOverride ?? alertSettings.speedThreshold;
  double get effectiveFuelTheftThreshold => user.fuelTheftLimitOverride ?? alertSettings.fuelDropThreshold;

  void updateUserAlertOverrides({int? speedLimitOverride, double? fuelTheftLimitOverride}) {
    user = user.copyWith(
      speedLimitOverride: speedLimitOverride,
      fuelTheftLimitOverride: fuelTheftLimitOverride,
    );
    notifyListeners();
  }

  void logout() {
    isLoggedIn = false;
    notifyListeners();
  }

  List<Vehicle> vehicles = [];

  List<Driver> drivers = [];
  // Queue for trip saves that failed due to backend unavailability
  final List<Trip> _pendingSaves = [];
  // Track last save timestamp per trip (epoch seconds) to throttle frequent updates
  final Map<String, int> _lastTripSaveAt = {};
  // Prevent duplicate concurrent writes for the same trip.
  final Set<String> _tripSaveInFlight = <String>{};
  // After a 429, wait before retrying that trip again.
  final Map<String, int> _tripRetryAfterAt = {};

  DataEngine() {
    // load persisted backend override if set
    () async {
      try {
        final prefs = await SharedPreferences.getInstance();
        backendBaseUrl = prefs.getString('backend_base_url');
      } catch (_) {}
    }();
    _loadVehicles();
    _loadDrivers();
    _loadFuelLogs();
    _loadTrips();
    _loadSummary();
    _loadAlerts();
    _loadFleetSettings();
    // Poll backend periodically so database changes propagate into the UI quickly.
    // This refreshes trips first, then vehicles, drivers, and summary.
    _summaryPollTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
      () async {
        await _loadTrips();
        await _loadVehicles();
        await _loadDrivers();
        await _loadSummary();
      }();
    });
    // poll server alerts periodically
    Timer.periodic(const Duration(seconds: 5), (_) => _loadAlerts());
    // Periodic update: do NOT simulate random speeds anymore.
    // Use the DB-provided `speed` for vehicles only when the vehicle has an
    // active trip with `power==true`. When not running, show speed as 0 in UI.
    Timer.periodic(const Duration(seconds: 1), (timer) {
      vehicles = vehicles.map((v) {
        if (!v.isActive) return v;

        // Find if this vehicle has an active trip
        final activeTrip = _activeTripForVehicle(v);
        final powerOn = activeTrip?.power == true;

        // Do not generate random telemetry. Respect DB value for `speed` when
        // the trip is running; otherwise present 0 in UI.
        final int newSpeed = powerOn ? v.speed : 0;

        // Preserve location values (no synthetic movement).
        final updatedV = v.copyWith(
          lat: v.lat,
          lng: v.lng,
          speed: newSpeed,
          route: newSpeed > 0 ? [...v.route, [v.lat, v.lng]] : v.route,
        );
        _checkAlerts(updatedV);
        return updatedV;
      }).toList();

      // Trip rows are now authoritative from the backend. Do not rewrite live
      // speed or derived trip metrics from vehicle telemetry here, because that
      // creates a refresh loop against manual DB edits and backend recomputation.
      // Vehicle telemetry still updates the vehicle list and alerts above.

      drivers = drivers.map((d) {
        int newScore = d.onLeave ? d.score : max(0, min(100, (d.score + (Random().nextDouble() * 2 - 1)).round()));
        double newIdle = d.status == 'on_duty' ? max(0, double.parse((d.idle + (Random().nextDouble() * 1 - 0.5)).toStringAsFixed(1))) : d.idle;
        double newMil = d.status == 'on_duty' ? max(2, double.parse((d.mil + (Random().nextDouble() * 0.1 - 0.05)).toStringAsFixed(2))) : d.mil;
        return d.copyWith(score: newScore, idle: newIdle, mil: newMil);
      }).toList();

      notifyListeners();
    });

    // Periodically attempt to flush any pending trip saves if backend was down
    Timer.periodic(const Duration(seconds: 10), (timer) {
      if (_pendingSaves.isEmpty) return;
      final copies = List<Trip>.from(_pendingSaves);
      for (final t in copies) {
        _attemptSavePending(t);
      }
    });
  }

  Timer? _summaryPollTimer;

  @override
  void dispose() {
    try { _summaryPollTimer?.cancel(); } catch (_) {}
    super.dispose();
  }

  Future<void> _loadFleetSettings() async {
    try {
      final headers = await _getHeaders();
      final candidates = <String>[];
      if (backendBaseUrl != null && backendBaseUrl!.isNotEmpty) {
        candidates.add(backendBaseUrl!.replaceAll(RegExp(r'/$'), '') + '/api/fleet-settings');
      }
      candidates.add('http://localhost:3000/api/fleet-settings');
      candidates.add('http://10.0.2.2:3000/api/fleet-settings');
      candidates.add('$baseUrl/api/fleet-settings');

      for (final u in candidates) {
        try {
          final response = await http.get(Uri.parse(u), headers: headers).timeout(const Duration(seconds: 4));
          if (response.statusCode == 200) {
            final map = jsonDecode(response.body) as Map<String, dynamic>;
            final merged = alertSettings.copyWith(
              speedThreshold: (map['speedThreshold'] as num?)?.toInt() ?? alertSettings.speedThreshold,
              fuelDropThreshold: (map['fuelDropThreshold'] as num?)?.toDouble() ?? alertSettings.fuelDropThreshold,
            );
            alertSettings = merged;
            notifyListeners();
            break;
          }
        } catch (_) {
          continue;
        }
      }
    } catch (e) {
      debugPrint('Failed to load fleet settings: $e');
    }
  }

  Future<String> _getFilePath(String filename) async {
    final directory = await getApplicationDocumentsDirectory();
    return '${directory.path}/$filename';
  }

  Future<void> setBackendBaseUrl(String? url) async {
    backendBaseUrl = url;
    try {
      final prefs = await SharedPreferences.getInstance();
      if (url == null || url.isEmpty) await prefs.remove('backend_base_url');
      else await prefs.setString('backend_base_url', url);
    } catch (e) {
      debugPrint('Failed to persist backendBaseUrl: $e');
    }
    notifyListeners();
  }

  Future<void> _saveVehicles() async {
    try {
      if (kIsWeb) {
        final prefs = await SharedPreferences.getInstance();
        final String encoded = jsonEncode(vehicles.map((v) => v.toMap()).toList());
        await prefs.setString('vehicles_json', encoded);
        debugPrint("Saved vehicles to JSON (Web)");
      } else {
        debugPrint("Saving vehicles to CSV (Desktop)... Count: ${vehicles.length}");
        List<List<Object>> rows = vehicles.map((v) => <Object>[
          v.plate, v.model, v.year, v.type, v.status, v.driver, v.loc, v.speed, v.fuel, v.mil, v.idle, v.fastag, v.health, v.odo, v.nextService, v.insurance, v.permit, v.puc, v.lastFill, v.lat, v.lng, v.isActive, v.isBlacklisted,
          jsonEncode(v.alerts),
          jsonEncode(v.route),
          jsonEncode(v.serviceHistory.map((x) => x.toMap()).toList())
        ]).toList();
        
        rows.insert(0, <Object>['plate', 'model', 'year', 'type', 'status', 'driver', 'loc', 'speed', 'fuel', 'mil', 'idle', 'fastag', 'health', 'odo', 'nextService', 'insurance', 'permit', 'puc', 'lastFill', 'lat', 'lng', 'isActive', 'isBlacklisted', 'alerts', 'route', 'serviceHistory']);
        
        List<List<String>> stringRows = rows.map((r) => r.map((e) => e.toString()).toList()).toList();
        String csv = const ListToCsvConverter().convert(stringRows);
        
        final path = await _getFilePath('vehicles.csv');
        final File file = File(path);
        await file.writeAsString(csv);
        debugPrint("Saved to File: $path");
      }
    } catch (e) {
      debugPrint("Error saving vehicles: $e");
    }
  }

  Future<void> _loadSummary() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('$baseUrl/api/trips/summary'), headers: headers);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        spend = (data['totalFuelRupees'] ?? 0).toInt();
        loss = (data['totalMoneyWasted'] ?? 0).toDouble();
        savings = (data['totalMoneySaved'] ?? 0).toInt();
        spendLiters = (data['totalFuelLiters'] ?? 0).toInt();
        lossLiters = (data['totalFuelWastedLiters'] ?? 0).toInt();
        savingsLiters = (data['totalFuelSavedLiters'] ?? 0).toInt();
        idleMinutes = (data['totalIdleMinutes'] ?? 0).toInt();
        idleSeconds = idleMinutes * 60;
        idleHours = (data['totalIdleHours'] ?? (idleMinutes / 60.0)).toDouble();
        idleRupees = (data['totalIdleRupees'] ?? 0).toDouble();
        notifyListeners();
      } else {
        debugPrint('Failed to load summary: ${response.statusCode} ${response.body}');
      }
    } catch (e) {
      debugPrint('Error loading summary: $e');
    }
  }

  Future<void> _loadVehicles() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('$baseUrl/api/vehicles'), headers: headers);
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        vehicles = data.map((item) => Vehicle.fromMap(item as Map<String, dynamic>)).toList();
        _syncVehicleStatuses();
        debugPrint("Loaded vehicles from DB: ${vehicles.length}");
        notifyListeners();
      } else {
        debugPrint("Error loading vehicles: ${response.statusCode}");
      }
    } catch (e) {
      debugPrint("Error loading vehicles: $e");
    }
  }

  Future<List<Vehicle>> fetchAvailableVehicles() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('$baseUrl/api/vehicles?available=true'), headers: headers);
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        final list = data.map((item) => Vehicle.fromMap(item as Map<String, dynamic>)).toList();
        debugPrint("Fetched available vehicles from DB: ${list.length}");
        return list;
      } else {
        debugPrint("Error fetching available vehicles: ${response.statusCode}");
      }
    } catch (e) {
      debugPrint("Error fetching available vehicles: $e");
    }
    return <Vehicle>[];
  }

  Future<void> _loadFuelLogs() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('$baseUrl/api/fuel_logs'), headers: headers);
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        fuelLogs = data.map((item) => FuelLog.fromMap(item as Map<String, dynamic>)).toList();
        debugPrint("Loaded fuel logs from DB: ${fuelLogs.length}");
        notifyListeners();
      } else {
        debugPrint("Error loading fuel logs: ${response.statusCode}");
      }
    } catch (e) {
      debugPrint("Error loading fuel logs: $e");
    }
  }

  Future<void> _saveDrivers() async {
    try {
      if (kIsWeb) {
        final prefs = await SharedPreferences.getInstance();
        final String encoded = jsonEncode(drivers.map((d) => d.toMap()).toList());
        await prefs.setString('drivers_json', encoded);
        debugPrint("Saved drivers to JSON (Web)");
      } else {
        debugPrint("Saving drivers to CSV (Desktop)... Count: ${drivers.length}");
        List<List<Object>> rows = drivers.map((d) => <Object>[
          d.id, d.name, d.phone, d.age, d.exp, d.lic, d.licExp, d.blood, d.vehicle, d.status, d.score, d.mil, d.idle, d.trips, d.harsh, d.overSpeed, d.deviation, d.fuelEff, d.rating, d.home, d.onLeave, d.isActive,
          jsonEncode(d.tripHistory.map((x) => x.toMap()).toList())
        ]).toList();
        
        rows.insert(0, <Object>['id', 'name', 'phone', 'age', 'exp', 'lic', 'licExp', 'blood', 'vehicle', 'status', 'score', 'mil', 'idle', 'trips', 'harsh', 'overSpeed', 'deviation', 'fuelEff', 'rating', 'home', 'onLeave', 'isActive', 'tripHistory']);
        
        List<List<String>> stringRows = rows.map((r) => r.map((e) => e.toString()).toList()).toList();
        String csv = const ListToCsvConverter().convert(stringRows);
        
        final path = await _getFilePath('drivers.csv');
        final File file = File(path);
        await file.writeAsString(csv);
        debugPrint("Saved to File: $path");
      }
    } catch (e) {
      debugPrint("Error saving drivers: $e");
    }
  }

  Future<void> _loadDrivers() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('$baseUrl/api/drivers'), headers: headers);
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        drivers = data.map((item) => Driver.fromMap(item as Map<String, dynamic>)).toList();
        _syncDriverStatuses();
        debugPrint("Loaded drivers from DB: ${drivers.length}");
        notifyListeners();
      } else {
        debugPrint("Error loading drivers: ${response.statusCode}");
      }
    } catch (e) {
      debugPrint("Error loading drivers: $e");
    }
  }

  Future<List<Driver>> fetchAvailableDrivers() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('$baseUrl/api/drivers?available=true'), headers: headers);
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        final list = data.map((item) => Driver.fromMap(item as Map<String, dynamic>)).toList();
        debugPrint("Fetched available drivers from DB: ${list.length}");
        return list;
      } else {
        debugPrint("Error fetching available drivers: ${response.statusCode}");
      }
    } catch (e) {
      debugPrint("Error fetching available drivers: $e");
    }
    return <Driver>[];
  }

  Future<void> _loadTrips() async {
    try {
      final headers = await _getHeaders();
      final response = await http.get(Uri.parse('$baseUrl/api/trips'), headers: headers);
      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body);
        trips = data.map((item) => Trip.fromMap(item as Map<String, dynamic>)).toList();
        _syncVehicleStatuses();
        _syncDriverStatuses();
        debugPrint("Loaded trips from DB: ${trips.length}");
        notifyListeners();
      } else {
        debugPrint("Error loading trips: ${response.statusCode}");
      }
    } catch (e) {
      debugPrint("Error loading trips: $e");
    }
  }

  Map<String, dynamic> _buildTripPatch(Trip t) {
    final prev = trips.firstWhere(
      (x) => x.id == t.id,
      orElse: () => Trip(id: '', vehicle: '', driver: '', from: '', to: '', load: '', client: '', status: 'not_started', ewayBill: '', date: '', progress: 0.0),
    );

    final newMap = t.toMap();
    if (prev.id.isEmpty) {
      return newMap;
    }

    final prevMap = prev.toMap();
    final payload = <String, dynamic>{'id': t.id};
    const fieldsToCheck = ['vehicle','driver','from','to','load','client','status','ewayBill','date','progress','distance','fuelUsed','score','delayMinutes','waypoints','tollCount','liveSpeed','power','idleDuration','tripCompleted','defaultMileage','currentMileage','fuelSaved','fuelWasted','moneySaved','moneyWasted','liveIdleTime','liveIdleSpeed','liveFuelCount'];

    for (final k in fieldsToCheck) {
      final p = prevMap[k];
      final n = newMap[k];
      if (p is List && n is List) {
        if (jsonEncode(p) != jsonEncode(n)) payload[k] = n;
      } else if (p != n) {
        payload[k] = n;
      }
    }

    if (t.updatedAt != null) payload['_updatedAt'] = t.updatedAt;
    return payload.keys.length <= 1 ? newMap : payload;
  }

  Future<void> _saveTripToBackend(Trip t) async {
    try {
      if (_tripSaveInFlight.contains(t.id)) {
        if (!_pendingSaves.any((x) => x.id == t.id)) _pendingSaves.add(t);
        debugPrint('Skipping save for ${t.id}; a save is already in flight');
        return;
      }

      final int nowSec = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      final int retryAfter = _tripRetryAfterAt[t.id] ?? 0;
      if (nowSec < retryAfter) {
        if (!_pendingSaves.any((x) => x.id == t.id)) _pendingSaves.add(t);
        debugPrint('Deferring save for ${t.id}; retry after ${retryAfter - nowSec}s');
        return;
      }

      // Throttle per-trip saves to avoid overwhelming backend DB pool.
      // Allow one save per trip every 10 seconds.
      final int last = _lastTripSaveAt[t.id] ?? 0;
      if (nowSec - last < 10) {
        // Coalesce frequent updates into the pending queue for later flush.
        if (!_pendingSaves.any((x) => x.id == t.id)) _pendingSaves.add(t);
        debugPrint('Throttling save for ${t.id}; last saved ${nowSec - last}s ago');
        return;
      }
      _lastTripSaveAt[t.id] = nowSec;
      _tripSaveInFlight.add(t.id);
      debugPrint('Saving trip ${t.id} to backend: idleDuration=${t.idleDuration} liveSpeed=${t.liveSpeed}');
      try {
        debugPrint('trip payload: ${jsonEncode(t.toMap())}');
      } catch (e) {}
      final headers = await _getHeaders();
      final payload = _buildTripPatch(t);

      final response = await http.post(
        Uri.parse('$baseUrl/api/trips'),
        headers: headers,
        body: jsonEncode(payload),
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        try {
          final Map<String, dynamic> body = jsonDecode(response.body) as Map<String, dynamic>;
          final Trip updated = Trip.fromMap(body);
          // Replace local trip with authoritative server copy to avoid periodic reloads
          trips = trips.map((x) => x.id == updated.id ? updated : x).toList();
          // Remove from pending queue if present
          _pendingSaves.removeWhere((x) => x.id == t.id);
          _tripRetryAfterAt.remove(t.id);
          notifyListeners();
          debugPrint('Trip ${t.id} saved and local cache updated');
        } catch (e) {
          debugPrint('Saved trip but failed to parse response: $e');
        }
      } else {
        debugPrint("Error saving trip to backend: ${response.statusCode} ${response.body}");
        // If server rejected due to a stale update, reload authoritative data
        if (response.statusCode == 409) {
          debugPrint('Stale update detected for ${t.id}, reloading trips from server');
          await _loadTrips();
          // ensure we don't keep retrying a stale local copy
          _pendingSaves.removeWhere((x) => x.id == t.id);
          _tripRetryAfterAt.remove(t.id);
          return;
        }
        if (response.statusCode == 429) {
          // Back off for 30 seconds on rate limit responses to avoid hammering
          // the backend and to keep the DB listener stable.
          _tripRetryAfterAt[t.id] = nowSec + 30;
        }
        // enqueue for retry if not rate-limited or after the backoff expires
        if (!_pendingSaves.any((x) => x.id == t.id)) _pendingSaves.add(t);
      }
    } catch (e) {
      debugPrint("Error saving trip to backend: $e");
      // enqueue for retry
      if (!_pendingSaves.any((x) => x.id == t.id)) _pendingSaves.add(t);
    } finally {
      _tripSaveInFlight.remove(t.id);
    }
  }

  // Try to resend a pending trip save; remove from queue on success
  Future<void> _attemptSavePending(Trip t) async {
    try {
      final int nowSec = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      final int retryAfter = _tripRetryAfterAt[t.id] ?? 0;
      if (nowSec < retryAfter || _tripSaveInFlight.contains(t.id)) {
        return;
      }
      _tripSaveInFlight.add(t.id);
      final headers = await _getHeaders();
      final response = await http.post(
        Uri.parse('$baseUrl/api/trips'),
        headers: headers,
        body: jsonEncode(_buildTripPatch(t)),
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        _pendingSaves.removeWhere((x) => x.id == t.id);
        _tripRetryAfterAt.remove(t.id);
        debugPrint('Flushed pending save for ${t.id}');
      } else if (response.statusCode == 429) {
        _tripRetryAfterAt[t.id] = nowSec + 30;
        debugPrint('Pending save rate-limited for ${t.id}; backing off 30s');
      } else {
        debugPrint('Pending save still failing for ${t.id}: ${response.statusCode}');
      }
    } catch (e) {
      // still offline; keep in queue
      debugPrint('Pending save attempt error for ${t.id}: $e');
    } finally {
      _tripSaveInFlight.remove(t.id);
    }
  }

  Future<bool> removeTrip(String id) async {
    // Optimistic update: remove from local list immediately
    final original = List<Trip>.from(trips);
    trips = trips.where((t) => t.id != id).toList();
    notifyListeners();

    try {
      final headers = await _getHeaders();
      final response = await http.delete(
        Uri.parse('$baseUrl/api/trips/$id'),
        headers: headers,
      );
      if (response.statusCode == 200) {
        // refresh related lists to pick up DB-side changes
        await _loadVehicles();
        await _loadDrivers();
        return true;
      } else {
        debugPrint('Error deleting trip from backend: ${response.statusCode} ${response.body}');
        // revert optimistic change by reloading from backend
        await _loadTrips();
        return false;
      }
    } catch (e) {
      debugPrint('Error deleting trip: $e');
      // revert optimistic change
      trips = original;
      notifyListeners();
      return false;
    }
  }

  String _normalizeName(String value) => value.trim().toLowerCase();

  bool _isRealDriverName(String value) {
    final v = value.trim();
    return v.isNotEmpty && v != 'Unassigned' && v != 'None';
  }

  void _syncDriverStatuses() {
    // For each driver, derive active/on-duty state from active trips (match by id or name)
    final updated = drivers.map((d) {
      final driverId = _normalizeName(d.id);
      final driverName = _normalizeName(d.name);

      final activeTrip = trips.firstWhere(
        (t) {
          final tdriver = _normalizeName(t.driver);
          final activeByStatus = (t.tripCompleted != true) && (t.status != 'completed') && (t.status != 'cancelled');
          return activeByStatus && (tdriver == driverId || tdriver == driverName);
        },
        orElse: () => Trip(id: '', vehicle: '', driver: '', from: '', to: '', load: '', client: '', status: '', ewayBill: '', date: '', progress: 0.0),
      );

      if (activeTrip.id.isNotEmpty) {
        final vehiclePlate = activeTrip.vehicle.isNotEmpty ? activeTrip.vehicle : d.vehicle;
        final status = activeTrip.status.isNotEmpty ? activeTrip.status : 'on_duty';
        return d.copyWith(vehicle: vehiclePlate, isActive: d.isActive, tripHistory: d.tripHistory)..copyWith();
      }

      // If no active trip, preserve assignment but set status to idle if vehicle assigned
      if (d.vehicle.isNotEmpty) {
        return d.copyWith(isActive: d.isActive);
      }

      return d;
    }).toList();

    drivers = updated;
  }
}
