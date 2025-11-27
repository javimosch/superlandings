# Responsive Design Implementation

## Overview
The SuperLandings admin UI has been made highly responsive and works seamlessly on screens >= 320px (mobile-first design).

## Responsive Breakpoints

### Mobile (320px - 639px)
- Compact header with hamburger menu toggle
- Single-column layout for all content
- Smaller text sizes and padding
- Stacked buttons and form elements
- Icon-only buttons where space is limited

### Tablet (640px - 1023px)
- Transitional breakpoint using `sm:` Tailwind prefix
- Flexible layouts that adapt to medium screens
- Balanced spacing and typography

### Desktop (1024px+)
- Full-featured layout with all UI elements visible
- Optimal spacing and typography
- Multi-column layouts where applicable

## Key Changes

### Header (`views/admin/partials/header.ejs`)
- **Mobile Menu Toggle**: Hamburger button appears on screens < 640px
- **Responsive Navigation**: Desktop nav hidden on mobile, mobile menu shown instead
- **Text Truncation**: User email and org names truncate on small screens
- **Icon-Only Buttons**: Admin buttons show only icons on mobile
- **Flexible Spacing**: Padding scales from `px-3` (mobile) to `px-4` (desktop)

### Main Content (`views/admin/partials/main.ejs`)
- **Stacked Layout**: Landing items stack vertically on mobile
- **Responsive Buttons**: Action buttons use `flex-wrap` and `flex-shrink-0`
- **Text Wrapping**: Landing names and metadata wrap properly
- **Responsive Padding**: Content padding scales with screen size
- **Icon Buttons**: Buttons show icons only on mobile to save space

### Modals (all modals in `views/admin/partials/modals/`)
- **Responsive Padding**: `p-3 sm:p-4 sm:p-6` pattern for consistent scaling
- **Flexible Headers**: Modal titles and descriptions wrap on small screens
- **Stacked Forms**: Form elements stack vertically on mobile
- **Button Layout**: Buttons stack vertically on mobile, horizontal on desktop
- **Text Sizing**: Font sizes scale with `text-xs sm:text-sm sm:text-base` pattern

#### Updated Modals:
1. **add-landing.ejs** - Form inputs stack vertically on mobile
2. **edit-landing.ejs** - Editor and buttons responsive, preview buttons compact
3. **domains.ejs** - Domain list items wrap properly on mobile
4. **versions.ejs** - Version snapshot input and button stack on mobile
5. **audit.ejs** - Audit entries display compactly on mobile
6. **move-landing.ejs** - Move dialog responsive with stacked buttons
7. **organizations.ejs** - Organization creation form responsive
8. **admin-domains.ejs** - Admin domain configuration responsive
9. **diff.ejs** - Diff viewer responsive with compact header

### Vue Data (`views/admin/partials/scripts.ejs`)
- **showMobileMenu**: New boolean flag to toggle mobile navigation menu
- Allows smooth mobile menu interactions

### Styles (`views/admin/index.ejs`)
- **Extra Small Devices (320px)**: Font size adjustments for ultra-compact screens
- **Tailwind CDN**: Uses responsive prefixes (`sm:`, `md:`, `lg:`)

## Responsive Patterns Used

### Padding & Spacing
```
p-3 sm:p-4 sm:p-6       # Padding scales with screen size
px-3 sm:px-4 sm:px-6    # Horizontal padding
py-2 sm:py-3 sm:py-4    # Vertical padding
gap-2 sm:gap-3 sm:gap-4  # Gap between elements
```

### Typography
```
text-xs sm:text-sm sm:text-base   # Font sizes
text-lg sm:text-xl sm:text-2xl    # Heading sizes
```

### Layout
```
flex-col sm:flex-row     # Stack on mobile, row on desktop
flex-wrap sm:flex-nowrap # Wrap on mobile, no wrap on desktop
flex-1 min-w-0           # Flexible width with text truncation
flex-shrink-0            # Prevent shrinking of buttons/icons
```

### Visibility
```
hidden sm:block          # Hide on mobile, show on desktop
sm:hidden                # Hide on desktop, show on mobile
```

## Mobile-First Features

### Navigation
- Hamburger menu on mobile with collapsible sections
- Organization switcher in mobile menu
- Admin controls grouped in mobile menu
- Auto-close menu when navigating

### Forms
- Full-width inputs on mobile
- Stacked labels and inputs
- Buttons stack vertically on mobile
- Touch-friendly button sizes (min 44px height)

### Lists
- Single column on mobile
- Proper text wrapping and truncation
- Icon-only buttons to save space
- Responsive badge sizing

### Modals
- Full-screen on mobile (with padding)
- Proper overflow handling
- Responsive button layouts
- Readable text sizes on all screens

## Testing Recommendations

### Devices to Test
- iPhone SE (375px)
- iPhone 12 (390px)
- Pixel 5 (393px)
- iPad Mini (768px)
- iPad Pro (1024px+)
- Desktop (1920px+)

### Key Areas to Verify
1. Header menu toggle works on mobile
2. All buttons are clickable (min 44px height)
3. Text is readable without zooming
4. Forms are usable on mobile
5. Modals fit on screen without scrolling parent
6. No horizontal scrolling on any screen size
7. Images and content scale appropriately
8. Touch targets are adequate for mobile

## Browser Support
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## Notes
- Uses Tailwind CSS responsive prefixes
- Mobile-first approach ensures progressive enhancement
- All responsive classes use Tailwind's `sm:` breakpoint (640px)
- Extra small device support (320px) via custom CSS media query
