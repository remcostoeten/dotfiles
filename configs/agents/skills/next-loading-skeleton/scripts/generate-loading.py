#!/usr/bin/env python3
"""
Generate Next.js loading.tsx files with shadcn/ui Skeleton components.
Usage: python generate-loading.py "description of layout"
"""

import sys
import re

def generate_loading_skeleton(description):
    """Generate loading.tsx code based on description."""
    
    # Default patterns
    patterns = {
        'dashboard': generate_dashboard_skeleton,
        'table': generate_table_skeleton,
        'list': generate_list_skeleton,
        'profile': generate_profile_skeleton,
        'cards': generate_cards_skeleton,
        'form': generate_form_skeleton,
        'stats': generate_stats_skeleton
    }
    
    # Detect pattern from description
    desc_lower = description.lower()
    
    if 'dashboard' in desc_lower and ('stat' in desc_lower or 'metric' in desc_lower):
        return generate_dashboard_skeleton(description)
    elif 'table' in desc_lower:
        return generate_table_skeleton(description)
    elif 'profile' in desc_lower or 'user' in desc_lower:
        return generate_profile_skeleton(description)
    elif 'card' in desc_lower:
        return generate_cards_skeleton(description)
    elif 'list' in desc_lower:
        return generate_list_skeleton(description)
    elif 'form' in desc_lower:
        return generate_form_skeleton(description)
    elif 'stat' in desc_lower or 'metric' in desc_lower:
        return generate_stats_skeleton(description)
    else:
        # Default to card layout
        return generate_cards_skeleton(description)

def generate_dashboard_skeleton(description):
    """Generate dashboard skeleton with stats and content."""
    # Extract numbers from description
    stat_count = extract_number(description) or 4
    has_table = 'table' in description.lower()
    
    table_section = '''      {/* Table Section */}
      <div className="space-y-4">
        <Skeleton className="h-10 w-[300px]" />
        <div className="space-y-2">
          {Array.from({{ length: 8 }}).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-4 w-[150px]" />
              <Skeleton className="h-4 w-[100px]" />
            </div>
          ))}
        </div>
      </div>''' if has_table else ''
    
    return f'''import {{ Skeleton }} from "@/components/ui/skeleton"

export default function Loading() {{
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-{stat_count}">
        {Array.from({{ length: {stat_count} }}).map((_, i) => (
          <Skeleton key={i} className="h-[125px] w-full rounded-lg" />
        ))}
      </div>
      
{table_section}
    </div>
  )
}}'''

def generate_table_skeleton(description):
    """Generate table skeleton."""
    rows = extract_number(description) or 8
    cols = extract_number(description.replace(str(rows), '')) or 4
    
    return f'''import {{ Skeleton }} from "@/components/ui/skeleton"

export default function Loading() {{
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex gap-4">
        <Skeleton className="h-10 w-[300px]" />
        <Skeleton className="h-10 w-[100px]" />
      </div>
      <div className="space-y-2">
        {Array.from({{ length: {rows} }}).map((_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({{ length: {cols} }}).map((_, j) => (
              <Skeleton key={j} className="h-4 w-[{150 + j * 50}px]" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}}'''

def generate_profile_skeleton(description):
    """Generate profile page skeleton."""
    return '''import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
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
        <div className="space-y-4">
          <Skeleton className="h-[200px] w-full rounded-lg" />
          <Skeleton className="h-[150px] w-full rounded-lg" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-[250px] w-full rounded-lg" />
          <Skeleton className="h-[100px] w-full rounded-lg" />
        </div>
      </div>
    </div>
  )
}'''

def generate_cards_skeleton(description):
    """Generate card grid skeleton."""
    count = extract_number(description) or 6
    grid_cols = min(count, 3)
    
    return f'''import {{ Skeleton }} from "@/components/ui/skeleton"

export default function Loading() {{
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-{grid_cols}">
        {Array.from({{ length: {count} }}).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="h-[200px] w-full rounded-lg" />
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        ))}
      </div>
    </div>
  )
}}'''

def generate_list_skeleton(description):
    """Generate list skeleton."""
    count = extract_number(description) or 5
    
    return f'''import {{ Skeleton }} from "@/components/ui/skeleton"

export default function Loading() {{
  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({{ length: {count} }}).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 border rounded-lg">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-[300px]" />
            <Skeleton className="h-4 w-[400px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      ))}
    </div>
  )
}}'''

def generate_form_skeleton(description):
    """Generate form skeleton."""
    return '''import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-[100px]" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-[120px]" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-[80px]" />
          <Skeleton className="h-[100px] w-full" />
        </div>
      </div>
      <div className="flex gap-4">
        <Skeleton className="h-10 w-[100px]" />
        <Skeleton className="h-10 w-[100px]" />
      </div>
    </div>
  )
}'''

def generate_stats_skeleton(description):
    """Generate stats/metrics skeleton."""
    count = extract_number(description) or 4
    
    return f'''import {{ Skeleton }} from "@/components/ui/skeleton"

export default function Loading() {{
  return (
    <div className="space-y-6 animate-pulse">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-{count}">
        {Array.from({{ length: {count} }}).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-8 w-[100px]" />
            <Skeleton className="h-12 w-[150px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        ))}
      </div>
    </div>
  )
}}'''

def extract_number(text):
    """Extract first number from text."""
    match = re.search(r'\b(\d+)\b', text)
    return int(match.group(1)) if match else None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python generate-loading.py \"description of layout\"")
        sys.exit(1)
    
    description = sys.argv[1]
    result = generate_loading_skeleton(description)
    print(result)
