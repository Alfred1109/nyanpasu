# UI Framework Consolidation Plan

## Current State Analysis

### MUI Usage

- **Components**: 116 files using MUI components
- **Dependencies**:
  - `@mui/material`: 7.3.5
  - `@mui/icons-material`: 7.3.5
  - `@mui/lab`: 7.0.0-beta.17
  - `@mui/x-date-pickers`: 8.17.0

### Radix UI Usage

- **Components**: Mixed usage across the same 116 files
- **Dependencies**:
  - `@radix-ui/react-dropdown-menu`: 2.1.16
  - `@radix-ui/react-scroll-area`: 1.2.10
  - `@radix-ui/react-select`: 2.2.6
  - `@radix-ui/react-separator`: 1.1.8
  - `@radix-ui/react-slot`: 1.1.4
  - `@radix-ui/react-switch`: 1.2.6
  - `@radix-ui/react-portal`: 1.1.10

## Problems Identified

1. **Bundle Size**: Double framework overhead (~2MB extra)
2. **Theme Conflicts**: Different theming systems
3. **Component Inconsistency**: Mixed design patterns
4. **Maintenance Overhead**: Two API surfaces to maintain
5. **Performance**: Duplicate functionality loading

## Recommended Solution: Keep MUI as Primary

### Rationale

- **Broader adoption** in the codebase (116 files heavily using MUI)
- **Complete ecosystem** (Material, Lab, Icons, Date Pickers)
- **Better TypeScript support** for the existing codebase
- **Mature theming system** already integrated

### Migration Plan

#### Phase 1: Replace Radix UI Components (Week 1-2)

- `@radix-ui/react-select` → `@mui/material/Select`
- `@radix-ui/react-switch` → `@mui/material/Switch`
- `@radix-ui/react-separator` → `@mui/material/Divider`
- `@radix-ui/react-dropdown-menu` → `@mui/material/Menu`

#### Phase 2: Custom Components (Week 3)

- `@radix-ui/react-scroll-area` → Custom MUI-based ScrollArea
- `@radix-ui/react-portal` → `@mui/material/Portal`
- `@radix-ui/react-slot` → Custom MUI composition

#### Phase 3: Testing & Cleanup (Week 4)

- Remove Radix UI dependencies
- Update TypeScript types
- Verify theme consistency
- Performance testing

## Implementation Priority

### High Impact Files (10+ imports each)

1. `clash-field.tsx` (10 imports)
2. `clash-web.tsx` (9 imports)
3. `clash-core.tsx` (6 imports)
4. `textItem.tsx` (5 imports)
5. `profiles.tsx` (4 imports)

### Migration Commands

```bash
# Remove Radix UI dependencies
pnpm remove @radix-ui/react-dropdown-menu @radix-ui/react-scroll-area @radix-ui/react-select @radix-ui/react-separator @radix-ui/react-slot @radix-ui/react-switch @radix-ui/react-use-controllable-state @radix-ui/react-portal

# Keep only necessary MUI packages
pnpm add @mui/material @mui/icons-material @mui/x-date-pickers
```

## Expected Benefits

- **Bundle Size Reduction**: ~2MB decrease
- **Performance**: Single theming system, no conflicts
- **Consistency**: Unified Material Design language
- **Maintainability**: Single component API
- **TypeScript**: Better type inference and checking

## Risk Mitigation

- Create component mapping guide
- Implement gradual migration with feature flags
- Maintain visual regression tests
- Document breaking changes for team
