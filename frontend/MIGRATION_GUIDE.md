# Radix UI to MUI Migration Guide

## Quick Reference: Component Mapping

| Radix UI | MUI Equivalent | Migration Notes |
|----------|----------------|-----------------|
| `@radix-ui/react-select` | `@mui/material/Select` | Use FormControl + InputLabel |
| `@radix-ui/react-switch` | `@mui/material/Switch` | Direct replacement |
| `@radix-ui/react-separator` | `@mui/material/Divider` | Direct replacement |
| `@radix-ui/react-dropdown-menu` | `@mui/material/Menu` | Use with MenuButton |
| `@radix-ui/react-scroll-area` | `@mui/material/Box` | With custom scrollbar styling |
| `@radix-ui/react-portal` | `@mui/material/Portal` | Direct replacement |

## Example Migrations

### 1. Select Component Migration

**Before (Radix UI):**
```tsx
import * as SelectPrimitive from '@radix-ui/react-select'

<SelectPrimitive.Root>
  <SelectPrimitive.Trigger>
    <SelectPrimitive.Value />
  </SelectPrimitive.Trigger>
  <SelectPrimitive.Content>
    <SelectPrimitive.Item value="item1">Item 1</SelectPrimitive.Item>
  </SelectPrimitive.Content>
</SelectPrimitive.Root>
```

**After (MUI):**
```tsx
import { Select, MenuItem, FormControl } from '@mui/material'

<FormControl>
  <Select value={value} onChange={handleChange}>
    <MenuItem value="item1">Item 1</MenuItem>
  </Select>
</FormControl>
```

### 2. Switch Component Migration

**Before (Radix UI):**
```tsx
import * as Switch from '@radix-ui/react-switch'

<Switch.Root>
  <Switch.Thumb />
</Switch.Root>
```

**After (MUI):**
```tsx
import { Switch } from '@mui/material'

<Switch checked={checked} onChange={handleChange} />
```

## Implementation Steps

1. **Create MUI wrapper components** for complex Radix UI usage
2. **Update imports** gradually file by file
3. **Test each component** for visual and functional equivalence
4. **Update TypeScript types** as needed
5. **Remove Radix UI dependencies** when complete

## Breaking Changes to Watch

- **Theme integration**: Ensure Material Design compliance
- **Event handlers**: MUI uses different event signatures
- **Styling**: Convert Radix UI classes to MUI sx prop
- **Accessibility**: MUI handles ARIA differently
