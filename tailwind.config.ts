import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: {
				DEFAULT: '1rem',
				sm: '2rem',
				lg: '4rem',
				xl: '5rem',
				'2xl': '6rem',
			},
			screens: {
				sm: '640px',
				md: '768px',
				lg: '1024px',
				xl: '1280px',
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['Manrope', 'Inter', 'sans-serif'],
				display: ['Plus Jakarta Sans', 'sans-serif'],
				headline: ['Plus Jakarta Sans', 'sans-serif'],
				body: ['Manrope', 'sans-serif'],
				serif: ['Playfair Display', 'serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--on-primary))',
					glow: 'hsl(var(--primary-glow))',
					container: 'hsl(var(--primary-container))',
					fixed: 'hsl(var(--primary-fixed))',
					'fixed-dim': 'hsl(var(--primary-fixed-dim))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--on-secondary))',
					container: 'hsl(var(--secondary-container))',
					fixed: 'hsl(var(--secondary-fixed))',
					'fixed-dim': 'hsl(var(--secondary-fixed-dim))'
				},
				tertiary: {
					DEFAULT: 'hsl(var(--tertiary))',
					foreground: 'hsl(var(--on-tertiary))',
					container: 'hsl(var(--tertiary-container))',
					fixed: 'hsl(var(--tertiary-fixed))',
					'fixed-dim': 'hsl(var(--tertiary-fixed-dim))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				surface: {
					DEFAULT: 'hsl(var(--surface))',
					container: {
						lowest: 'hsl(var(--surface-container-lowest))',
						low: 'hsl(var(--surface-container-low))',
						DEFAULT: 'hsl(var(--surface-container))',
						high: 'hsl(var(--surface-container-high))',
						highest: 'hsl(var(--surface-container-highest))'
					}
				},
				parliament: {
					blue: 'hsl(var(--parliament-blue))',
					gold: 'hsl(var(--parliament-gold))',
					cream: 'hsl(var(--heritage-cream))',
					navy: 'hsl(var(--official-navy))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				'on-surface': 'hsl(var(--on-surface))',
				'on-surface-variant': 'hsl(var(--on-surface-variant))',
				'outline-color': 'hsl(var(--outline))',
				'outline-variant': 'hsl(var(--outline-variant))',
				'on-primary-container': 'hsl(var(--on-primary-container))',
				'on-primary-fixed': 'hsl(var(--on-primary-fixed))',
				'on-secondary-container': 'hsl(var(--on-secondary-container))',
				'on-secondary-fixed': 'hsl(var(--on-secondary-fixed))',
				'on-tertiary-fixed': 'hsl(var(--on-tertiary-fixed))',
				'on-tertiary-container': 'hsl(var(--on-tertiary-container))',
				'error': 'hsl(var(--error))',
				'error-container': 'hsl(var(--error-container))',
				'surface-variant': 'hsl(var(--surface-variant))',
				'surface-dim': 'hsl(var(--surface-dim))'
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-hero': 'var(--gradient-hero)',
				'gradient-parliament': 'var(--gradient-parliament)'
			},
			boxShadow: {
				'primary': 'var(--shadow-primary)',
				'glow': 'var(--shadow-glow)',
				'elevated': 'var(--shadow-elevated)'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'shine': {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(100%)' }
				},
				'pulse-glow': {
					'0%, 100%': { 
						boxShadow: '0 0 20px hsl(var(--primary) / 0.3)' 
					},
					'50%': { 
						boxShadow: '0 0 40px hsl(var(--primary) / 0.6)' 
					}
				},
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(10px)'
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)'
					}
				},
				'fade-out': {
					'0%': {
						opacity: '1',
						transform: 'translateY(0)'
					},
					'100%': {
						opacity: '0',
						transform: 'translateY(10px)'
					}
				},
				'scale-in': {
					'0%': {
						transform: 'scale(0.95)',
						opacity: '0'
					},
					'100%': {
						transform: 'scale(1)',
						opacity: '1'
					}
				},
				'scale-out': {
					from: { transform: 'scale(1)', opacity: '1' },
					to: { transform: 'scale(0.95)', opacity: '0' }
				},
				'slide-in-right': {
					'0%': { transform: 'translateX(100%)' },
					'100%': { transform: 'translateX(0)' }
				},
				'slide-out-right': {
					'0%': { transform: 'translateX(0)' },
					'100%': { transform: 'translateX(100%)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'shine': 'shine 2s infinite',
				'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
				'fade-in': 'fade-in 0.3s ease-out',
				'fade-out': 'fade-out 0.3s ease-out',
				'scale-in': 'scale-in 0.2s ease-out',
				'scale-out': 'scale-out 0.2s ease-out',
				'slide-in-right': 'slide-in-right 0.3s ease-out',
				'slide-out-right': 'slide-out-right 0.3s ease-out'
			},
			screens: {
				'xs': '475px',
				'sm': '640px',
				'md': '768px',
				'lg': '1024px',
				'xl': '1280px',
				'2xl': '1536px',
				'3xl': '1920px'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;