"use client";

import * as React from "react";
import {
  Activity, Ambulance, Apple, Atom, Award, Baby, Backpack, BadgeDollarSign, Banknote, Bell, Bird, Bone, BookOpen,
  BookText, Bot, Brush, Briefcase, BriefcaseBusiness, Building, Building2, Cake, Calculator, CalendarDays, Camera,
  Cat, ChartBar, ChartLine, ChartPie, Clapperboard, ClipboardList, Cloud, Code, Cog, Coins, Compass, Contact,
  Copyright, Cpu, CreditCard, Cross, Crown, Database, Dog, DoorOpen, Droplet, Eye, Factory, Feather, Fence,
  FileBadge, FileCheck, FileText, Filter, Film, Fingerprint, Fish, Flag, Flame, FlaskConical, Flower, Flower2,
  Footprints, Gauge, Gavel, Gem, Gift, Globe, GraduationCap, HandHeart, Handshake, Headphones, Heart, HeartPulse,
  Hospital, Hourglass, House, Infinity as InfinityIcon, Key, Landmark, Languages, Laptop, LayoutGrid, Leaf,
  Library, Lightbulb, Link, Lock, Luggage, Map as MapIcon, MapPin, MapPinned, Medal, Megaphone, MessageCircle, Mic, Monitor,
  Moon, Mountain, Music, Network, Package, Palette, PartyPopper, PawPrint, Pencil, PenTool, Percent, PiggyBank,
  Pill, Plane, Presentation, Puzzle, Rabbit, Rocket, Scale, School, Scissors, ScrollText, Search, Server, Shapes,
  Shield, ShieldCheck, Ship, ShoppingBag, Signature, Smartphone, Smile, Sofa, Sparkles, Squirrel, Stamp, Star,
  Stethoscope, Sun, Syringe, Table, Target, Tent, Thermometer, Ticket, TreeDeciduous, TreePalm, TrendingUp, Trophy,
  Truck, Turtle, User, Users, Vault, Wallet, WandSparkles, Wifi, Wine, Workflow, Hammer, Warehouse,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryIconStyle } from "@/lib/category-icons";
import { DESIGNS } from "./designs";
import { KitDefs, KitGround, makeKit } from "./kit";

/** Default (Lucide) style: 9 line icons per category plus the colour they're drawn in. */
export const LUCIDE_SETS: Record<string, { color: string; icons: LucideIcon[] }> = {
  "13": { color: "#FF453A", icons: [HeartPulse, Cross, Pill, Hospital, Stethoscope, Syringe, Activity, Thermometer, Ambulance] },
  "14": { color: "#0A84FF", icons: [Scale, Gavel, Landmark, BookText, Signature, Shield, Stamp, Banknote, ScrollText] },
  "15": { color: "#30D158", icons: [BadgeDollarSign, Coins, CreditCard, Vault, Wallet, PiggyBank, Calculator, Percent, TrendingUp] },
  "16": { color: "#FF9F0A", icons: [House, Key, Building2, Warehouse, MapPin, DoorOpen, Sofa, Fence, Hammer] },
  "17": { color: "#64D2FF", icons: [Globe, FileCheck, Contact, Flag, MapPinned, Plane, Stamp, Luggage, Languages] },
  "18": { color: "#FFD60A", icons: [Lightbulb, Copyright, ShieldCheck, Award, Cog, Lock, FileBadge, Fingerprint, Search] },
  "19": { color: "#5E5CE6", icons: [Briefcase, Building, Target, Rocket, Presentation, ClipboardList, Hourglass, TrendingUp, ChartPie] },
  "20": { color: "#BF5AF2", icons: [BriefcaseBusiness, TrendingUp, FileText, Trophy, Contact, Medal, Compass, Mountain, Star] },
  "21": { color: "#FFB340", icons: [Flower2, Flame, Moon, InfinityIcon, Sun, Sparkles, Leaf, Feather, Eye] },
  "22": { color: "#40C8E0", icons: [Network, Factory, Puzzle, Cog, Truck, Link, Handshake, Package, Globe] },
  "23": { color: "#FF375F", icons: [PartyPopper, Gift, Ticket, CalendarDays, Wine, Sparkles, Cake, Music, Mic] },
  "24": { color: "#32ADE6", icons: [Luggage, TreePalm, Compass, MapIcon, Plane, Mountain, Tent, Ship, Camera] },
  "25": { color: "#0A84FF", icons: [Laptop, Cpu, Smartphone, Code, Cloud, Bot, Monitor, Wifi, Server] },
  "26": { color: "#FF9F0A", icons: [GraduationCap, BookOpen, Pencil, Apple, Atom, Backpack, ScrollText, School, FlaskConical] },
  "27": { color: "#FF6482", icons: [Heart, Users, Baby, Smile, HandHeart, House, Footprints, TreeDeciduous, Library] },
  "28": { color: "#AC8E68", icons: [PawPrint, Bone, Fish, Cat, Dog, Bird, Rabbit, Turtle, Squirrel] },
  "29": { color: "#FF6FAE", icons: [Gem, WandSparkles, Sparkles, Droplet, Flower, Scissors, Star, Brush, Crown] },
  "30": { color: "#FF9500", icons: [Palette, Brush, PenTool, Camera, Music, Clapperboard, Mic, Film, Shapes] },
  "8": { color: "#30D158", icons: [User, Users, Star, MessageCircle, Headphones, Megaphone, ShoppingBag, Smile, Bell] },
  "10": { color: "#64D2FF", icons: [ChartPie, ChartBar, Database, ChartLine, Search, Filter, Gauge, Workflow, Table] },
};

/** Human name of one design, for alt text and the settings picker. */
export function categoryDesignLabel(categoryId: string, variant: number): string {
  return DESIGNS[categoryId]?.[variant]?.[0] ?? "Category";
}

interface CategoryIconProps {
  categoryId: string;
  style: CategoryIconStyle;
  /** Which of the 9 designs (0-8). */
  variant?: number;
  className?: string;
  title?: string;
}

/** One home-category icon in the chosen style. Transparent background; sizes to its className. */
export function CategoryIcon({ categoryId, style, variant = 0, className, title }: CategoryIconProps) {
  const rawId = React.useId();

  if (style === "lucide") {
    const set = LUCIDE_SETS[categoryId];
    const Icon = set?.icons[variant] ?? set?.icons[0] ?? LayoutGrid;
    return (
      <Icon
        className={className}
        style={{ color: set?.color ?? "#fff" }}
        strokeWidth={1.8}
        aria-label={title}
        aria-hidden={title ? undefined : true}
      />
    );
  }

  const designs = DESIGNS[categoryId];
  const design = designs?.[variant] ?? designs?.[0];
  if (!design) {
    return <LayoutGrid className={className} strokeWidth={1.8} aria-hidden />;
  }

  // useId() returns characters like ":" that break url(#...) references.
  const id = `ci${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg
      viewBox="0 0 64 64"
      className={cn("overflow-visible", className)}
      style={{ filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.5))" }}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <KitDefs id={id} style={style} />
      <KitGround id={id} />
      {design[1](makeKit(id, style))}
    </svg>
  );
}
