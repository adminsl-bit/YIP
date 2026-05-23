import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon: any; // Can be a LucideIcon or a ReactNode
  actions?: React.ReactNode;
  rightElement?: React.ReactNode;
  badge?: string;
}

export const PageHeader = ({ title, subtitle, description, icon, actions, rightElement, badge }: PageHeaderProps) => {
  const renderIcon = () => {
    if (!icon) return null;
    try {
      if (React.isValidElement(icon)) {
        return React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' } as any);
      }
      
      const IconComp = icon;
      if (typeof IconComp === 'function' || typeof IconComp === 'object') {
        return <IconComp className="w-6 h-6" />;
      }
    } catch (e) {
      console.error('[PageHeader] Icon render error:', e);
    }
    return null;
  };

  const subText = subtitle || description;

  return (
    <header className="pb-8 pt-2">
      <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          {/* Icon with Gradient Background */}
          {icon && (
            <div className="w-16 h-16 rounded-[24px] bg-gradient-primary flex items-center justify-center text-on-primary shadow-2xl shadow-primary/20 flex-shrink-0 relative overflow-hidden group">
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              {renderIcon()}
            </div>
          )}

          {/* Title and Subtitle Area */}
          <div className="flex flex-col">
            {badge && (
              <div className="inline-flex items-center w-fit px-4 py-1.5 rounded-full text-label-xs bg-tertiary-fixed/20 text-tertiary-container mb-3">
                <span className="w-2 h-2 bg-tertiary rounded-full mr-2 animate-pulse"></span>
                {badge}
              </div>
            )}
            <h1 className="text-display-sm md:text-display-md text-on-surface uppercase leading-none tracking-tighter italic">
              {title}
            </h1>
            {subText && (
              <p className="text-body-sm font-bold text-on-surface-variant/40 uppercase tracking-[0.2em] mt-3">
                {subText}
              </p>
            )}
          </div>
        </div>

        {/* Optional Actions and Elements */}
        {(actions || rightElement) && (
          <div className="flex flex-wrap items-center gap-4">
            {actions && (
              <div className="flex items-center glassmorphism p-2 rounded-[24px] shadow-elevated">
                {actions}
              </div>
            )}
            {rightElement && (
              <div className="flex items-center">
                {rightElement}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
