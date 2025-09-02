// Simple TOML generator for browser compatibility
export function generateSimpleToml(data: Record<string, any>): string {
  const lines: string[] = [];

  function escapeString(str: string): string {
    return `"${str.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  function formatValue(value: any): string {
    if (typeof value === 'string') {
      // Handle multi-line strings
      if (value.includes('\n')) {
        return `"""\n${value}\n"""`;
      }
      return escapeString(value);
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) {
      return `[${value.map(formatValue).join(', ')}]`;
    }
    if (typeof value === 'object' && value !== null) {
      // For inline tables
      const pairs = Object.entries(value).map(([k, v]) => `${k} = ${formatValue(v)}`);
      return `{ ${pairs.join(', ')} }`;
    }
    return escapeString(String(value));
  }

  function processSection(obj: Record<string, any>, sectionPrefix = ''): void {
    const simpleValues: Array<[string, any]> = [];
    const subsections: Array<[string, any]> = [];

    // Separate simple values from subsections
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Check if it's a simple object that can be inline
        const entries = Object.entries(value);
        const isSimpleObject = entries.length <= 3 && 
          entries.every(([, v]) => typeof v !== 'object');
        
        if (isSimpleObject) {
          simpleValues.push([key, value]);
        } else {
          subsections.push([key, value]);
        }
      } else {
        simpleValues.push([key, value]);
      }
    }

    // Add simple values first
    for (const [key, value] of simpleValues) {
      lines.push(`${key} = ${formatValue(value)}`);
    }

    // Add subsections
    for (const [key, value] of subsections) {
      if (simpleValues.length > 0 || lines.length > 0) {
        lines.push(''); // Empty line before section
      }
      
      const fullSectionName = sectionPrefix ? `${sectionPrefix}.${key}` : key;
      lines.push(`[${fullSectionName}]`);
      
      if (typeof value === 'object' && value !== null) {
        processSection(value as Record<string, any>);
      }
    }
  }

  processSection(data);
  return lines.join('\n');
}

export function parseSimpleToml(tomlString: string): Record<string, any> {
  const result: Record<string, any> = {};
  const lines = tomlString.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
  
  let currentSection: Record<string, any> = result;
  let currentSectionName = '';

  for (const line of lines) {
    // Section header
    if (line.startsWith('[') && line.endsWith(']')) {
      currentSectionName = line.slice(1, -1);
      const parts = currentSectionName.split('.');
      
      currentSection = result;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          if (!currentSection[part]) {
            currentSection[part] = {};
          }
          currentSection = currentSection[part];
        } else {
          if (!currentSection[part]) {
            currentSection[part] = {};
          }
          currentSection = currentSection[part];
        }
      }
      continue;
    }

    // Key-value pair
    const equalIndex = line.indexOf('=');
    if (equalIndex === -1) continue;

    const key = line.substring(0, equalIndex).trim();
    let value = line.substring(equalIndex + 1).trim();

    // Parse value
    if (value.startsWith('"') && value.endsWith('"')) {
      // String value
      value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      currentSection[key] = value;
    } else if (value === 'true' || value === 'false') {
      // Boolean value
      currentSection[key] = value === 'true';
    } else if (!isNaN(Number(value))) {
      // Number value
      currentSection[key] = Number(value);
    } else if (value.startsWith('[') && value.endsWith(']')) {
      // Array value - simple parsing
      const arrayContent = value.slice(1, -1);
      if (arrayContent.trim()) {
        currentSection[key] = arrayContent.split(',').map(item => {
          item = item.trim();
          if (item.startsWith('"') && item.endsWith('"')) {
            return item.slice(1, -1);
          }
          if (!isNaN(Number(item))) {
            return Number(item);
          }
          return item;
        });
      } else {
        currentSection[key] = [];
      }
    } else {
      // Raw string value
      currentSection[key] = value;
    }
  }

  return result;
}
