---
name: next-loading-skeleton
description: "⚡ Instant Loading UI for Next.js - Auto-generate beautiful loading.tsx with shadcn/ui Skeleton placeholders. Perfect for dashboards, data tables, and profile pages. Zero wait time, maximum user satisfaction."
---

# ⚡ Next.js Loading Skeleton

**Transform slow-loading pages into delightful user experiences.**

This skill automatically generates beautiful loading states for Next.js App Router using shadcn/ui Skeleton components. Say goodbye to blank screens and hello to instant visual feedback that keeps users engaged.

---

## 🎯 When to Use

**Auto-activates when you mention:**
- Creating Next.js App Router pages with data fetching
- Keywords: "loading", "skeleton", "placeholder", "Suspense"
- Building dashboards, tables, lists, or profile pages
- Pages with slow API calls or database queries
- Any layout that needs instant visual feedback

**Perfect for:**
- 📊 **Dashboards** with multiple data widgets
- 📋 **Data tables** with server-side pagination
- 👤 **Profile pages** with user information
- 📝 **Forms** with validation and API calls
- 🛍️ **E-commerce** pages with product data

---

## 🚀 Quick Setup

### 1. Install Required Dependencies

**Essential - Skeleton Component:**
```bash
npx shadcn@latest add skeleton
```

**Recommended for Complete Experience:**
```bash
npx shadcn@latest add card table avatar badge button
```

### 2. That's It! 🎉

The skill will automatically generate loading states when you create pages with data fetching.

---

## 🏗️ Standard Patterns

### File Structure
```
app/
├── dashboard/
│   ├── page.tsx      # Your main page
│   └── loading.tsx    # Auto-generated loading state
```

### Core Principles
- ✅ **Mirror Real Layout** - Skeleton matches actual page structure
- ✅ **Smooth Animation** - Uses `animate-pulse` for natural feel
- ✅ **Realistic Variations** - Different widths/heights for authenticity
- ✅ **Focus on Essentials** - Highlight main content, ignore minor details

---

## 🎨 Skeleton Patterns Library

### Basic Elements
```tsx
// Text line
<Skeleton className="h-4 w-[250px] rounded-full" />

// Card container
<Skeleton className="h-[125px] w-full rounded-lg" />

// Circle (avatar/image)
<Skeleton className="h-10 w-10 rounded-full" />

// Button
<Skeleton className="h-10 w-[100px] rounded-md" />
```

### Complex Layouts
```tsx
// Table row
<div className="flex gap-4">
  <Skeleton className="h-4 w-[100px]" />
  <Skeleton className="h-4 w-[200px]" />
  <Skeleton className="h-4 w-[150px]" />
  <Skeleton className="h-4 w-[100px]" />
</div>

// Card with header and content
<div className="space-y-3">
  <Skeleton className="h-6 w-[150px]" />
  <Skeleton className="h-4 w-full" />
  <Skeleton className="h-4 w-[200px]" />
</div>
```

---

## 📋 Ready-to-Use Examples

### 📊 Dashboard Layout
```tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[125px] w-full rounded-lg" />
        ))}
      </div>
      
      {/* Recent Activity */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-[200px]" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </div  )
}
```

### 👤 User Profile
```tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Profile Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-[200px]" />
          <Skeleton className="h-4 w-[150px]" />
          <Skeleton className="h-4 w-[250px]" />
        </div>
      </div>
      
      {/* Content Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[200px] w-full rounded-lg" />
        <Skeleton className="h-[200px] w-full rounded-lg" />
      </div>
    </div>
  )
}
```

### 📋 Data Table with Search
```tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Search and Actions */}
      <div className="flex gap-4">
        <Skeleton className="h-10 w-[300px]" />
        <Skeleton className="h-10 w-[100px]" />
        <Skeleton className="h-10 w-[120px]" />
      </div>
      
      {/* Table Rows */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 items-center">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-[200px]" />
            <Skeleton className="h-4 w-[150px]" />
            <Skeleton className="h-8 w-[80px] rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

---

## 🛠️ Advanced Features

### Script-Based Generation (Token Saver)
For complex layouts, use the Python script to save tokens:

```bash
python scripts/generate-loading.py "dashboard with 4 stat cards and recent users table"
```

### Responsive Design
Skeletons automatically adapt to your responsive grid:
```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  {/* Skeletons will match your responsive breakpoints */}
</div>
```

### Performance Tips
- ✅ **Lightweight** - Only CSS animations, no JavaScript overhead
- ✅ **GPU Accelerated** - Uses `transform` for smooth 60fps animations
- ✅ **Accessibility** - Screen readers announce loading state
- ✅ **SEO Friendly** - Search engines understand loading states

---

## 🎯 Best Practices

### Do's ✅
- **Match Real Content** - Skeleton should mirror actual layout
- **Use Consistent Spacing** - Follow your design system
- **Add Micro-interactions** - Subtle pulse animations
- **Consider Mobile** - Responsive skeletons for all devices

### Don'ts ❌
- **Overcomplicate** - Keep skeletons simple and clean
- **Ignore Hierarchy** - Maintain visual importance
- **Forget Accessibility** - Include loading announcements
- **Skip Testing** - Test with real data loading times

---

## 🚀 Installation

```bash
# Install via marketplace
npx skills add akashp1712/skills --skill next-loading-skeleton

# Install shadcn/ui skeleton (required)
npx shadcn@latest add skeleton

# Start creating pages - the skill activates automatically!
```

---

<div align="center">
  <p><strong>⚡ Zero wait time, maximum user satisfaction</strong></p>
  <p>Transform your Next.js app with beautiful loading states</p>
</div>
