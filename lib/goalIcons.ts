// lib/goalIcons.ts
//
// Curated lucide icon set for the goals picker. We don't expose the full
// 1k+ lucide library — that's overwhelming and most aren't relevant.
// Grouped by intent so the picker can present them in tidy sections.
// Users who want something off-list pick an emoji instead (the picker
// has an emoji tab as fallback).

import {
  Plane, Palmtree, Tent, Map, Hotel, Ship,
  Home, Bed, Sofa, Wrench, Hammer, Lightbulb,
  Car, Bike, Truck, Fuel, Wrench as VehicleService,
  Baby, Heart, Users, Dog, Cat, GraduationCap,
  TrendingUp, PiggyBank, LineChart, DollarSign, Wallet, BadgeDollarSign,
  Laptop, Smartphone, Camera, Headphones, Gamepad2, Watch,
  Activity, Dumbbell, Stethoscope, Apple,
  BookOpen, Briefcase, PencilLine,
  ShoppingBag, Gift, PartyPopper, Music,
  Receipt, Coffee, Pizza, Wine,
  type LucideIcon,
} from "lucide-react";

export type IconEntry = {
  name: string;        // stored value in personal_goals.icon
  label: string;
  Icon: LucideIcon;
};

export type IconGroup = {
  label: string;
  icons: IconEntry[];
};

export const ICON_GROUPS: IconGroup[] = [
  {
    label: "Travel",
    icons: [
      { name: "Plane", label: "Flight", Icon: Plane },
      { name: "Palmtree", label: "Beach", Icon: Palmtree },
      { name: "Tent", label: "Camping", Icon: Tent },
      { name: "Map", label: "Road trip", Icon: Map },
      { name: "Hotel", label: "Hotel", Icon: Hotel },
      { name: "Ship", label: "Cruise", Icon: Ship },
    ],
  },
  {
    label: "Home",
    icons: [
      { name: "Home", label: "Home", Icon: Home },
      { name: "Bed", label: "Furniture", Icon: Bed },
      { name: "Sofa", label: "Living room", Icon: Sofa },
      { name: "Wrench", label: "Repairs", Icon: Wrench },
      { name: "Hammer", label: "Reno", Icon: Hammer },
      { name: "Lightbulb", label: "Utilities", Icon: Lightbulb },
    ],
  },
  {
    label: "Vehicle",
    icons: [
      { name: "Car", label: "Car", Icon: Car },
      { name: "Truck", label: "Truck", Icon: Truck },
      { name: "Bike", label: "Bike", Icon: Bike },
      { name: "Fuel", label: "Fuel", Icon: Fuel },
      { name: "VehicleService", label: "Service", Icon: VehicleService },
    ],
  },
  {
    label: "Family",
    icons: [
      { name: "Baby", label: "Baby", Icon: Baby },
      { name: "Users", label: "Family", Icon: Users },
      { name: "Heart", label: "Wedding", Icon: Heart },
      { name: "Dog", label: "Dog", Icon: Dog },
      { name: "Cat", label: "Cat", Icon: Cat },
      { name: "GraduationCap", label: "School", Icon: GraduationCap },
    ],
  },
  {
    label: "Money & Investing",
    icons: [
      { name: "TrendingUp", label: "Stocks", Icon: TrendingUp },
      { name: "PiggyBank", label: "Savings", Icon: PiggyBank },
      { name: "LineChart", label: "Investments", Icon: LineChart },
      { name: "DollarSign", label: "Cash", Icon: DollarSign },
      { name: "Wallet", label: "Wallet", Icon: Wallet },
      { name: "BadgeDollarSign", label: "Bonus", Icon: BadgeDollarSign },
    ],
  },
  {
    label: "Tech",
    icons: [
      { name: "Laptop", label: "Laptop", Icon: Laptop },
      { name: "Smartphone", label: "Phone", Icon: Smartphone },
      { name: "Camera", label: "Camera", Icon: Camera },
      { name: "Headphones", label: "Audio", Icon: Headphones },
      { name: "Gamepad2", label: "Gaming", Icon: Gamepad2 },
      { name: "Watch", label: "Watch", Icon: Watch },
    ],
  },
  {
    label: "Health & Lifestyle",
    icons: [
      { name: "Activity", label: "Fitness", Icon: Activity },
      { name: "Dumbbell", label: "Gym", Icon: Dumbbell },
      { name: "Stethoscope", label: "Medical", Icon: Stethoscope },
      { name: "Apple", label: "Groceries", Icon: Apple },
    ],
  },
  {
    label: "Other",
    icons: [
      { name: "BookOpen", label: "Education", Icon: BookOpen },
      { name: "Briefcase", label: "Career", Icon: Briefcase },
      { name: "PencilLine", label: "Hobby", Icon: PencilLine },
      { name: "ShoppingBag", label: "Shopping", Icon: ShoppingBag },
      { name: "Gift", label: "Gift", Icon: Gift },
      { name: "PartyPopper", label: "Celebration", Icon: PartyPopper },
      { name: "Music", label: "Music", Icon: Music },
      { name: "Receipt", label: "Bills", Icon: Receipt },
      { name: "Coffee", label: "Coffee", Icon: Coffee },
      { name: "Pizza", label: "Food", Icon: Pizza },
      { name: "Wine", label: "Going out", Icon: Wine },
    ],
  },
];

const ALL_ICONS: Record<string, LucideIcon> = (() => {
  const map: Record<string, LucideIcon> = {};
  for (const group of ICON_GROUPS) {
    for (const entry of group.icons) {
      map[entry.name] = entry.Icon;
    }
  }
  return map;
})();

export function getLucideIcon(name: string | null | undefined): LucideIcon | null {
  if (!name) return null;
  return ALL_ICONS[name] || null;
}

// Default category → icon mapping so new goals get a sensible icon when
// the user hasn't picked one yet.
export function defaultIconForCategory(category: string): string {
  switch (category) {
    case "vacation": return "Plane";
    case "savings": return "PiggyBank";
    case "investment": return "TrendingUp";
    case "bills": return "Receipt";
    case "spending": return "Wallet";
    default: return "PartyPopper";
  }
}
